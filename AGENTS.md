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
- product change 的 BR/PRD 是外层治理。change 内 `proposal` 完成后，`specs` 与 `design` 并行解锁；`tasks` 等待二者，`apply` 跟踪 `tasks.md`。
- 调研发现范围扩大时，从 bugfix 升级为 product change。

## 事实来源

- 共享 BR/PRD/FEATURE：`docs/requirements/REQ-*/`。
- 当前行为：`openspec/specs/<capability>/spec.md`。
- 本次行为增量：`openspec/changes/<change>/specs/<capability>/spec.md`。
- 技术设计：本 change 唯一的 `design.md`。
- 实现状态：源代码、`tasks.md` 和验证证据。
- 导航与历史：生成的 `SPEC.md` 与 `openspec/change-history.json`，不得手工编辑。

## 强制规则

- 可执行验收场景只写在 specs 中。
- 历史修订由新的 delta change 表达；2.0 升级不改写已有 archive 目录。
- 实现证据不存在时，不在 FEATURE 中宣称 ready；FEATURE ready 也不等于 change 已完成关闭。
- 按改动面选择质量门禁，并在 tasks 或 feature 中记录命令和结果。
- 未执行 `/opsx:sync` 时用 `openspec archive <change> --yes --json`；已经 sync 时改用 `--skip-specs`，避免 delta 重复应用。
- 归档后重建 `SPEC.md` 与 `openspec/change-history.json`，再执行治理检查。
- 自动严格校验所有活动 changes 与 base-ref 归档不可变性检查是暂缓 P0，不能宣称 2.0.0 已提供。

## 工具边界

本仓库源码统一为 TypeScript，`dist/` 只作为不跟踪的构建产物。贡献者使用 Node.js `>=20.19.0`、OpenSpec `1.5.0`、`npm ci`、`npm run build` 与 `npm run verify`；安装目标只运行 emitted JavaScript，不依赖 TypeScript。
