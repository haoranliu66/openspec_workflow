# PRD 交付切片

## 来源

- **需求 / 切片 ID**：REQ-002 / DS-001
- **共享 PRD**：`docs/requirements/REQ-002-native-system-change-path/PRD-002.md`
- **产品目标 ID**：BG-001、BG-002、BG-003

## 用户旅程切片

- **目标角色**：创建、实施和关闭有限系统功能变更的工作流使用者与 AI。
- **旅程片段**：判断为 system-change → 用原生 spec-driven 生成规划包 → 等待明确授权 → 实施验证 → minimal closeout → formal close/归档/索引。

## 范围

- **范围内**：三路径选择、spec-driven 识别与校验、非产品 closeout、formal close、历史/安装目标/文档测试。
- **范围外**：复制原生 Schema、修改 OpenSpec package、为 system-change 引入共享产品 artifacts、按代码量弱化 product-change。

## 结果级验收

| 验收 ID | 期望产品结果 | 证据方式 |
|---|---|---|
| PA-001 | 三条路径按变更性质互斥选择 | 决策场景测试与文档审查 |
| PA-002 | system-change 使用内置 spec-driven，无别名 Schema 副本 | 文件集与安装测试 |
| PA-003 | 原生 artifact graph 保持不变 | Schema/集成测试 |
| PA-004 | spec-driven 同样执行明确授权停顿 | 治理场景审查 |
| PA-005 | 非产品 closeout 保留稳定 ID、tasks、evidence 和 gates | contract/validation 测试 |
| PA-006 | spec-driven 可通过 formal close 完整归档 | 端到端测试 |
| PA-007 | Schema/history/navigation 识别 spec-driven | 治理测试 |
| PA-008 | BR/PRD 规则不污染 spec-driven instructions | config/instructions 审查 |

> 精确 WHEN/THEN 场景只进入 delta specs。

## 能力与变更映射

| Capability / Requirement | 关系 | 关联 change |
|---|---|---|
| change-lifecycle-governance / WFG-008..WFG-010 | 新增 | add-system-change-path |
