# AI 交付指引

## 上下文加载顺序

1. 先读取根目录 `SPEC.md` 定位受影响 capability 与活动 change。
2. 只加载 `openspec/specs/` 下受影响的当前规格。
3. 加载修改相同 capability 的活动 changes；需要 Requirement 级历史时读取 `openspec/change-history.json`。
4. 需要历史依据时优先读取无路径 `openspec/change-history.json`；只有本地详细 archive 存在且回归、冲突或设计依据确有需要时才读取它。
5. BR/PRD 表达外层产品目标，specs 表达可执行行为。

## 工作流选择与 artifact graph

- 只有 Bug 边界明确、预期行为已确认、只恢复既有行为且不新增 Requirement 时，才使用 `bugfix`。
- 有限的可观察系统行为变化，若不改变产品目标、用户旅程、角色权限、业务规则、公共契约，也不需要共享产品验收，使用治理路径 `system-change`；实际 change metadata 必须写 `schema: spec-driven`。
- 新功能、管理台、跨角色流程，以及任何产品目标、用户旅程、角色权限、业务规则、公共契约或共享产品验收变化，使用 `product-change`，即使代码改动很小。
- 路径选择以行为和治理面为准，不以代码行数、文件数或预计工时为主要依据；无法确认是否涉及产品治理面时使用 `product-change`。
- 团队应在启动 product change 前完成并确认共享 BR/PRD。该顺序属于 change 外的流程治理，不进入 OpenSpec 原生 artifact graph，也不由 Schema、脚本或 CI 校验；`proposal` 仍是原生 graph 的独立 root。change 内 `proposal` 完成后，`specs` 与 `design` 并行解锁；`tasks` 等待二者，`apply` 跟踪 `tasks.md`。
- `system-change` 直接使用 OpenSpec `1.5.0` 内置 `spec-driven` graph：`proposal` 后并行解锁 `specs` 与 `design`，`tasks` 等待二者，`apply` 跟踪 `tasks.md`。本仓库不复制或安装 `spec-driven` Schema。
- 调研发现范围扩大时，从 bugfix 升级为 system-change 或 product-change；system-change 一旦触及产品治理面即升级为 product-change。

## 实施授权治理

- 对当前 Schema 的 apply-required artifacts 及其依赖闭包，生成完成或发生实质修改后，AI 必须结束当前执行轮次，展示准确的 change ID 与计划摘要，等待用户在后续消息中明确授权。product-change 的授权提示还要求 change-local `br.md` 与 `prd.md` 已生成。
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
- 导航与历史：生成的 `SPEC.md` 与 `openspec/change-history.json` v2；后者只持久化已归档演变摘要，不含活动 change 或 artifact 路径，不得手工编辑。

## 流程治理规则与程序门禁

流程治理规则依靠团队评审与协作执行；程序门禁仅指 Schema、脚本或 CI 实际校验的检查。二者都应遵守，但执行方式不同。

- 可执行验收场景只写在 specs 中。
- 历史修订由新的 delta change 表达；详细本地 archive 若存在也不得用来改写历史结论。
- 实现证据不存在时，不在 FEATURE 中宣称 ready；FEATURE ready 也不等于 change 已完成关闭。
- 每个 change 应在 `openspec/changes/<change>/verification.md` 记录实际交付范围、详细测试用例、预期与实际结果、安全/迁移/浏览器/回滚适用性、未完成项、限制、回滚信息和安全的 evidence 引用；补充材料可放在同目录 `evidence/`。大型或敏感材料只记录摘要和安全外部引用。
- `verification.md` 和 `evidence/` 是团队评审材料，不加入 OpenSpec artifact graph，也不由 Schema、脚本、CLI 或 CI 强制存在、解析或判断充分性。不得创建新的 `closeout.json`；下游项目若仍有历史 `closeout.json`，新流程会忽略但不会由安装器删除其 change 记录。
- 团队负责审核 tasks 完成情况、证据充分性、四项风险适用性、Requirement/PRD/FEATURE 真实性和稳定 ID。AI 应继续所有可实现 task；无法实现、取消或延期的项必须说明原因、交付影响、相关声明影响和后续安排，并先修正不再真实的声明。
- 实施授权不构成关闭授权。AI 代为关闭前必须展示准确 change ID、已交付/验证范围、证据摘要、未完成 tasks、限制、风险决策和收尾计划，然后结束当前轮次并等待后续明确的“确认关闭 <change>”或等价授权。该规则不创建 approval artifact，也不由程序或 CI 证明。
- `node dist/bin/workflow.js close <change> --target .` 是源码仓库唯一正式关闭入口；安装目标使用 `node bin/workflow.js close <change> --target .`。它只执行 `openspec validate <change> --strict`、OpenSpec archive、索引/历史重建和治理检查，不读取 tasks、verification、evidence、BR/PRD/FEATURE 或历史 closeout。正常路径由 archive 应用 delta；只有已经提前 sync 的恢复场景才传入 `--skip-specs`。
- 本项目不再提供 `validate:close` 或独立关闭预检。`validate:changes` 仍枚举全部活动 change 并逐项执行 OpenSpec strict validation；它不判断 change 是否完成或是否应关闭。
- 提交前运行 `npm run validate:changes`；安装目标运行 `node scripts/validate-changes.js`。该命令从文件系统枚举全部活动 change，并逐项执行 `openspec validate <change> --strict`。
- 已归档 change 的内容按团队流程不得修改。该规则依靠团队评审与协作执行；本项目不要求、也不承诺通过 base ref、full history、hash、脚本或 CI 强制证明归档不可变。
- 本工作流源仓库的活动/归档 change 详情、编号 `docs/requirements/REQ-*` 和 `artifacts/**` 受根目录规则排除，不进入公开 checkout；正式关闭仍会先把本地归档摘要合入 history v2。安装器不得复制该排除策略，下游项目自行决定是否跟踪完整过程记录。旧 Git 提交不在本变更中重写。

## 工具边界

本仓库源码统一为 TypeScript，`dist/` 只作为不跟踪的构建产物。贡献者使用 Node.js `>=20.19.0`、OpenSpec `1.5.0`、`npm ci`、`npm run build` 与 `npm run verify`；安装目标只运行 emitted JavaScript，不依赖 TypeScript。
