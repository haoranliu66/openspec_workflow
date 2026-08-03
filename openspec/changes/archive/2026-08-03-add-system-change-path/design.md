## Context

OpenSpec `1.5.0` 内置 `spec-driven` Schema：proposal 完成后 specs 与 design 解锁，tasks 依赖二者，apply 要求并跟踪 tasks。当前项目只把 bugfix/product-change 视为受支持 Schema；closeout 会拒绝 spec-driven，历史治理会将其视为未知，Schema 校验也不会覆盖它。全局 config 中的 proposal BR/PRD 规则还隐含了 product-change 前提。

## Goals / Non-Goals

**Goals:**

- 提供互斥、可解释的三路径分流，避免用代码规模代替产品风险判断。
- 直接复用 OpenSpec 内置 spec-driven artifact graph。
- 让 spec-driven 继承实施授权、稳定 ID、evidence/gates 和 formal close 治理。
- 保持安装目标可移植，并将内置 Schema 纳入真实集成验证。

**Non-Goals:**

- 创建或安装 `system-change/schema.yaml`。
- 修改 OpenSpec 内置 Schema 或 skills。
- 让 system-change 维护共享 BR/PRD/FEATURE。
- 用 system-change 绕过角色权限、业务规则、公共接口、数据或迁移的产品治理。
- 省略原生 design artifact。

## Decisions

### 1. Separate the governance path name from the Schema ID

文档和对话使用 `system-change` 表达意图，实际 OpenSpec change 使用 `schema: spec-driven`。这样团队获得清晰语义，又不复制上游 Schema。OpenSpec 版本继续固定为 `1.5.0`，其内置 Schema 即路径事实来源。

### 2. Classify by behavior and governance surface, not diff size

bugfix 只恢复已确认行为；system-change 改变有限系统行为但不改变产品目标、用户旅程、角色权限、业务规则或公共契约；product-change 承担所有需要共享产品验收的变化。代码行数、文件数量和预计工时只作为范围扩大提示。

### 3. Reuse the non-product closeout branch

`CloseoutSchema` 增加 `spec-driven`。它与 bugfix 一样不接受 product-only `requirements` mapping 字段，使用 `version`、evidence 和四项 gates；关闭验证另外要求每个 delta Requirement 有稳定 ID。程序提示改为“non-product schema”，避免把共享结构错误称为 bugfix 专用。

### 4. Extend recognition without distributing a Schema copy

change-history 将 spec-driven 视为已知 Schema；`validate-schemas` 通过 OpenSpec CLI 校验内置 spec-driven；installer 不复制其 Schema/templates，只依赖已声明的 OpenSpec 1.5.0 前置。真实安装目标集成测试创建、校验并关闭 spec-driven change。

### 5. Keep authorization and configuration Schema-aware

现有 WFG-001 已覆盖“当前 Schema 的 apply-required artifacts 及依赖闭包”，因此 spec-driven 自动适用授权停顿。AGENTS/README 明确其规划包；全局 config 的 BR/PRD proposal rules 改成仅 product-change 使用，稳定 Requirement ID 和 tasks/evidence rules 继续适用于全部路径。

### 6. Render lifecycle as product and non-product branches

生成导航不能再把共享 FEATURE 描述为所有 change 的必经阶段。product-change 在 verify 后更新共享 FEATURE；bugfix/system-change 直接准备非产品 closeout evidence，再进入统一 formal close。

## Risks / Trade-offs

- 三路径增加选择认知负担 → 使用按产品治理面的互斥决策表和正反例，不允许仅凭“规模小”选择。
- 内置 Schema 可能随 OpenSpec 升级变化 → 固定 1.5.0，并在本地与安装目标校验 `spec-driven`。
- 原生 spec-driven 默认指引不强调稳定 Requirement ID → 通过本项目 config/AGENTS 和 closeout 程序门禁补充，不修改上游 Schema。
- 小改动仍需要 design → 接受原生 graph；允许内容简洁，但不伪造可选依赖。
- system-change 没有共享 FEATURE 产品台账 → 只允许无产品验收需求的变化使用；一旦需要用户可见产品结论即升级 product-change。

## Migration Plan

1. 扩展 Schema 类型、closeout 解析和稳定 Requirement 校验分支。
2. 扩展历史识别、内置 Schema 校验和生命周期渲染。
3. 调整 config、AGENTS、README、接入/运营/质量指南与示例。
4. 增加 contract、validation、history、Schema runner、installer 和真实 close/archive 集成测试。
5. 运行完整验证，更新共享 FEATURE 与 closeout evidence，再使用 formal close 归档。

回滚通过还原本 change 的受管源码与文档完成；不会改写既有 archive 或 OpenSpec package。

## Open Questions

- None. 本轮评审已确认路径名称、Schema ID、分流边界和归档治理范围。
