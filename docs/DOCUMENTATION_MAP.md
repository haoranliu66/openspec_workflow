# 文档权威地图

本页登记公开 checkout 中每类文档的受众、职责、权威范围与同步关系。`README.md` 和 `docs/` 是下游开发者唯一的安装与使用文档表面；AGENTS、配置、生成索引、specs 和 change artifacts 是 AI、机器或交付过程上下文，不要求下游开发者阅读。出现冲突时，先按“事实优先级”判断，再修改所有受影响的 current docs；不要把旧开发过程记录当作现行规则。

## 事实优先级

1. `openspec/specs/<capability>/spec.md`：当前可执行行为。
2. CLI、Schema、模板和 TypeScript 实现：实际程序接口与 artifact graph。
3. `docs/FULLSTACK_WORKFLOW.md`：唯一完整的下游生命周期，包括 OpenSpec 原生 `openspec-explore` 的全部治理规则。
4. `README.md`、`docs/QUALITY_GATES.md`、`docs/ADOPTION.md`、`docs/OPERATIONS.md`：入门摘要与专项说明；不得定义另一套完整生命周期。
5. `CHANGELOG.md` 与 `openspec/change-history.json`：历史演变摘要，不是当前操作手册。

BR/PRD 仍是 product-change 的外层产品事实；它们不覆盖 capability spec 中的可执行行为，也不进入 OpenSpec 原生 artifact graph。

## Current docs 与执行契约

| 文档 | 受众 / 分类 | 权威范围 | 变更时必须联动检查 |
|---|---|---|---|
| `README.md` | 下游开发者 / 入门 | 安装入口、统一生命周期摘要、三路径总览、命令和文档导航 | 所有下游指南、示例、链接 |
| `docs/FULLSTACK_WORKFLOW.md` | 下游开发者与团队 / 主流程 | 唯一完整的九阶段生命周期，以及原生 `openspec-explore` 的触发、范围、退出、停点和豁免规则 | README、AI 指引、质量门禁、采用、运维、示例、config、受管 skills |
| `docs/QUALITY_GATES.md` | 当前 / 质量边界 | 程序门禁与团队审核职责 | tests、CI、关闭实现 |
| `docs/ADOPTION.md` | 当前 / 接入 | 从 GitHub 安装、升级与下游所有权 | installer、README 安装段 |
| `docs/OPERATIONS.md` | 当前 / 运维 | index/check/validate/close、恢复和历史维护 | CLI、history generator、installer |
| `docs/DOCUMENTATION_MAP.md` | 当前 / 治理 | 文档分类、权威和审计范围 | 新增、删除或改名公开文档时更新 |
| `docs/AI_WORKFLOW_AGENTS.md` | AI / 受管执行约束 | 上下文加载、唯一权威、skill/冲突、授权停点、工具和项目所有权；引用主流程，不复制完整生命周期 | 根 AGENTS、根样例、安装器、主流程 |
| `docs/AGENTS.root.example.md` | AI / 安装种子源 | 下游根 AGENTS 的最小执行约束与权威引用；安装后由项目拥有 | 安装器、受管 AI 指引、采用说明 |
| `AGENTS.md` | AI / 上游项目约束 | 本仓库上下文加载、冲突、授权停点、验证、工具和发布边界；引用主流程 | 受管 AI 指引、config、Schema apply instructions |
| `examples/core-workflow/README.md` | 下游开发者 / 示例 | 一套贯穿三条路径的可复制演练；不独立定义生命周期 | 主流程、所有命令、Schema graph、授权和恢复变化 |
| `openspec/config.yaml` | AI / 上下文样例 | 安装目标可合并的项目事实与执行约束；引用主流程 | AGENTS、Schema instructions |
| `.agents/skills/openspec-*` | AI / 执行契约 | 固定 OpenSpec core skills 的项目内调用适配，以及 archive 治理 wrapper | OpenSpec 固定 commit、installer、主流程、AI 指引、运维 |
| `openspec/schemas/**` | 机器与 AI / 契约 | bugfix/product-change artifact graph、模板和 apply 指令 | canonical specs、tests、流程指南 |
| `docs/requirements/_templates/**` | 下游团队 / 模板 | 共享 BR/PRD/FEATURE 包结构，不是独立流程 | product-change 指南和示例 |

