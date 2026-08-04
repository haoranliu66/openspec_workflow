# AI 全栈 OpenSpec 工作流

## 1. 目标

本工作流把产品目标、可执行行为、实现计划、验证记录和历史导航分层管理。OpenSpec 负责 change artifact graph、strict validation 和 delta archive；团队负责判断需求、实现和证据是否真实充分。

对代码、产品行为或系统行为的变更，本工作流是项目唯一的 change 交付生命周期。其他 workflow 或 skill 只在用户、平台或当前任务需要时作为 change 内的有界辅助；安全、发布、迁移、运维和领域强制规则继续按既有优先级生效。

若辅助 workflow、skill 或项目指引与本流程实质冲突，AI 必须说明冲突来源、具体规则、交付影响、适用优先级和建议方案。可以兼容时把专项步骤纳入当前 change；无法消解或选择会改变范围、风险或结果时，停止相关实施并等待用户决定。

## 2. 文档权威与分层

`README.md` 和 `docs/` 是下游开发者理解、安装和使用本工作流的唯一文档表面。开发者从 README 进入本文件即可完成完整旅程，不需要阅读 `SPEC.md`、`openspec/specs/**`、活动 change 或本地 archive。后述规格与过程记录是 AI、OpenSpec 和交付团队使用的事实或证据，不是另一套使用手册。

| 层级 | 位置 | 责任 |
|---|---|---|
| 共享 BR/PRD/FEATURE | `docs/requirements/REQ-*/` | 产品目标、结果级验收和已交付结论 |
| 当前规格 | `openspec/specs/<capability>/spec.md` | 当前可执行行为事实 |
| change delta | `openspec/changes/<change>/specs/<capability>/spec.md` | 本次行为增量 |
| 技术设计 | `openspec/changes/<change>/design.md` | 本次技术决策 |
| 实现计划 | `openspec/changes/<change>/tasks.md` | 实施与验证任务 |
| 验证记录 | `openspec/changes/<change>/verification.md`、可选 `evidence/` | 团队审核使用的测试、证据、风险和限制 |
| 导航与归档摘要 | `SPEC.md`、`openspec/change-history.json` v1 | AI 导航以及已归档 change/Requirement 操作摘要，不是下游使用文档 |

`verification.md` 不是 OpenSpec artifact，也不是机器合同；Schema、脚本、CLI 和 CI 不强制其存在、格式或充分性。公开历史与当前文档的职责固定为：

| 载体 | 唯一职责 |
|---|---|
| `README.md` 与 `docs/` current docs | 描述当前安装和使用方式，不承担完整历史 |
| `CHANGELOG.md` | 人类可读的发行记录与能力演变 |
| `openspec/change-history.json` | 已归档 change 与 Requirement operation/ID/name 的无路径摘要 |
| 本地 `openspec/changes/archive/**` | 团队不可变的详细过程记录，不进入公开发布内容 |

完整的受众、权威范围、同步关系与新增文档准入规则见 [`DOCUMENTATION_MAP.md`](DOCUMENTATION_MAP.md)。

## 3. 路径选择

### `bugfix`

仅用于恢复已确认行为，且不新增 Requirement、不改变流程、角色、公共接口或业务规则。artifact graph 为 `proposal -> specs -> tasks`。

### `system-change`

用于有限、可观察且不涉及产品治理面的系统行为变化。治理名称是 system-change，metadata 必须使用 OpenSpec `1.5.0` 内置的 `schema: spec-driven`。原生 graph 为 `proposal -> {specs ∥ design} -> tasks`。

### `product-change`

产品目标、用户旅程、角色权限、业务规则、公共契约或共享产品验收任一发生变化时使用。团队应先完成共享 BR/PRD；change 内保留 BR/PRD 绑定，原生核心仍是 `proposal -> {specs ∥ design} -> tasks`。

路径按行为和治理面选择，不按代码行数选择。范围扩大时，bugfix 升级为 system-change 或 product-change；system-change 触及任何产品治理面时升级为 product-change。

## 4. 统一生命周期

唯一顺序固定为：

> 需求进入 → explore → 路径选择 → 规划 → 实施授权 → 实施 → 验证与团队审核 → 关闭授权 → formal close

任何指南、示例、AI 指引、配置或 skill 都不得改变顺序、跳过授权停点或建立平行生命周期。

### 4.1 需求进入

用户提出新增或实质修改代码、产品行为或系统行为的需求后，AI 先识别请求目标、现有上下文以及是否属于明确的后续生命周期动作。原始开发请求本身既不是实施授权，也不是关闭授权。

### 4.2 Explore

