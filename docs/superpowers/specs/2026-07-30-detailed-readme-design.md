# 完整 README 设计

**日期：** 2026-07-30

**状态：** 已确认，待实施

**目标文件：** `README.md`

## 1. 目标

将根 README 从摘要型说明扩展为面向项目接入团队的自包含使用指南。读者应当只阅读 README 就能：

1. 判断本工作流是否适合项目；
2. 安装源仓库并把工作流安装到目标项目；
3. 正确选择 `bugfix` 或 `product-change`；
4. 完成首个 change 的创建、artifact 编写、实现、验证和关闭；
5. 区分团队流程治理规则与程序实际强制的门禁；
6. 理解 closeout warning、blocking diagnostics 和恢复路径；
7. 接入 CI，并知道何时查阅专项文档。

README 不替代专项规范文档，而是提供完整的端到端主路径和可搜索的参考入口。

## 2. 受众与语言

### 2.1 主要受众

主要面向准备把本工作流接入业务项目的团队，包括：

- 技术负责人和架构师；
- 使用 AI 实施 change 的开发者；
- 审核需求、证据和关闭状态的产品或交付负责人；
- 配置 CI 和升级工作流的工程人员。

仓库维护者信息作为末尾附录，不占据主路径。

### 2.2 语言

- 中文为主；
- 命令、文件名、Schema 名、diagnostic code 和必要技术术语保留英文；
- 首次出现的重要术语给出简短中文解释；
- 不制作全文中英双语副本。

### 2.3 命令平台

- PowerShell 作为主示例；
- Bash 提供等价的路径和命令写法；
- Node.js、npm 和 OpenSpec 命令保持跨平台；
- 不假设目标项目位于特定盘符或固定目录。

## 3. 信息架构

README 采用生命周期导向，并在末尾提供参考手册式速查。

### 3.1 顶部导航

顶部包含：

- 一句话定位；
- 当前版本与环境要求；
- 适用场景和非目标；
- 可点击目录；
- “五分钟快速开始”入口。

### 3.2 正文章节

按以下顺序组织：

1. 项目定位与解决的问题；
2. 核心原则与治理边界；
3. 五分钟快速开始；
4. `bugfix` 与 `product-change` 选择；
5. artifact graph 与事实来源；
6. 完整交付生命周期；
7. `tasks.md`、质量证据与 FEATURE；
8. 单 change 关闭流程；
9. task warning 与强制门禁边界；
10. 源仓库和安装目标命令速查；
11. CI 接入；
12. 安装器行为、冲突与备份；
13. 目录结构和文件职责；
14. 升级、历史与归档规则；
15. 常见错误与排障；
16. 维护者验证、相关文档与许可证。

### 3.3 可视化

只使用两张必要的 Mermaid 图：

1. `bugfix` 与 `product-change` 路径选择图；
2. product change 从团队 BR/PRD 治理到 closeout 的生命周期图。

图示只表达关系和顺序，不重复正文中的完整规则。

## 4. 事实口径

README 必须保持以下治理边界。

### 4.1 产品治理与 artifact graph

- 共享 BR/PRD 表达 change 外的产品目标；
- 团队应在启动 product change 前完成并确认共享 BR/PRD；
- 该前置顺序属于团队流程治理，不进入 OpenSpec artifact graph，也不由 Schema、脚本或 CI 强制；
- `proposal` 是原生 graph 的独立 root；
- product change 中，`proposal` 完成后 `specs` 与 `design` 并行解锁，`tasks` 等待二者，`apply` 跟踪 `tasks.md`；
- bugfix 只适用于边界明确、预期行为已确认且不改变流程、角色、接口或业务规则的缺陷。

### 4.2 事实来源

README 用表格说明：

- 共享 BR/PRD/FEATURE：`docs/requirements/REQ-*/`；
- 当前行为：`openspec/specs/<capability>/spec.md`；
- 本次行为增量：活动 change 的 delta specs；
- 技术设计：本 change 唯一的 `design.md`；
- 实现状态：源代码、`tasks.md` 与验证证据；
- 导航和历史：生成的 `SPEC.md` 与 `openspec/change-history.json`。

可执行验收场景只写在 specs；PRD 只保留结果级验收。

### 4.3 FEATURE 与关闭状态

