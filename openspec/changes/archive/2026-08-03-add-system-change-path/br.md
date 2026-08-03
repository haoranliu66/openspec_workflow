# BR 绑定

## 来源

- **需求 ID**：REQ-002
- **共享 BR**：`docs/requirements/REQ-002-native-system-change-path/BR-002.md`
- **业务目标 ID**：BG-001、BG-002、BG-003

## 本次变更的业务切片

- **问题与预期结果**：在 bugfix 与 product-change 之间新增按治理面定义的 system-change 路径，直接使用 OpenSpec 原生 spec-driven，并纳入统一 formal close。
- **证据状态**：当前两路径限制、原生 Schema graph 和关闭拒绝点均已验证；修正版已由用户确认。
- **关键角色或约束**：不得按代码量降级产品变化；不得复制原生 Schema；必须保留授权、evidence/gates、稳定 ID 和 archive 治理。

## 阻塞决策

- 无
