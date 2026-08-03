# 共享需求包：原生 system-change 路径

## 基本信息

- **需求 ID**：REQ-002
- **标题**：使用 OpenSpec 原生 spec-driven 的中型系统变更路径
- **负责人**：工作流维护者
- **状态**：已批准

## 文档

- [BR](BR-002.md)：为什么需要介于 bugfix 与 product-change 之间的路径
- [PRD](PRD-002.md)：三路径选择规则、原生 Schema 边界和归档治理验收
- [FEATURE](FEATURE.md)：已经交付并可使用的工作流结果

## 交付映射

| Change | 交付切片 | Capabilities | 状态 |
|---|---|---|---|
| add-system-change-path | DS-001 三路径选择与原生归档治理 | change-lifecycle-governance | planned |

## 决策记录

| 日期 | 决策 | 负责人 |
|---|---|---|
| 2026-08-03 | 采用修正版：新增 system-change 治理路径，直接使用 OpenSpec 1.5.0 内置 spec-driven，不复制 Schema | 用户 / 工作流维护者 |
