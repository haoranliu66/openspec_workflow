## Why

当前工作流只有 bugfix 与 product-change。有限范围的新系统行为既不是已确认行为的缺陷修复，也未必需要共享 BR/PRD/FEATURE 产品治理，导致使用者要么错误包装为 Bug，要么承担不必要的产品流程。OpenSpec 1.5.0 已提供内置 `spec-driven`，但本项目的 closeout、Schema 识别和历史治理尚未接入。

## What Changes

- 新增团队可读的 `system-change` 路径，实际 change metadata 直接使用 `schema: spec-driven`。
- 用产品治理面和行为性质建立 bugfix/system-change/product-change 三路径选择规则，改动规模只作为辅助信号。
- 保持 OpenSpec 原生 proposal/specs/design/tasks/apply graph，不复制本地别名 Schema。
- 将 spec-driven 接入实施授权、稳定 Requirement ID、非产品 closeout、formal close、archive、索引和安装目标验证。
- 将全局 BR/PRD instructions 明确限定为 product-change，避免污染原生 spec-driven 规划。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `change-lifecycle-governance`: 增加三路径选择、原生 spec-driven system-change 以及统一关闭治理要求。

## Impact

- 影响工作流选择指南、OpenSpec config、closeout Schema 识别、change history、Schema validation、安装器资产说明和端到端测试。
- 不修改 OpenSpec package，不新增本地 system-change Schema，不改变现有 bugfix/product-change artifact graph。
- spec-driven 使用与 bugfix 相同的非产品 closeout 字段，但保留原生 design 阶段。
