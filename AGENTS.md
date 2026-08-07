# AI 交付指引

## 主流程权威

- 面向团队和下游开发者的唯一完整生命周期是 [`docs/FULLSTACK_WORKFLOW.md`](docs/FULLSTACK_WORKFLOW.md) 的“统一生命周期”：需求进入 → explore → 路径选择 → 规划 → 实施授权 → 实施 → 验证与团队审核 → 关闭授权 → formal close。
- 本文件只规定本仓库 AI 的上下文加载、冲突处理、授权停点、证据、工具和发布边界，不独立定义生命周期。`/opsx:explore` 的完整触发、范围、退出、停点、豁免和命令回退规则以主流程为准。

## 上下文加载顺序

1. 先读取根目录 `SPEC.md` 定位受影响 capability 与活动 change。
2. 只加载 `openspec/specs/` 下受影响的当前规格。
3. 加载修改相同 capability 的活动 changes；需要 Requirement 级历史时读取 `openspec/change-history.json`。
4. 需要历史依据时优先读取无路径 `openspec/change-history.json`；只有本地详细 archive 存在且回归、冲突或设计依据确有需要时才读取它。
5. BR/PRD 表达外层产品目标，specs 表达可执行行为。

## 工作流与技能协作

- 对代码、产品行为或系统行为的变更，本工作流是本项目唯一的 change 交付生命周期。安装的 OpenSpec 原生 explore/propose/update/apply/sync skills 是该生命周期的主要执行机制；其他 workflow 或 skill 只能作为当前 change 内按需加载的有界辅助，不得建立并行的需求、实施或关闭流程，也不得绕过 artifacts 与 change-scoped 授权。
- 系统、开发者、用户指令以及项目强制的安全、发布、迁移、运维和领域规则继续按既有优先级生效；专项规则需要的步骤与证据应纳入当前 change。
- 只在用户明确要求、平台规则触发或当前任务确有需要时读取对应 skill，不预加载无关 skills。skill 输出是辅助分析，不自动成为需求事实、验证证据或授权。
- 发现其他 workflow、skill 或项目指引与本流程实质冲突时，AI 必须及时说明冲突来源、具体规则、影响、适用优先级和建议方案。无法按优先级消解或选择会实质改变交付时，停止相关实施并等待用户决定。
- GitNexus 推荐但可选。用于大型或陌生仓库的探索、影响分析、调试或重构前，先确认仓库上下文与索引新鲜度，再按任务加载匹配能力；不可用时回退到代码搜索、调用关系检查和测试。GitNexus 结果不替代 specs、源代码、测试、verification 或团队审核，也不构成 CI 或 formal close 门禁。

## 路径与规划执行约束

- 按主流程第 3、4 节选择 bugfix、system-change 或 product-change，并使用对应 Schema graph；不得用代码量替代行为与治理面判断。
- 新的实质需求优先使用 `.agents/skills/openspec-explore`；system-change 通过原生 propose skill 显式选择 `spec-driven`，product-change 显式选择 `product-change`，二者的规划更新和实施分别使用原生 update/apply skill。所有 OpenSpec CLI 调用使用项目内 launcher，不使用 PATH 中版本不明的全局命令。
- product-change 启动前完成共享 BR/PRD 属于团队流程治理，不由 Schema、脚本或 CI 强制；change-local BR/PRD、planning artifacts 和 artifact graph 仍按主流程与 Schema 执行。
- 调研导致范围跨越路径边界时，先调整路径和规划；如果 planning artifacts 已实质修改，必须重新执行实施授权停点。

## 实施授权治理

- 对当前 Schema 的 apply-required artifacts 及其依赖闭包，生成完成或发生实质修改后，AI 必须结束当前执行轮次，展示准确的 change ID 与计划摘要，等待用户在后续消息中明确授权。包含 Requirement delta 时，计划摘要还必须展示本次新增、沿用、重命名和冲突的 stable ID 结论。product-change 的授权提示还要求 change-local `br.md` 与 `prd.md` 已生成。
- 原始开发请求、创建 change、生成 artifacts、`/opsx:continue`、`/opsx:ff` 或普通“继续”均不构成实施授权。
- 用户在后续消息中执行 `/opsx:apply <change>`、明确表达“确认实施 <change>”，或对只包含一个明确 change 的授权问题作出无歧义确认，即授权实施该 change。授权不适用于其他 change。
- proposal、specs、design 或 tasks 的范围、行为、技术决策、工作分解发生实质修改后，旧授权失效，必须重新展示摘要并等待授权；仅格式调整、链接修复、证据附加或 checkbox/状态备注不使授权失效。
- 以上规则属于 AI 与团队应遵守的流程治理，不创建 approval artifact，也不由 Schema、脚本或 CI 强制证明。

## 事实来源

- 共享 BR/PRD/FEATURE：`docs/requirements/REQ-*/`。
- 当前行为：`openspec/specs/<capability>/spec.md`。
- 本次行为增量：`openspec/changes/<change>/specs/<capability>/spec.md`。
- 技术设计：本 change 唯一的 `design.md`。
- 实现状态：源代码、`tasks.md` 和验证证据。
- 导航与历史：生成的 `SPEC.md` 与 `openspec/change-history.json` v1；后者只持久化已归档演变摘要，不含活动 change 或 artifact 路径，不得手工编辑。

