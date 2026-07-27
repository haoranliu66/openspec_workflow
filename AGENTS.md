# AI 交付指引

## 上下文加载顺序

1. 先读取根目录 `SPEC.md` 定位受影响 capability 与活动 change。
2. 只加载 `openspec/specs/` 下受影响的当前规格。
3. 加载修改相同 capability 的活动 changes；需要 Requirement 级历史时读取 `openspec/change-history.json`。
4. 仅在处理回归、冲突或设计依据时读取相关 archive。
5. BR/PRD 表达外层产品目标，specs 表达可执行行为。

## 工作流选择与 artifact graph

- 只有 Bug 边界明确、预期行为已确认，且不改变流程、角色、接口或业务规则时，才使用 `bugfix`。
- 新功能、管理台、跨角色流程、接口调整或业务规则调整使用 `product-change`。
- 团队应在启动 product change 前完成并确认共享 BR/PRD。该顺序属于 change 外的流程治理，不进入 OpenSpec 原生 artifact graph，也不由 Schema、脚本或 CI 校验；`proposal` 仍是原生 graph 的独立 root。change 内 `proposal` 完成后，`specs` 与 `design` 并行解锁；`tasks` 等待二者，`apply` 跟踪 `tasks.md`。
- 调研发现范围扩大时，从 bugfix 升级为 product change。

## 事实来源

- 共享 BR/PRD/FEATURE：`docs/requirements/REQ-*/`。
- 当前行为：`openspec/specs/<capability>/spec.md`。
- 本次行为增量：`openspec/changes/<change>/specs/<capability>/spec.md`。
- 技术设计：本 change 唯一的 `design.md`。
- 实现状态：源代码、`tasks.md` 和验证证据。
- 导航与历史：生成的 `SPEC.md` 与 `openspec/change-history.json`，不得手工编辑。

## 流程治理规则与程序门禁

流程治理规则依靠团队评审与协作执行；程序门禁仅指 Schema、脚本或 CI 实际校验的检查。二者都应遵守，但执行方式不同。

- 可执行验收场景只写在 specs 中。
- 历史修订由新的 delta change 表达；2.0 升级不改写已有 archive 目录。
- 实现证据不存在时，不在 FEATURE 中宣称 ready；FEATURE ready 也不等于 change 已完成关闭。
- 按改动面选择质量门禁，并在 tasks 或 feature 中记录命令和结果。
- 关闭前对单个活动 change 运行 `npm run validate:close -- <change>`；使用 `node dist/bin/workflow.js close <change> --target .` 完成校验、归档、重建索引和治理检查。安装目标对应使用 `node scripts/validate-close.js <change>` 和 `node bin/workflow.js close <change> --target .`；已经 sync 时才向 `close` 传入 `--skip-specs`。
- 程序关闭门禁只强制：所有 tasks 完成、四项适用门禁及成功 evidence、product-change 的 FEATURE/evidence 引用和 Requirement/PRD 验收引用，以及 bugfix 的稳定 Requirement ID。它们只证明结构、引用、文件存在和声明证据，不证明语义正确、证据充分或 N/A 理由合理；`closeout.json.command` 只记录，不执行。
- `validate:changes` 与 `validate:close <change>` 是不同门禁：前者枚举全部活动 change 做 OpenSpec strict validation，后者校验显式指定的单个关闭输入。
- 提交前运行 `npm run validate:changes`；安装目标运行 `node scripts/validate-changes.js`。该命令从文件系统枚举全部活动 change，并逐项执行 `openspec validate <change> --strict`。
- 已归档 change 的内容按团队流程不得修改。该规则依靠团队评审与协作执行；本项目不要求、也不承诺通过 base ref、full history、hash、脚本或 CI 强制证明归档不可变。

## 工具边界

本仓库源码统一为 TypeScript，`dist/` 只作为不跟踪的构建产物。贡献者使用 Node.js `>=20.19.0`、OpenSpec `1.5.0`、`npm ci`、`npm run build` 与 `npm run verify`；安装目标只运行 emitted JavaScript，不依赖 TypeScript。
