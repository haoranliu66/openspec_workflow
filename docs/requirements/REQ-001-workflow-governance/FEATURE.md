# FEATURE：已交付能力

## 交付摘要

- **可用范围 / 版本**：工作流源仓库与新安装/升级目标 / 2026-08-01
- **目标角色**：工作流使用者、维护者与审查者
- **需求 / 产品目标 ID**：REQ-001 / BG-001、BG-002、BG-003

## 已交付流程

1. AI 在规划包完成或实质修改后结束当前轮次，并等待后续针对准确 change 的明确授权。
2. 新 product change 不再维护 local FEATURE；共享 FEATURE 逐结果绑定 passed closeout evidence。
3. `workflow close <change>` 作为唯一必需的正式入口完成校验、归档、索引重建和治理检查。

## 运营规则

- 只有具备成功 evidence 的结果才能标记为 `ready`。
- 本文件是该共享需求的交付结论事实来源，不复制 specs 或 design。

## 验证与监控

- **验收证据**：EV-ACCEPTANCE-001、EV-TEST-001、EV-MIGRATION-001、EV-ROLLBACK-001
- **健康 / 结果指标**：`npm run verify` 全部通过；两个 Schema 有效；活动 change strict validation 通过

## 限制与变更

| Change | 结果 ID | 已交付结论 | Evidence IDs | 版本 / 日期 | 状态 |
|---|---|---|---|---|---|
| simplify-closeout-and-gate-apply | FR-001 | 规划完成后 AI 停止当前轮次，后续明确授权只适用于指定 change，实质规划修改后重新授权 | EV-ACCEPTANCE-001, EV-TEST-001 | 2026-08-01 | ready |
| simplify-closeout-and-gate-apply | FR-002 | 共享 FEATURE 成为逐结果交付结论源，closeout 直接精简且历史 archive 保持不变 | EV-ACCEPTANCE-001, EV-TEST-001, EV-MIGRATION-001 | 2026-08-01 | ready |
| simplify-closeout-and-gate-apply | FR-003 | 单一 `workflow close <change>` 正式入口完成校验、归档、索引和治理检查 | EV-ACCEPTANCE-001, EV-TEST-001, EV-ROLLBACK-001 | 2026-08-01 | ready |