## 流程治理规则与程序门禁

流程治理规则依靠团队评审与协作执行；程序门禁仅指 Schema、脚本或 CI 实际校验的检查。二者都应遵守，但执行方式不同。

- 可执行验收场景只写在 specs 中。
- 生成或实质修改 delta Requirement 前，AI 与团队必须盘点同 capability 的 canonical spec、修改该 capability 的全部活动 changes，以及 `openspec/change-history.json` 中的 Requirement-level 历史。ADDED 不得复用已分配给不同逻辑 Requirement 的 ID；数字后缀默认使用同 capability/prefix 已见最大值加一。MODIFIED 必须沿用 stable ID；只改名称的 RENAMED 必须沿用 stable ID。只有纠正确认错误时才允许 RENAMED 更换 ID，并记录冲突来源、新 ID 依据和历史保留方式。该分配/冲突结论必须进入计划摘要和关闭审核；其语义正确性仍由团队评审，不由 Schema、脚本、CLI、CI 或 formal close 强制证明。
- 历史修订由新的 delta change 表达；详细本地 archive 若存在也不得用来改写历史结论。
- 实现证据不存在时，不在 FEATURE 中宣称 ready；FEATURE ready 也不等于 change 已完成关闭。
- 每个 change 应在 `openspec/changes/<change>/verification.md` 记录实际交付范围、详细测试用例、预期与实际结果、安全/迁移/浏览器/回滚适用性、未完成项、限制、回滚信息和安全的 evidence 引用；补充材料可放在同目录 `evidence/`。大型或敏感材料只记录摘要和安全外部引用。
- `verification.md` 和 `evidence/` 是团队评审材料，不加入 OpenSpec artifact graph，也不由 Schema、脚本、CLI 或 CI 强制存在、解析或判断充分性。不得创建新的 `closeout.json`；下游项目若仍有历史 `closeout.json`，新流程会忽略但不会由安装器删除其 change 记录。
- 团队负责审核 tasks 完成情况、证据充分性、四项风险适用性、Requirement/PRD/FEATURE 真实性和稳定 ID。AI 应继续所有可实现 task；无法实现、取消或延期的项必须说明原因、交付影响、相关声明影响和后续安排，并先修正不再真实的声明。
- 实施授权不构成关闭授权。AI 代为关闭前必须展示准确 change ID、已交付/验证范围、Requirement stable ID 分配/沿用/重命名/冲突结论、证据摘要、未完成 tasks、限制、风险决策和收尾计划，然后结束当前轮次并等待后续明确的“确认关闭 <change>”或等价授权。该规则不创建 approval artifact，也不由程序或 CI 证明。
- 安装的 `openspec-archive-change` skill 是本项目治理 wrapper；正常关闭不得直接运行原生 archive skill、`node bin/openspec.js archive` 或手工移动 change。
- `node dist/bin/workflow.js close <change> --target .` 是源码仓库唯一正式关闭入口；安装目标使用 `node bin/workflow.js close <change> --target .`。它只通过固定运行时执行 strict validation 与 OpenSpec archive，再做索引/历史重建和治理检查；不读取 tasks、verification、evidence、BR/PRD/FEATURE 或历史 closeout。正常路径由 archive 应用 delta；只有已经提前 sync 的恢复场景才传入 `--skip-specs`。
- 本项目不再提供 `validate:close` 或独立关闭预检。`validate:changes` 仍枚举全部活动 change 并逐项执行 OpenSpec strict validation；它不判断 change 是否完成或是否应关闭。
- 提交前运行 `npm run validate:changes`；安装目标运行 `node scripts/validate-changes.js`。该命令从文件系统枚举全部活动 change，并逐项通过项目内固定运行时执行 strict validation。
- 已归档 change 的内容按团队流程不得修改。该规则依靠团队评审与协作执行；本项目不要求、也不承诺通过 base ref、full history、hash、脚本或 CI 强制证明归档不可变。
- 本工作流源仓库的活动/归档 change 详情、编号 `docs/requirements/REQ-*`、`artifacts/**`、GitNexus 索引、AI 规划记录、工作流备份、隔离 worktree、测试临时输出和日志受根 `.gitignore` 排除，不进入正常 staged/tracked 集合；正式关闭仍会先把本地归档摘要合入 history v1。维护者提交前应复核 staged/tracked 路径，不得故意强制加入这些资料；本项目不要求 CI、脚本或 hook 阻止有权限的维护者显式绕过。安装器不得复制该排除策略，下游项目自行决定是否跟踪完整过程记录。旧 Git 提交不在本变更中重写。

## 工具边界

本工作流源码统一为 TypeScript，`dist/` 只作为不跟踪的构建产物。贡献者使用 Node.js `>=20.19.0`、固定 OpenSpec `1.8.0`、`npm ci`、`npm run build` 与 `npm run verify`；安装目标通过 `node bin/openspec.js` 使用受管运行时，只运行 emitted JavaScript，不依赖 TypeScript 或全局 OpenSpec。
