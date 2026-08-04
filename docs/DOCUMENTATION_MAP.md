# 文档权威地图

本页定义公开 checkout 中每类文档的职责。出现冲突时，先按“事实优先级”判断，再修改所有受影响的当前文档；不要把旧开发过程记录当作现行规则。

## 事实优先级

1. `openspec/specs/<capability>/spec.md`：当前可执行行为。
2. CLI、Schema、模板和 TypeScript 实现：实际程序接口与 artifact graph。
3. `docs/FULLSTACK_WORKFLOW.md` 与 `docs/QUALITY_GATES.md`：团队流程和程序/人工边界。
4. `README.md`、`docs/ADOPTION.md`、`docs/OPERATIONS.md`：接入、使用和维护说明。
5. `CHANGELOG.md` 与 `openspec/change-history.json`：历史演变摘要，不是当前操作手册。

BR/PRD 仍是 product-change 的外层产品事实；它们不覆盖 capability spec 中的可执行行为，也不进入 OpenSpec 原生 artifact graph。

## 公开当前文档

| 文档 | 分类 | 权威范围 | 变更时必须联动检查 |
|---|---|---|---|
| `README.md` | 当前 / 入门 | 安装、三路径总览、双授权、关闭、命令和目录 | 所有公开指南、示例、链接 |
| `AGENTS.md` | 当前 / AI 治理 | 上下文加载、路径选择、实施与关闭授权、工具边界 | config、Schema apply instructions、完整流程 |
| `docs/AI_WORKFLOW_AGENTS.md` | 当前 / 安装目标 AI 治理 | 默认需求探索、唯一 change 生命周期、skill 边界、冲突处理和 GitNexus 协作 | 根 AGENTS、安装器、接入与完整流程 |
| `docs/AGENTS.root.example.md` | 当前 / 安装种子源 | 下游根 AGENTS 的最小合并样例；安装后由项目拥有 | 安装器、受管指南、接入说明 |
| `docs/FULLSTACK_WORKFLOW.md` | 当前 / 规范流程 | 三条路径的端到端团队工作流 | README、质量门禁、示例 |
| `docs/QUALITY_GATES.md` | 当前 / 质量边界 | 程序门禁与团队审核职责 | tests、CI、关闭实现 |
| `docs/ADOPTION.md` | 当前 / 接入 | 从 GitHub 安装、升级与下游所有权 | installer、README 安装段 |
| `docs/OPERATIONS.md` | 当前 / 运维 | index/check/validate/close、恢复和历史维护 | CLI、history generator、installer |
| `docs/DOCUMENTATION_MAP.md` | 当前 / 治理 | 文档分类、权威和审计范围 | 新增、删除或改名公开文档时更新 |
| `examples/core-workflow/README.md` | 当前 / 示例 | 一套贯穿三条路径的可复制演练 | 所有命令、Schema graph、授权和恢复变化 |
| `openspec/config.yaml` | 当前 / AI 上下文样例 | 安装目标可合并的 OpenSpec context/rules | AGENTS、Schema instructions |
| `openspec/schemas/**` | 当前 / 机器与 AI 契约 | bugfix/product-change artifact graph、模板和 apply 指令 | canonical specs、tests、流程指南 |
| `docs/requirements/_templates/**` | 当前 / 模板 | 下游共享 BR/PRD/FEATURE 包结构 | product-change 指南和示例 |

## 生成、规格与历史

| 文档 | 分类 | 规则 |
|---|---|---|
| `SPEC.md` | 生成导航 | 由 index 生成；链接 canonical specs 和本地 active change，已归档 change 仅显示无路径标签。不得手工编辑。 |
| `openspec/change-history.json` | 生成历史 | v1 仅保存 archived 演变摘要；不保存 active change、artifact 路径、验证或证据。不得手工编辑。 |
| `openspec/specs/**` | 当前规格 | 当前行为的最终事实来源；只通过新的 delta change 演进。 |
| `CHANGELOG.md` | 历史摘要 | 按版本说明公开契约演变；历史条目保持当时事实，不作为当前命令说明。 |

## 本地开发记录与发布边界

本工作流源仓库会在开发时产生以下详细记录；根 `.gitignore` 在正常 Git 操作中排除其内容：

- `openspec/changes/<change>/**`；
- `openspec/changes/archive/<dated-change>/**`；
- `docs/requirements/REQ-<number>-*/**`；
- `verification.md`、`evidence/` 和 `artifacts/**` 等过程 evidence；
- `.gitnexus/`、`docs/superpowers/{plans,specs}/`、工作流备份、隔离 worktree、测试临时输出和日志。

正式关闭先让 history v1 捕获归档摘要，再由根目录忽略规则保持正常 staged/tracked 集合精简。维护者提交前须复核 staged/tracked 路径，不得通过强制暂存主动发布这些资料；本项目不增加 CI、脚本或 hook 来保证阻止有权限的显式绕过。这个边界只约束最新 checkout，不重写旧 Git 提交；旧过程文件仍可能从历史提交恢复。

该边界仅适用于本上游源仓库。安装器不复制根 `.gitignore`，不删除或忽略下游项目自己的过程记录。下游团队应按审计、保密和协作要求自行决定保留策略。

## 文档变更检查清单

修改工作流行为、命令、Schema 或保留策略时：

1. 以 canonical spec 和实际 CLI/Schema 行为确认新事实。
2. 检查上表中所有“当前 / 示例”文档以及 requirements templates。
3. 更新 `CHANGELOG.md`，必要时更新 delta spec；不要改写旧历史描述来伪装一致。
4. 运行链接检查、tracked-file 清单检查、`npm run verify` 和 `git diff --check`。
5. formal close 后确认 `SPEC.md` 与 history v1 已重建，且公开导航不依赖详细 archive 路径。