对于新的或发生实质变化的代码、产品行为或系统行为需求，AI 默认进入只读 `/opsx:explore` 思考姿态，然后才选择路径或创建、实质修改 change。探索应与请求复杂度相称，并至少检查：

- 活动 OpenSpec change 与可能冲突的并行工作；
- 相关 current specs、必要的 Requirement history 与共享产品上下文；
- 为判断可行路线必须读取的代码、配置、接口或测试；
- 可行路线、行为边界、影响面、风险和会改变路径、范围或风险的关键未知项。

Explore 期间不得实施代码。它不是 artifact graph 阶段，不生成审批记录，也不新增 Schema、脚本、CLI、CI 或 formal-close 门禁。

- **路线明确**：AI 可以结束 explore，在同一执行轮次继续路径选择与规划；后续仍必须执行实施授权停点。
- **存在实质未知项**：如果不同答案会改变路径、交付范围或风险，AI 展示探索结论、可行路线及影响，然后等待用户决定，不得先假定并规划。
- **无需重复 explore**：纯问答、解释、阅读、状态查询、证据附加、checkbox/格式/链接等非实质调整、明确的 apply/close/index/check/validate 动作，以及继续已完成探索和规划且范围未实质改变的 change。
- **命令不可用**：AI 平台不能直接调用 slash command 时，执行等价只读探索并如实说明；不得声称 `/opsx:explore` 已实际运行。

### 4.3 路径选择

按第 3 节的行为与治理面规则选择 bugfix、system-change 或 product-change。代码量、文件数和预计工时不是主要判据。随后读取 `SPEC.md` 定位受影响 capability 和活动 changes，并按需加载当前规格、相关 change 与历史依据。

### 4.4 规划

生成所选 Schema 的完整 apply-required artifact 及其依赖闭包。product-change 还必须生成 change-local `br.md` 与 `prd.md`。存在 Requirement delta 时，盘点 stable ID 并记录新增、沿用、重命名和冲突结论。

### 4.5 实施授权

规划包生成完成或发生实质修改后，AI 展示准确 change ID、范围、可观察行为、关键决策、风险、任务摘要及 stable ID 结论，然后结束当前轮次。只有用户在后续消息中通过 `/opsx:apply <change>`、`确认实施 <change>` 或针对唯一明确 change 的无歧义确认，才授权实施该 change。普通“继续”和 artifact 生成不构成授权；规划发生实质修改后必须重新授权。

### 4.6 实施

获得 change-scoped 授权后，按 `tasks.md` 实施，并运行与真实改动面匹配的测试和质量检查。调试、影响分析、代码评审或发布 skill 只能作为本 change 内的有界辅助，不能建立新的 artifacts、授权或关闭路径。

### 4.7 验证与团队审核

在 change 内编写 `verification.md`，必要时增加 `evidence/`；披露实际交付范围、测试结果、风险适用性、未完成 tasks、限制和回滚。product-change 只把有实现、验证和团队审核依据的结论更新到共享 `FEATURE.md`。团队负责判断证据和声明是否真实充分。

### 4.8 关闭授权

AI 展示准确 change ID、已交付与测试范围、证据摘要、stable ID 结论、未完成 tasks、限制、security/migration/browser/rollback 决策、产品声明和收尾计划，然后结束当前轮次。只有用户在后续消息中明确表达 `确认关闭 <change>` 或等价指令，才授权关闭该 change。实施授权、tasks 完成、verification 生成、提前 sync 或普通“继续”都不构成关闭授权。

### 4.9 Formal close

获得关闭授权后运行 `workflow close <change>`，按第 6 节完成 strict validation、archive、索引/历史重建和治理检查。formal close 不重复团队的完成性或证据充分性判断。

实施授权和关闭授权相互独立，且都只适用于明确的 change。它们属于团队/AI 治理，不创建 approval artifact，也不由 CI 证明。GitNexus 仍是大型或陌生代码库中的可选辅助：先检查仓库上下文与索引新鲜度，按任务使用；不可用时回退到代码搜索、调用关系检查和测试。

## 5. 验证记录与团队审核

推荐的 `verification.md` 至少覆盖：

- 实际交付范围以及未交付范围；
- Requirement、PRD 验收和 FEATURE 结论的人工追踪；
- Requirement stable ID 的盘点来源、分配/沿用/重命名结果和已解决或未解决冲突；
- 测试用例 ID、场景、命令或步骤、预期结果、实际结果和结论；
- security、migration、browser、rollback 的适用性和审核结论；
- 未完成、取消或延期 tasks 的原因、交付影响、声明影响和后续安排；
- 已知限制、回滚方式以及安全的 evidence 引用。