- `feature` artifact ready 只表示可以开始记录交付；
- FEATURE 结论必须有真实实现和验证证据；
- FEATURE ready 不表示 change 已关闭；
- 未完成 task 使交付声明不再真实时，必须先修正 Requirement/FEATURE 相关声明。

### 4.4 task warning

- `[x]` 和 `[X]` 是已完成 task；
- 其他真实 checkbox marker 产生 `TASKS_INCOMPLETE` warning；
- warning 必须可见，但不设置失败退出码，也不阻止关闭；
- AI 应继续完成所有可实现的 task；
- 对无法实现、取消或延期的 task，AI 必须说明原因、交付影响、Requirement/FEATURE 影响和后续安排，并在运行 `workflow close` 前取得用户明确确认；
- 用户确认属于团队流程治理，不由 Schema、脚本或 CI 强制证明；
- 不宣传 waiver、approval 字段或 `--allow-incomplete-tasks` 参数。

### 4.5 blocking gates

以下行为继续阻止关闭：

- `tasks.md` 缺失、不可读或没有真实 checkbox，产生 `TASKS_INVALID`；
- closeout JSON 缺失、格式错误或不满足对应 Schema；
- evidence artifact 不存在、逃逸项目根目录或不是普通文件；
- security、migration、browser、rollback 适用矩阵不完整；
- 适用 gate 没有 matching passed evidence；
- product change 的 FEATURE/evidence 与 Requirement/PRD acceptance 引用不完整；
- bugfix 的 delta Requirement ID 不稳定；
- OpenSpec strict validation 失败。

程序只证明结构、引用、文件存在和声明证据，不判断语义正确性、证据充分性或 N/A 理由合理性。`closeout.json.command` 只记录，不执行。

### 4.6 归档边界

- 已归档 change 不得修改是团队治理规则；
- 不宣称通过 base ref、full history、hash、脚本或 CI 强制证明归档不可变；
- 历史修订由新的 delta change 表达；
- `SPEC.md` 和 `openspec/change-history.json` 是生成文件，不手工编辑。

## 5. 快速开始与操作示例

### 5.1 环境要求

明确列出：

- Node.js `>=20.19.0`；
- Git；
- `@fission-ai/openspec@1.5.0`；
- npm；
- 源仓库贡献者需要 TypeScript 构建环境，安装目标不需要 TypeScript。

### 5.2 安装路径

快速开始分为：

1. 克隆或进入源仓库；
2. `npm ci`；
3. `npm run verify`；
4. 使用 emitted CLI 把工作流安装到目标项目；
5. 在目标项目运行 schema、index 和 check 验证。

PowerShell 与 Bash 分别给出可复制示例。

### 5.3 首个 bugfix

示例展示：

1. 创建 `bugfix` change；
2. 读取 status 和下一 artifact instructions；
3. 编写 proposal、delta spec 和 tasks；
4. 实现并记录适用验证；
5. 准备 closeout；
6. 运行单 change 关闭校验；
7. 使用标准 wrapper 关闭。

示例不伪造实际业务内容，不把 bugfix 用于新增业务规则。

### 5.4 首个 product change

示例展示：

1. 团队先完成并确认共享 BR/PRD；
2. 创建 `product-change`；
3. 完成 proposal；
4. 并行完成 specs 和 design；
5. 生成 tasks 并实施；
6. 记录 FEATURE 与 evidence；
7. 准备 closeout；
8. 校验并关闭。

README 说明 artifact 解锁顺序，但不复制 schema 文件全文。

### 5.5 closeout JSON

只展示字段级精简示例，重点解释：

- `version`；
- product change 的 `prd`、`sharedFeature`、`requirements` 与 `featureResults`；
- `evidence`；
- 四项 `gates`；
- `command` 仅记录；
- 完整模板链接到 `docs/closeout-templates/`。

## 6. 命令参考

用两张表区分源仓库和安装目标。

每条命令说明：

- 用途；
- 必需参数；
- 主要输出或副作用；
- 是否枚举全部 changes；
- 是否归档；
- 何时使用。

重点区分：

- `validate:changes`：枚举所有活动 change 并逐项 strict validation；
- `validate:close <change>`：只验证显式指定的单个活动 change；
- `workflow close <change>`：校验、归档、重建索引和治理检查；
- `--skip-specs`：只在此前已经 sync 时使用；
- `index` 与 `check`：分别重建和核对生成文件。

