## Why

当前 product-change 在 change-local `feature.md`、`closeout.json.featureResults` 和共享 `FEATURE.md` 重复维护交付结果，同时缺少规划完成后必须等待用户另行授权的明确规则。该重复链增加关闭成本，也让 OpenSpec 的 apply-ready 状态容易被误解为已经获得实施授权。

## What Changes

- 保留每个 product-change 的 `br.md` 和 `prd.md`，继续绑定共享 BR/PRD 与交付切片。
- 在 Schema 对应规划包完成后加入强制 AI 停顿；用户必须在后续消息中授权明确 change，实质规划修改会使授权失效。
- 从新 product-change 的 artifact graph 中移除 change-local `feature.md`，但保留共享 `FEATURE.md`。
- 将共享 FEATURE 改为逐结果记录已交付结论与 evidence IDs，并作为交付结论唯一事实来源。
- 直接精简并替换现有 product closeout 契约，不引入 v2 并行格式；不再重复 PRD/FEATURE 路径和 FEATURE results，同时保留 Requirement/PRD、evidence、tasks 与四项门禁校验。
- 将 `validate:close <change>` 定位为可选预检，`workflow close <change>` 作为唯一必需的正式关闭入口。
- 保持 OpenSpec 原生 proposal/specs/design/tasks 核心依赖和 apply 对 tasks 的跟踪不变。

## Capabilities

### New Capabilities

- `change-lifecycle-governance`: 定义规划授权停顿、共享交付记录和精简关闭的可执行行为。

### Modified Capabilities

- 无。

## Impact

- OpenSpec product-change Schema、templates 和配置规则。
- AI 治理指引及 propose/continue/ff/apply/onboard 的项目级使用语义。
- closeout contract、Requirement trace、shared FEATURE parser/validator、close workflow 文档语义。
- change history/index、installer 受管文件、README、运维与质量门禁文档。
- closeout、Schema alignment、installer、CLI 和集成测试。
