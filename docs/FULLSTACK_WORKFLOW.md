# AI 全栈 OpenSpec 工作流

## 1. 目标

这套流程把产品发现、行为契约、技术设计、编码验证和交付运营连成一条可审计链路，同时避免每次 change 复制整套产品文档。原则是：长期文档只保留当前有价值的信息，change 保存本次增量，归档保持不可变，AI 默认只加载最小必要上下文。

## 2. 文档分层

| 层级 | 位置 | 负责回答 | 生命周期 |
|---|---|---|---|
| 共享 BR | `docs/requirements/REQ-*/BR-*.md` | 为什么做、业务证据和结果 | 跨多个 changes 演进 |
| 共享 PRD | `docs/requirements/REQ-*/PRD-*.md` | 为谁做、产品范围和结果验收 | 跨多个 changes 演进 |
| Change 文档 | `openspec/changes/<change>/` | 本次交付增量 | 完成后归档且不可变 |
| 当前规格 | `openspec/specs/<capability>/spec.md` | 系统现在必须如何行为 | 每次归档时同步 |
| 根索引 | `SPEC.md` | 去哪里找当前与历史规格 | 自动重建，不手改 |
| 共享 FEATURE | `docs/requirements/REQ-*/FEATURE.md` | 用户现在能用什么 | 仅按真实交付更新 |

一个 BR/PRD 可以对应多个 changes。change 内的 `br.md`、`prd.md` 是轻量绑定与交付切片，不复制共享文档。

## 3. 路径选择

### `bugfix`

同时满足以下条件才使用：问题边界小；期望行为已确认；不新增角色流程、接口契约或业务规则；可用聚焦回归测试证明修复。

流程：`proposal -> specs -> tasks -> apply -> sync/archive/index/check`。

### `product-change`

出现任一情况即使用：新功能；管理台；跨角色或跨模块流程；接口、数据或权限变化；新增业务规则；需要产品验证或技术方案。

流程：`共享 BR/PRD -> change br -> prd -> proposal -> specs -> design(TD) -> tasks -> apply -> feature -> 共享 FEATURE -> sync/archive/index/check`。

Lite 调研中发现范围扩大时必须升级路径，不能把产品决策伪装成 Bug 修复。

## 4. 标准执行循环

1. **研究**：阅读根 `SPEC.md`、受影响当前规格和代码，验证业务证据与现状。
2. **定义产品**：产品变更先维护共享 BR/PRD，再创建一个可独立交付的 change。
3. **定义行为**：在 delta specs 中写完整 SHALL/MUST 要求与精确 WHEN/THEN 场景。
4. **设计技术**：`design.md` 记录架构、契约、安全、失败处理、测试和发布决策。
5. **计划实现**：`tasks.md` 按依赖排序，每项都能以代码、测试或运行证据关闭。
6. **实施验证**：先建立失败证据，再实现；按改动面执行质量门禁；持续更新任务状态。
7. **记录交付**：只把已验证行为写入 change `feature.md` 与共享 `FEATURE.md`。
8. **收敛规格**：用 OpenSpec 归档同步 `openspec/specs/`，归档 change，重建 `SPEC.md` 并检查。

## 5. AI 最小上下文协议

AI 开始任务时依次读取：

1. 根 `SPEC.md`。
2. 受影响的 `openspec/specs/<capability>/spec.md`。
3. 修改同一 capability 的活动 changes。
4. 当前 change 的 proposal/spec/design/tasks。
5. 仅在范围冲突时读取共享 BR/PRD；仅在回归或决策追溯时读取历史归档。

`SPEC.md` 不嵌入需求正文，只保存 capability 的当前规格、第一次归档、最新归档和活动 changes 链接，因此规模增长不会线性放大每次任务的默认上下文。

## 6. 归档链规则

- 新 delta 的 Traceability 向后引用相关旧 change。
- 旧归档不增加“下一次变更”链接，不修正文案，不移动目录。
- `SPEC.md` 自动指出每个 capability 的首次与最新归档。
- 需要理解演进时，从最新 change 沿 backward links 回溯；正常编码只读当前规格。

这保留了迭代历史，同时避免“为了构造双向链表而篡改历史”的审计问题。

## 7. 完成定义

一个 change 只有在以下事项全部满足后才完成：规格与代码一致；适用测试和检查通过；任务证据完整；产品变更已更新 FEATURE；当前规格已同步；change 已归档；`SPEC.md` 已重建；归档不可变检查通过。
