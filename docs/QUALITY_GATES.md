# 全栈质量门禁

## 路径与风险分类

- `bugfix` 只恢复已确认行为且不新增 Requirement。
- `system-change` 使用内置 `spec-driven`，只覆盖有限非产品系统行为。
- `product-change` 覆盖产品目标、用户旅程、角色权限、业务规则、公共契约或共享验收变化。

路径决定产品治理材料，但不代替风险判断。团队仍应按真实改动面评估 security、migration、browser 和 rollback。

本工作流是代码、产品行为和系统行为变更的唯一 change 交付生命周期。其他 workflow/skill 只可作为当前 change 内的辅助步骤；相关冲突披露、skill 选择和 GitNexus 使用方式属于团队/AI 治理，不新增 Schema、脚本、CI 或 formal-close 门禁。

Explore 是[统一生命周期](FULLSTACK_WORKFLOW.md#4-统一生命周期)中的只读需求澄清阶段，不是程序质量门禁。本文件不重复其触发、退出或豁免规则；Schema、脚本和 CI 也不证明该团队治理是否充分。

## 所有变更

- 对受影响 capability 执行 OpenSpec strict validation。
- 生成或实质修改 Requirement delta 前，盘点 canonical、相关活动 changes 和 Requirement-level history 的 stable ID 归属；在计划摘要与关闭审核展示分配、沿用、重命名和冲突结论。
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
- `SPEC.md` 与 pathless `openspec/change-history.json` v1 漂移、严格结构、archive 缺失持久性，以及 legacy v1/v2/非法 seed 的写入前保护；
- bugfix/product-change 项目 Schema 和固定 OpenSpec `1.8.0` 内置 spec-driven 校验；
- 全部活动 changes 通过项目内固定运行时逐项执行 strict validation；
- 安装器、最小 formal close 和真实 OpenSpec 集成测试。
- 公开仓库现有 tracked-file 结构检查：保留 canonical specs、模板、示例和 compact history，同时检查上游自身的详细 change/archive、编号 REQ 与 artifacts。

formal close 自身只强制：显式 change 的 OpenSpec strict validation、archive 成功、索引/历史重建和治理检查。


## 团队评审边界

以下内容必须由团队审核，但不由 Schema、脚本、CLI 或 CI 强制证明：

- tasks 是否已经完成，未完成项是否可以接受；
- 测试和 evidence 是否真实、充分；
- security、migration、browser、rollback 的适用性和结论；
- Requirement 与 PRD 验收、共享 FEATURE 之间的引用和语义是否正确；
- stable Requirement ID 是否按 ADDED 不复用、MODIFIED/普通 RENAMED 沿用、纠错 RENAMED 留痕的规则分配，所有冲突是否已解决；
- 是否授权关闭当前 change。
- 其他 workflow 或 skill 是否与本流程冲突，冲突的优先级与兼容方案是否已经明确；
- 是否确有需要加载专项 skill，以及 GitNexus 索引/分析结果是否仅作为辅助线索使用。
- 是否遵循主流程的 explore 规则，并在路径与范围确定前披露关键未知项。