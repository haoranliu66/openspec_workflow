# FEATURE：原生 system-change 路径

## 交付摘要

- **可用范围 / 版本**：工作流源仓库与新安装/升级目标 / 2026-08-03
- **目标角色**：工作流使用者、AI 与维护者
- **需求 / 产品目标 ID**：REQ-002 / BG-001、BG-002、BG-003

## 已交付流程

1. 变更按行为与治理面在 bugfix、system-change、product-change 三条互斥路径间选择，不以实现规模替代产品风险判断。
2. system-change 直接使用 OpenSpec `1.5.0` 内置 `spec-driven`，继承规划后授权停顿和非产品 closeout，不复制 Schema。
3. `workflow close <change>` 可验证、同步、归档 spec-driven change，并重建包含其 Schema 的确定性历史。

## 运营规则

- 只有具备 passed closeout evidence 的逐结果记录才能标记为 `ready`。
- 本文件不参与 system-change 自身的关闭；它只记录本次 product-change 对工作流产品能力的交付。

## 验证与监控

- **验收证据**：EV-ACCEPTANCE-002、EV-TEST-002、EV-MIGRATION-002、EV-ROLLBACK-002
- **健康 / 结果指标**：`npm run verify` 全部通过；bugfix、product-change 与内置 spec-driven 均通过 Schema 校验；真实安装目标完成 spec-driven validate/sync/archive

## 限制与变更

| Change | 结果 ID | 已交付结论 | Evidence IDs | 版本 / 日期 | 状态 |
|---|---|---|---|---|---|
| add-system-change-path | FR-001 | 三路径按行为与产品治理面准确分流，小型权限/业务规则变化不降级，有限非产品行为不被迫维护 BR/PRD | EV-ACCEPTANCE-002, EV-TEST-002 | 2026-08-03 | ready |
| add-system-change-path | FR-002 | 原生 spec-driven 接入 change-scoped 授权、稳定 Requirement ID、非产品 closeout 和四项 gate，且不复制 Schema | EV-ACCEPTANCE-002, EV-TEST-002, EV-MIGRATION-002 | 2026-08-03 | ready |
| add-system-change-path | FR-003 | 安装目标可通过统一 formal close 同步并归档 spec-driven change，生成历史将其识别为受支持 Schema | EV-ACCEPTANCE-002, EV-TEST-002, EV-ROLLBACK-002 | 2026-08-03 | ready |