## 7. CI 与安装器

### 7.1 CI

README 提供最小 GitHub Actions 风格示例，但只使用仓库已有命令：

1. Node.js 20.19 或兼容版本；
2. `npm ci`；
3. `npm run verify`。

说明 `verify` 覆盖 build、compiled tests、index、check、schema validation 和全部活动 changes 的 strict validation。

### 7.2 安装器

说明：

- 目标已有 `openspec/config.yaml` 时不覆盖，而生成合并示例；
- 其他受管文件冲突时默认整批拒绝；
- `--force` 会先备份再覆盖；
- 安装目标只接收 emitted JavaScript；
- 运行时不新增第三方依赖。

## 8. 排障设计

诊断表至少包含：

| Code / 现象 | 含义 | 是否阻止关闭 | 修复方向 |
|---|---|---:|---|
| `CHANGE_NOT_ACTIVE` | change 不在活动目录或 ID 非法 | 是 | 检查 change ID 和目录 |
| `SCHEMA_UNSUPPORTED` | Schema 缺失或不受支持 | 是 | 使用 `bugfix` 或 `product-change` |
| `CLOSEOUT_MISSING` | closeout 文件缺失或不可读 | 是 | 根据模板创建文件 |
| `CLOSEOUT_INVALID` | closeout JSON 不满足契约 | 是 | 修正 JSON 与 Schema 字段 |
| `TASKS_INCOMPLETE` | 存在未完成真实 checkbox | 否 | 继续可行任务或完成用户确认治理 |
| `TASKS_INVALID` | tasks 缺失、不可读或无 checkbox | 是 | 修复 `tasks.md` 结构 |
| `EVIDENCE_INVALID` | evidence artifact 无效 | 是 | 使用项目内真实普通文件 |
| `GATE_INVALID` | 门禁矩阵或 evidence 引用无效 | 是 | 修正适用性和 matching evidence |
| `REQUIREMENT_INVALID` | delta Requirement ID 不稳定 | 是 | 补充稳定 ID |
| `PRD_TRACE_INVALID` | PRD acceptance 引用不完整 | 是 | 修正映射 |
| `FEATURE_TRACE_INVALID` | FEATURE/evidence 引用不完整 | 是 | 修正结果和 evidence |

另外说明：

- strict validation 失败；
- 安装冲突与 `--force`；
- archive 已成功但 index/check 失败时的恢复命令；
- 错误使用 `--skip-specs` 的风险。

## 9. 目录结构与相关文档

README 提供精简目录树并解释：

- `bin/`、`lib/`、`scripts/`、`tests/`；
- `openspec/schemas/`；
- `openspec/specs/`、`openspec/changes/`；
- `docs/requirements/`；
- `docs/closeout-templates/`；
- 生成文件和不跟踪的 `dist/`。

末尾链接：

- `docs/FULLSTACK_WORKFLOW.md`；
- `docs/QUALITY_GATES.md`；
- `docs/ADOPTION.md`；
- `docs/OPERATIONS.md`；
- `CHANGELOG.md`；
- `LICENSE`。

## 10. 验收与验证

README 修改完成后执行：

1. `npm run verify`；
2. `git diff --check`；
3. 核对 README 中所有 npm script 与 `package.json` 一致；
4. 核对 Node.js、OpenSpec 和项目版本；
5. 核对内部链接和目标文件存在；
6. 搜索旧的“所有 tasks 完成是程序硬门禁”等冲突文案；
7. 确认没有把团队确认、BR/PRD 前置或归档不可变误写成程序能力。

不新增只断言固定说明文案的字符串测试。现有真实命令、schema、安装和 closeout 测试继续作为行为证据。

## 11. 非目标

本次不：

- 修改 TypeScript 生产代码；
- 修改 OpenSpec schemas、artifact graph 或模板；
- 增加 CLI 命令、参数或依赖；
- 修改专项文档的治理规则；
- 手工编辑 `SPEC.md` 或 `openspec/change-history.json`；
- 制作单独英文 README；
- 把 README 变成所有专项文档的逐字副本。

## 12. 文件范围

实施阶段只修改：

- `README.md`

设计阶段新增本文档。若验证发现其他文件中的既有事实与 README 冲突，应先报告并取得范围确认，而不是顺手改写。
