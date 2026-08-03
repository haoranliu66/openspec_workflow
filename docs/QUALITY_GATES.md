# 全栈质量门禁

## 路径与风险分类

- `bugfix` 只恢复已确认行为且不新增 Requirement。
- `system-change` 使用内置 `spec-driven`，只覆盖有限非产品系统行为。
- `product-change` 覆盖产品目标、用户旅程、角色权限、业务规则、公共契约或共享验收变化。

路径决定产品治理材料，但不代替风险判断。团队仍应按真实改动面评估 security、migration、browser 和 rollback。

## 所有变更

- 对受影响 capability 执行 OpenSpec strict validation。
- 为新增或修改行为提供聚焦测试，并保留失败路径和回归覆盖。
- 在 `verification.md` 记录详细测试用例、预期/实际结果和证据引用。
- 披露未完成 tasks、已知限制、回滚方式和对交付声明的影响。
- 团队审核验证充分性后明确授权关闭。

## 前端

- 构建、类型检查和 lint。
- 关键交互、错误态、空态和权限态。
- 适用浏览器、响应式布局和无障碍检查。
- 涉及视觉结果时保存截图或外部视觉测试引用。

## 后端与接口

- 单元、集成和契约测试。
- 授权、输入校验、错误映射、幂等和并发边界。
- 公共接口变化必须走 product-change，并评估兼容性和回滚。

## 数据与迁移

- 迁移前置条件、向前/向后兼容和数据校验。
- 备份、回滚或 forward-fix 策略。
- 大数据量、锁、超时和重复执行风险。

## 安全与隐私

- 身份认证、授权、输入边界、依赖和敏感信息处理。
- `verification.md` 只保存安全摘要；不得提交凭据、令牌、个人数据或生产机密。
- 大型或敏感 evidence 使用受控外部存储，并记录可审核引用。

## 发布与运营

- 配置、观测、告警、降级和回滚适用性。
- 共享 FEATURE 每行只声明已经实现、验证并经团队审核的结果。
- `ready` 是产品交付结论，不代表 formal close 已成功。

## 工作流仓库程序门禁

CI 使用 Node.js 20.19 和 22 执行：

- TypeScript source layout、build 和 compiled tests；
- `SPEC.md` 与 pathless `openspec/change-history.json` v2 漂移、v1 迁移、archive 缺失持久性和非法 seed 保护；
- bugfix/product-change 项目 Schema 和内置 spec-driven 校验；
- 全部活动 changes 的逐项 `openspec validate <change> --strict`；
- 安装器、最小 formal close 和真实 OpenSpec 集成测试。
- 公开仓库 tracked-file 结构检查：保留 canonical specs、模板、示例和 compact history，同时排除上游自身的详细 change/archive、编号 REQ 与 artifacts。

formal close 自身只强制：显式 change 的 OpenSpec strict validation、archive 成功、索引/历史重建和治理检查。

归档不可变仍由团队治理，治理命令不读取 Git diff 作程序证明。上游 tracked-file 检查只约束本工作流源仓库的发布边界；安装器不把该忽略策略施加给下游项目。

## 团队评审边界

以下内容必须由团队审核，但不由 Schema、脚本、CLI 或 CI 强制证明：

- tasks 是否已经完成，未完成项是否可以接受；
- 测试和 evidence 是否真实、充分；
- security、migration、browser、rollback 的适用性和结论；
- Requirement 与 PRD 验收、共享 FEATURE 之间的引用和语义是否正确；
- stable Requirement ID、N/A 理由、限制和回滚是否合理；
- 是否授权关闭当前 change。

项目不再生成或解析 `closeout.json`，不再发出 `TASKS_INCOMPLETE`、`TASKS_INVALID`、`GATE_INVALID`、`EVIDENCE_INVALID` 或产品 trace 关闭诊断，也不再提供 `validate:close`。这不会免除团队的质量责任，只是明确程序不擅自替代人工完成性判断。
