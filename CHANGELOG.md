# 变更日志

## 0.0.1 - 2026-08-03

首次公开发行 AI 全栈 OpenSpec 工作流。

### 核心工作流

- 将唯一生命周期固定为“需求进入 → explore → 路径选择 → 规划 → 实施授权 → 实施 → 验证与团队审核 → 关闭授权 → formal close”，并把 OpenSpec 原生 `openspec-explore` 完整规则融入主流程而非独立悬挂。
- 提供互斥的 `bugfix`、原生 `system-change`（`schema: spec-driven`）和 `product-change` 三条路径，按行为与产品治理面选择，不按代码量选择。
- product-change 保留共享 BR/PRD/FEATURE 外层治理和 change-local BR/PRD 绑定，并对齐原生 `proposal -> {specs, design} -> tasks` 核心 graph。
- 规划 artifacts 完成或发生实质修改后，AI 必须展示 change ID 与计划摘要，结束当前轮次并等待后续 change-scoped 实施授权。
- 实施后使用 change-local `verification.md` 和可选 `evidence/` 进行团队审核；实施授权不构成关闭授权，AI 必须再次展示验证、未完成项、风险与回滚摘要并等待明确关闭授权。
- `workflow close <change>` 只执行显式 change 的 OpenSpec strict validation、archive、SPEC/history 重建和治理检查；`--skip-specs` 仅用于 delta 已提前 sync 的恢复场景。
- 明确本工作流是代码、产品行为和系统行为变更的唯一 change 交付生命周期；其他 workflow/skill 仅作为按需的有界辅助，并要求披露无法静默消解的实质冲突。
- 新增或实质修改代码、产品行为或系统行为的需求默认先采用固定上游版本的原生 `openspec-explore`；system-change 与 product-change 共同使用原生 propose/update/apply skills，路径只通过 Schema 选择区分。

### 质量与治理边界

- `validate:changes` 从文件系统稳定枚举所有活动 changes，逐项执行 `openspec validate <change> --strict`，并汇总全部失败。
- 团队负责判断 tasks 完成情况、证据真实性与充分性、风险适用性、Requirement/PRD/FEATURE 追踪和关闭授权；Schema、脚本及 CI 不伪装成语义审核者。
- stable Requirement ID 在规划前盘点 canonical、相关活动 changes 与 history：ADDED 不复用、MODIFIED/普通 RENAMED 沿用，纠错 RENAMED 记录依据；计划摘要和关闭审核展示结论，但不增加程序门禁。
- 归档不可变和 product-change 启动前完成共享 BR/PRD 属于团队流程治理，不通过哈希、base ref 或 full-history 程序门禁强制证明。
- 不提供 `closeout.json` 合同、独立 `validate:close`、closeout JSON 模板或 tasks/evidence/gate/trace 自定义关闭校验器。

### 历史与公开仓库

- 明确 current docs 只描述当前使用方式，`CHANGELOG.md` 记录人类可读发行与能力演变，pathless history v1 记录归档 change/Requirement 操作摘要，本地 archive 保存不可变详细记录且不公开。
- 文档权威地图增加新文档准入：仅在受众或职责实质不同且完成登记时新增；不得用“最新规则”文件绕过既有权威文档更新。
- `SPEC.md` 提供确定性最小导航；`openspec/change-history.json` v1 只持久化 archived change 的日期、Schema、capability 和 Requirement operation/ID/name，不保存 active change 或 artifact 路径。
- history index 只接受严格 pathless v1 seed，支持本地 archive 合并、archive 缺失持久化、稳定去重排序，并在 legacy 完整 v1、v2、非法版本或结构漂移时写入前失败。
- 上游根 `.gitignore` 在正常 Git 操作中排除自身的活动/归档 change 详情、编号 REQ 开发包、artifacts、工具索引、AI 规划记录、备份、worktree、测试临时输出和日志；维护者提交前负责复核 staged/tracked 路径，不新增 CI/hook 对显式强制暂存的保证。公开 checkout 保留 canonical specs、requirements 模板、完整示例、CHANGELOG 和 compact history。
- 安装器不复制上游 `.gitignore`，不会替下游项目删除或忽略 change/archive/REQ/verification/evidence。
- 提供文档权威地图和 `examples/core-workflow/` 端到端示例，覆盖安装、三路径选择、双授权、团队验证、FEATURE、正式关闭、sync/finalization 恢复和升级。

### 实现、安装与兼容性

- 维护源码统一为 TypeScript，`dist/` 是不跟踪的构建产物；安装目标只接收普通 Node.js 可运行的 emitted JavaScript。
- 支持 Node.js `>=20.19.0`；OpenSpec 固定为 `1.8.0` 和官方 commit `d57889664cab4f2f061d236ec3ff82a5578701bb`。`vendor/openspec` 直接保存 pinned 官方源码 checkout，官方 npm 包提供可分发运行时；安装器分发项目内 launcher、生产运行时和原生 core skills，system-change 使用内置 `spec-driven`，product-change 使用项目 Schema，二者共用相同 skill 引擎。
- OpenSpec core skills 仅将 CLI 调用适配到 `node bin/openspec.js`；`openspec-archive-change` 由本项目治理 wrapper 接管，在关闭授权后调用 formal close，避免原生 archive 绕过团队审核和历史治理。
- 安装器执行完整冲突预检；`--force` 在覆盖受管冲突文件前创建可恢复备份，并且只退役旧 manifest 明确拥有、位于 allowlist 的遗留实现文件。
- 安装器分发受管 AI 治理指南与根合并样例；缺失的根 `AGENTS.md` 只创建为项目自有种子，现有根文件和所有嵌套 `AGENTS.md` 即使在 `--force` 下也不会被接管。
- 已有 `openspec/config.yaml` 会保留，安装器另写合并示例；重复安装内容相同时保持幂等。
- GitNexus 作为大型或陌生仓库的可选推荐辅助，按仓库上下文、索引新鲜度和任务类型选择；不可用时回退，且不成为 specs、验证或程序关闭门禁。
- CI 覆盖 Node.js 兼容矩阵、TypeScript 构建、compiled tests、真实 OpenSpec Schema/change 验证、三路径 formal-close、安装器升级、生成文件漂移和公开发布清单。
