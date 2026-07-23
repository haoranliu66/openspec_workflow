# AI 全栈 OpenSpec 工作流

## 1. 目标

2.0 工作流把产品发现、行为契约、技术设计、编码验证和交付运营连成一条可审计链路，同时避免每个 change 复制整套产品文档。长期文档保存仍有价值的产品事实，change 保存本次增量，生成历史帮助 AI 只加载最小必要上下文。

## 2. 文档分层

| 层级 | 位置 | 负责回答 | 生命周期 |
|---|---|---|---|
| 共享 BR | `docs/requirements/REQ-*/BR-*.md` | 为什么做、业务证据和结果 | 跨多个 changes 演进 |
| 共享 PRD | `docs/requirements/REQ-*/PRD-*.md` | 为谁做、产品范围和结果验收 | 跨多个 changes 演进 |
| Change artifacts | `openspec/changes/<change>/` | 本次交付增量 | 完成后由 OpenSpec 归档 |
| 当前规格 | `openspec/specs/<capability>/spec.md` | 系统现在必须如何行为 | 归档同步或显式 sync 时更新 |
| 最小导航 | `SPEC.md` | 去哪里找当前、活动与相关历史 | 确定性生成，不手改 |
| 机器历史 | `openspec/change-history.json` | change、artifact、capability 与 Requirement 变更 | 确定性生成，不手改 |
| 共享 FEATURE | `docs/requirements/REQ-*/FEATURE.md` | 哪些已验证行为已经 ready | 仅按真实证据更新 |

一个 BR/PRD 可以对应多个 changes。change 内的 `br.md`、`prd.md` 只是轻量绑定与交付切片，不复制共享文档。

## 3. 路径选择

### `bugfix`

同时满足以下条件才使用：问题边界小；期望行为已确认；不新增角色流程、接口契约或业务规则；可用聚焦回归测试证明修复。

原生核心流程：`proposal -> specs -> tasks -> apply`。

### `product-change`

出现任一情况即使用：新功能；管理台；跨角色或跨模块流程；接口、数据或权限变化；新增业务规则；需要产品验证或技术方案。

BR/PRD 属于外层治理。change 内严格使用原生 OpenSpec 解锁关系：

```text
proposal ─┬─> specs ──┐
          └─> design ─┴─> tasks -> apply
```

`proposal` 完成后 `specs` 和 `design` 可并行；`tasks` 等待二者；`apply` 跟踪 `tasks.md`。之后的 `feature` 是本方案的 delivery-readiness artifact，不改变原生核心 graph。

## 4. 标准执行循环

1. **研究**：读取根 `SPEC.md`、受影响当前规格、相关活动 changes 和代码，验证业务证据与现状。
2. **定义产品**：产品变更先维护共享 BR/PRD，再创建可独立交付的 change。
3. **提案**：`proposal.md` 只表达 Why、What Changes、Capabilities 与 Impact。
4. **并行定义**：delta specs 写 SHALL/MUST 与 WHEN/THEN；`design.md` 记录上下文、目标/非目标、决策、风险、迁移与开放问题。
5. **计划实现**：二者完成后生成 `tasks.md`；每项都能以代码、测试或运行证据关闭。
6. **实施验证**：先建立失败证据，再实现；按改动面执行质量门禁并更新任务状态。
7. **记录 readiness**：只把已验证行为写入 change `feature.md` 与共享 `FEATURE.md`。ready 不等于关闭已完成。
8. **关闭 change**：归档、重建两份生成历史并检查。

## 5. 关闭与 sync 选择

正常路径不要先 sync，让 archive 应用 delta：

```powershell
openspec archive <change> --yes --json
node scripts/openspec-governance.js index
node scripts/openspec-governance.js check
```

如果此前已经执行 `/opsx:sync`，归档必须跳过 specs，避免同一 delta 重复应用：

```powershell
openspec archive <change> --skip-specs --yes --json
node scripts/openspec-governance.js index
node scripts/openspec-governance.js check
```

## 6. AI 最小上下文协议

AI 开始任务时依次读取：

1. 根 `SPEC.md`。
2. 受影响的当前规格。
3. 修改同一 capability 的活动 changes。
4. 当前 change 的 proposal/specs/design/tasks。
5. 需要 Requirement 级演进时读取 `openspec/change-history.json`。
6. 仅在范围冲突时读取共享 BR/PRD；仅在回归或决策追溯时读取相关 archive。

`SPEC.md` 不嵌入需求正文，只做导航；`change-history.json` 保存详细、稳定排序的机器历史。活动 change 即使还没有 delta specs，也会以现有 artifact 路径出现在两份输出中。

## 7. 升级与历史边界

- 安装/升级 2.0 不移动或改写已有 archive 目录。
- 继续旧的活动 product change 前，先把 proposal/design/tasks 与 delta spec headings 迁移到原生 OpenSpec 模板。
- 历史错误通过新的 correction change 表达，避免把当前修订伪装成过去事实。
- 自动严格校验所有活动 changes 和基于 base ref 的 archive immutability 比较属于暂缓 P0，不在 2.0.0 中启用。

## 8. 完成定义

FEATURE ready 之后仍需完成适用测试、任务证据、OpenSpec 归档、`SPEC.md`/`change-history.json` 重建与当前非 P0 治理检查，change 才完成关闭。