## 当前文档与历史职责

| 载体 | 公开性 | 唯一职责 | 禁止承担的职责 |
|---|---|---|---|
| `README.md` 与 `docs/` current docs | 公开 | 当前安装、使用、质量和维护方式 | 不保存完整演变史，不要求读者从历史推导现行规则 |
| `CHANGELOG.md` | 公开 | 人类可读的发行记录与能力演变 | 不作为当前命令或完整生命周期说明 |
| `openspec/change-history.json` | 公开 | v1 pathless archived change 与 Requirement operation/ID/name 摘要 | 不保存 active change、artifact 路径、验证、证据或详细设计；不得手工编辑 |
| `openspec/changes/archive/**` | 本地、不公开 | 团队不可变的详细 change、设计、tasks、verification 与 evidence 记录 | 不进入公开发布内容，不通过修改旧 archive 修正历史 |

相关内部事实载体：

| 载体 | 规则 |
|---|---|
| `SPEC.md` | 由 index 生成的 AI 导航；不得手工编辑，也不是下游使用文档。 |
| `openspec/specs/**` | 当前可执行行为的事实来源，只通过新的 delta change 演进；不是下游安装或使用说明。 |

## 新文档准入

新增文档必须同时满足以下条件：

1. 目标受众或职责与本地图中所有既有文档存在实质区别；仅因为规则“较新”、内容较长或维护者偏好拆分，不构成新职责。
2. 创建前或同一变更中在本地图登记路径、受众、分类、权威范围和必须联动检查的表面。
3. 明确它引用哪个既有权威，以及哪些内容不得在该文档中重新定义。
4. 如果既有权威文档已经覆盖该受众和职责，必须更新既有文档，不得新增“最新规则”“vNext 规则”或类似文件绕过同步。

删除、改名或合并文档时也必须同步更新本地图和所有入站链接。

## 本地开发记录与发布边界

本工作流源仓库会在开发时产生以下详细记录；根 `.gitignore` 在正常 Git 操作中排除其内容：

- `openspec/changes/<change>/**`；
- `openspec/changes/archive/<dated-change>/**`；
- `docs/requirements/REQ-<number>-*/**`；
- `verification.md`、`evidence/` 和 `artifacts/**` 等过程 evidence；
- `.gitnexus/`、AI 规划记录、工作流备份、隔离 worktree、测试临时输出和日志。

正式关闭先让 history v1 捕获归档摘要，再由根目录忽略规则保持正常 staged/tracked 集合精简。维护者提交前须复核 staged/tracked 路径，不得通过强制暂存主动发布这些资料；本项目不增加 CI、脚本或 hook 来保证阻止有权限的显式绕过。这个边界只约束最新 checkout，不重写旧 Git 提交；旧过程文件仍可能从历史提交恢复。

该边界仅适用于本上游源仓库。安装器不复制根 `.gitignore`，不删除或忽略下游项目自己的过程记录。下游团队应按审计、保密和协作要求自行决定保留策略。

## 文档变更检查清单

修改工作流行为、命令、Schema 或保留策略时：

1. 以 canonical spec 和实际 CLI/Schema 行为确认新事实。
2. 检查上表中所有 current docs、AI/机器契约、示例以及 requirements templates；主流程变化先更新 `docs/FULLSTACK_WORKFLOW.md`。
3. 更新 `CHANGELOG.md`，必要时更新 delta spec；不要改写旧历史描述来伪装一致。
4. 新增文档时先验证其独立受众或职责，并登记本地图；否则更新现有权威文档。
5. 运行链接检查、tracked-file 清单检查、`npm run verify` 和 `git diff --check`。
6. formal close 后确认 `SPEC.md` 与 history v1 已重建，且公开历史不依赖详细 archive 路径。