大型测试报告、视频或日志可以保存在外部 CI/artifact 系统并链接。密钥、令牌、个人信息和其他敏感数据不得提交到 change。

团队负责判断验证是否充分、N/A 是否合理、声明是否真实以及是否允许关闭。formal close 不读取这些文件，也不检查 tasks checkbox、产品追踪或风险矩阵。

## 6. 关闭与 sync

源码仓库：

```bash
node dist/bin/workflow.js close <change> --target .
```

安装目标：

```bash
node bin/workflow.js close <change> --target .
```

formal close 的固定顺序是：

1. `openspec validate <change> --strict`；
2. `openspec archive <change> --yes --json`；
3. 重建 `SPEC.md` 和 `openspec/change-history.json`；
4. 运行治理检查。

index 会把新本地归档合入 pathless history v1；以后即使详细 archive 不在 checkout 中，摘要仍会稳定保留。history JSON 不是严格 pathless v1、包含旧格式字段或无效时会停止而不是覆盖。

正常路径不提前执行独立 sync，archive 会应用 delta。只有 change 已经提前 sync 的恢复场景才传入 `--skip-specs`。项目不再提供 `validate:close` 或其他独立关闭预检。

archive 成功但 index/check 失败时，change 已经归档；修复问题后分别运行 `workflow index` 与 `workflow check`，不要重复 archive。

## 7. AI 最小上下文协议

1. 读取 `SPEC.md`。
2. 读取受影响的当前 capability specs。
3. 读取修改相同 capability 的活动 changes。
4. 需要 Requirement 级历史时查询 `openspec/change-history.json`。
5. 只有本地详细 archive 存在，且回归、冲突或设计依据确有需要时才读取它；公开上游 checkout 通常没有这些目录。
6. product-change 在范围冲突时读取共享 BR/PRD；bugfix/system-change 不创建共享产品文档。

### Stable Requirement ID 分配

生成或实质修改 delta Requirement 前，必须盘点同 capability 的 canonical spec、相关活动 changes 和 `openspec/change-history.json` Requirement-level 历史：

- ADDED 不得复用已属于不同逻辑 Requirement 的 ID；数字后缀默认取同 capability/prefix 已见最大值加一；
- MODIFIED 沿用现有 stable ID；
- 只改名称的 RENAMED 沿用 stable ID；
- 只有纠正确认错误时，RENAMED 才能使用不同 TO ID，并记录冲突来源、新 ID 依据及不可变历史处理；
- 计划摘要和关闭审核均展示分配与冲突结论。

这是 AI/团队治理，不创建 ID registry，也不由 Schema、脚本、CLI、CI 或 formal close 强制证明。history 中 MODIFIED/RENAMED 合法重复同一 ID，因此不能用简单的全局重复计数替代语义审核。

## 8. 升级与历史边界

- 新规则通过新的 delta change 演进，不改写历史摘要或已有本地 archive。
- current docs 只描述当前安装与使用；人类可读的发行和能力演变写入 `CHANGELOG.md`，不得把旧条目当作现行操作手册。
- `change-history.json` v1 只发布 archived change ID、日期、Schema、capability 和 Requirement operation/ID/name；legacy 完整 v1 与 v2 不再兼容，活动 change 和 artifact 路径不会持久化。
- 本地 archive 是不可变的详细过程记录，不公开；历史错误通过新的 delta change 修正，不改写既有 archive。
- 本工作流源仓库的详细 change/archive、编号 REQ、evidence 及其他工具/规划输出由根 `.gitignore` 在正常 Git 操作中排除；维护者提交前复核 staged/tracked 路径，不得主动强制加入。本项目不新增 CI、脚本或 hook 来阻止显式绕过，旧 Git 提交也不重写。下游项目若保留历史 `closeout.json`、local FEATURE 或 evidence，新命令会忽略但安装器不会删除这些项目记录。
- 安装器升级只退役旧 manifest 明确拥有的 closeout 脚本、库和模板；退役前创建备份。
- 未受管同名文件以及 `openspec/changes/**`、`artifacts/**` 永不进入退役目标。
- 安装器不复制源仓库 `.gitignore`，下游团队自行决定是否跟踪自己的 REQ/change/archive/verification/evidence。

## 9. 完成定义

- 代码、文档、配置和测试与当前 change 一致。
- 适用测试和质量检查已执行，结果真实记录。
- 未完成项、限制、风险和回滚已向团队披露。
- product FEATURE 只包含有依据的已交付结论。
- 团队已审核验证材料并明确授权关闭。
- formal close 完成 strict/archive/index/check。
