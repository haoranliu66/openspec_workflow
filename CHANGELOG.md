# 变更日志

## Unreleased

- 将 `openspec/change-history.json` 升级为 pathless v2：只持久化 archived change 的日期、Schema、capability 和 Requirement operation/ID/name；支持 v1 迁移、本地 archive 合并、archive 缺失持久化与非法 seed 防覆盖。
- 上游源仓库的最新发布快照不再跟踪自身的活动/归档 change 详情、编号 REQ 包和历史 artifacts；保留 canonical specs、模板、`CHANGELOG.md` 与 compact history，且不重写既有 Git 提交。
- 新增公开文档权威地图，统一当前指南/Schema/模板中的历史与保留边界，并以 `examples/core-workflow/` 替换过时示例，覆盖三条路径、双授权、团队验证、关闭及恢复。
- 增加结构化发布清单测试；安装器不复制上游 `.gitignore`，不改变下游项目对 change/archive/REQ/verification/evidence 的跟踪选择。

## 3.0.0 - 2026-08-03

- **Breaking**：删除 `closeout.json` 合同、三种 closeout 模板、`validate:close` CLI/package script 以及 tasks/evidence/gate/Requirement/PRD/FEATURE 自定义关闭校验器。
- 三条路径改用 change 内 `verification.md` 和可选 `evidence/` 作为团队审核材料；该约定不进入 artifact graph，也不由 Schema、脚本或 CI 强制解析或判断充分性。
- 新增独立的 change-scoped 关闭授权边界；实施授权不构成关闭授权，AI 必须展示验证、未完成项、风险和回滚摘要并等待后续明确确认。
- `workflow close <change>` 精简为 `openspec validate --strict`、OpenSpec archive、索引/历史重建和治理检查；`--skip-specs` 仅保留为提前 sync 后的恢复参数。
- 安装器能识别旧 manifest 拥有的退役 closeout 文件，先备份再删除；未受管文件、活动/归档 change 和历史 evidence 永不进入退役范围。
- product-change Schema 升级到 4，bugfix Schema 升级到 2；artifact graph 不变，tasks templates 改为 change-local verification 和团队关闭审核。

- 新增互斥的 `system-change` 治理路径：有限非产品系统行为直接使用 OpenSpec `1.5.0` 内置 `spec-driven`，不复制或安装别名 Schema；路径选择按行为和产品治理面，而不是实现规模。
- `spec-driven` 纳入实施授权、change-local verification、团队关闭审核、历史索引、Schema 校验和正式关闭；不要求共享 BR/PRD/FEATURE。
- product-change 移除新 change 的 local `feature.md` artifact，保留 change-local BR/PRD、原生 proposal/specs/design/tasks 核心以及历史 archive 的旧 FEATURE 导航。
- 新增规划完成后的 change-scoped 实施授权治理：AI 必须结束当前轮次并等待后续明确授权；原始请求、artifact 生成、continue/ff 不授权，规划实质修改会使旧授权失效。
- 共享 FEATURE 改为逐结果结论/evidence 行并成为产品交付结论源，其真实性和证据充分性改由团队审核。
- 澄清共享 BR/PRD 前置与归档不可变属于团队流程治理，不新增相应程序校验。

## 2.1.0 - 2026-07-23

- 新增活动 change 文件系统枚举器，按英文名称稳定排序，并逐项执行精确命令 `openspec validate <change> --strict`。
- 单个 change 校验失败后继续处理其他 change，最终稳定汇总非法名称与全部 OpenSpec strict validation 失败项。
- 新增跨平台安全 OpenSpec 调用层与共享项目根识别；源仓库和安装后的 JavaScript 运行时使用同一逻辑。
- CI 在 Node.js 20.19 与 22 上启用活动 change 严格校验，安装器同步分发所需脚本和共享库。
- 归档不可变仍是工作流政策；本版本不新增 base ref、full-history、hash 或其他程序化强制。

## 2.0.0 - 2026-07-23

- 将 `bin/`、`lib/`、`scripts/` 与 `tests/` 的维护源码统一为 TypeScript；`dist/` 为不跟踪的编译产物，安装目标只接收可由普通 Node.js 执行的 JavaScript。
- 将 Node.js 下限提升到 `>=20.19.0`，兼容目标固定为 `@fission-ai/openspec@1.5.0`。
- product-change 对齐原生 OpenSpec graph：`proposal` 后并行解锁 `specs` 与 `design`，`tasks` 等待二者，`apply` 跟踪 `tasks.md`；BR/PRD 保持外层治理。
- 新增确定性的 `SPEC.md` 最小导航与 `openspec/change-history.json` 机器历史，活动 change 在尚无 specs 时也可见。
- 加固安装器的非 P0 JavaScript 映射、生成文件管理和真实目标运行验证；CI 覆盖 Node.js 20.19 与 22、TypeScript 源边界及双生成文件漂移。
- 2.0 升级不会改写已有 archive；活动 product changes 需迁移到原生 artifact/template 结构。
- 2.0.0 当时未提供基于 base ref 的归档强制；后续治理决策明确不要求、也不承诺提供该程序门禁。活动 change 的逐项严格校验已在 2.1.0 实现。

## 1.0.0 - 2026-07-21

- 新增 `bugfix` 与 `product-change` OpenSpec Schema。
- 新增精简共享 BR、PRD 和 FEATURE 模板。
- 新增确定性 `SPEC.md` 生成与工作区归档变更提示。
- 新增冲突安全安装器、测试、CI、接入指南和质量门禁。
