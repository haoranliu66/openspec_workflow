# AI 交付指引

## 上下文加载顺序

1. 先读取根目录 `SPEC.md`。
2. 只加载 `openspec/specs/` 下受影响的当前规格。
3. 加载修改相同 capability 的活动 changes。
4. 仅在处理回归、冲突或设计依据时读取历史归档。
5. BR/PRD 表达产品目标，specs 表达可执行行为。

## 工作流选择

- 只有当 Bug 边界明确、预期行为已确认，并且不改变流程、角色、接口或业务规则时，才使用 `bugfix`。
- 新功能、管理台、跨角色流程、接口调整或业务规则调整使用 `product-change`。
- 调研发现范围扩大时，从 lite 升级为 product change。

## 事实来源

- 共享 BR/PRD/FEATURE：`docs/requirements/REQ-*/`。
- 当前行为：`openspec/specs/<capability>/spec.md`。
- 本次行为增量：`openspec/changes/<change>/specs/<capability>/spec.md`。
- 技术设计：本 change 唯一的 `design.md`。
- 实现状态：源代码与已完成任务的验证证据。

## 强制规则

- 可执行验收场景只写在 specs 中。
- 不修改已提交归档；由新 delta 向后引用历史 change。
- 不手工编辑自动生成的 `SPEC.md`。
- 实现证据不存在时，不在 FEATURE 中宣称已交付。
- 按改动面选择质量门禁，并在 tasks 或 feature 中记录命令和结果。
- 实现验证后更新共享 FEATURE，同步当前规格，归档 change，重建索引并执行治理检查。
