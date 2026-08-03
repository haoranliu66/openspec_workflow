# PRD 交付切片

## 来源

- **需求 / 切片 ID**：REQ-001 / DS-001
- **共享 PRD**：`docs/requirements/REQ-001-workflow-governance/PRD-001.md`
- **产品目标 ID**：BG-001、BG-002、BG-003

## 用户旅程切片

- **目标角色**：使用 OpenSpec 工作流规划、实施、验证和关闭 change 的用户与 AI。
- **旅程片段**：生成规划包 → 展示摘要并等待 → 用户授权明确 change → 实施与验证 → 更新共享 FEATURE → 单入口关闭。

## 范围

- **范围内**：授权停顿、授权失效语义、本地 FEATURE 移除、共享 FEATURE 逐结果 evidence、现有 closeout 契约直接精简与关闭入口收敛。
- **范围外**：审批文件或 CI 授权证明、archive 改写、取消质量门禁。

## 结果级验收

| 验收 ID | 期望产品结果 | 证据方式 |
|---|---|---|
| PA-001 | 规划包完成后 AI 停止并展示摘要 | 治理与 skill 测试 |
| PA-002 | 明确授权和实质修改失效语义得到执行 | 场景测试 |
| PA-003 | 保留本地 BR/PRD 且不再生成本地 FEATURE | Schema 测试 |
| PA-004 | 共享 FEATURE 逐结果关联 evidence | parser/validator 测试 |
| PA-005 | 精简 closeout 保留所有必要质量门禁 | contract/integration 测试 |
| PA-006 | 正式关闭只要求一个入口命令 | CLI 与文档测试 |
| PA-007 | 既有 archive 不被改写 | upgrade 测试 |

> 精确 WHEN/THEN 场景只进入 delta specs。

## 能力与变更映射

| Capability / Requirement | 关系 | 关联 change |
|---|---|---|
| change-lifecycle-governance / WFG-001..WFG-007 | 新增 | simplify-closeout-and-gate-apply |
