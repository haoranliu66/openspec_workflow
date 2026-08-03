# AI 全栈 OpenSpec 工作流

## 1. 目标

2.1 工作流把产品发现、行为契约、技术设计、编码验证和交付运营连成一条可审计链路，同时避免每个 change 复制整套产品文档。长期文档保存仍有价值的产品事实，change 保存本次增量，生成历史帮助 AI 只加载最小必要上下文。

## 2. 文档分层

| 层级 | 位置 | 负责回答 | 生命周期 |
|---|---|---|---|
| 共享 BR | `docs/requirements/REQ-*/BR-*.md` | 为什么做、业务证据和结果 | 跨多个 changes 演进 |
| 共享 PRD | `docs/requirements/REQ-*/PRD-*.md` | 为谁做、产品范围和结果验收 | 跨多个 changes 演进 |
| Change artifacts | `openspec/changes/<change>/` | 本次交付增量 | 完成后由 OpenSpec 归档 |
| 当前规格 | `openspec/specs/<capability>/spec.md` | 系统现在必须如何行为 | 归档同步或显式 sync 时更新 |
| 最小导航 | `SPEC.md` | 去哪里找当前、活动与相关历史 | 确定性生成，不手改 |
| 机器历史 | `openspec/change-history.json` | change、artifact、capability 与 Requirement 变更 | 确定性生成，不手改 |
| 共享 FEATURE | `docs/requirements/REQ-*/FEATURE.md` | 哪些行为已有证据、可以声明可交付 | 仅按真实证据更新 |

一个 BR/PRD 可以对应多个 changes。change 内的 `br.md`、`prd.md` 只是轻量绑定与交付切片，不复制共享文档。

## 3. 路径选择

### `bugfix`

同时满足以下条件才使用：问题边界明确；期望行为已确认；只恢复既有行为；不新增 Requirement；可用聚焦回归测试证明修复。

原生核心流程：`proposal -> specs -> tasks -> apply`。

### `system-change`

新增或修改有限、可观察的系统行为，且不改变产品目标、用户旅程、角色权限、业务规则、公共契约，也不需要共享产品验收时使用。`system-change` 是治理路径名，实际 metadata 必须写 `schema: spec-driven`，直接使用 OpenSpec `1.5.0` 内置 Schema；本仓库和安装器不复制该 Schema。

原生核心流程：`proposal -> {specs ∥ design} -> tasks -> apply`。design 可以简洁，但不能从原生 graph 中省略。

### `product-change`

出现任一产品治理面变化即使用：产品目标、用户旅程、角色权限、业务规则、公共契约或共享产品验收。即使实现改动很小，也不得降级为 system-change 或 bugfix；无法确认边界时按 product-change 处理。

团队应在启动 product change 前完成并确认共享 BR/PRD。该顺序属于 change 外的流程治理，不进入 OpenSpec 原生 artifact graph，也不由 Schema、脚本或 CI 校验；`proposal` 仍是原生 graph 的独立 root。change 内严格使用原生 OpenSpec 解锁关系：

```text
proposal ─┬─> specs ──┐
          └─> design ─┴─> tasks -> apply
```

`proposal` 完成后 `specs` 和 `design` 可并行；`tasks` 等待二者；`apply` 跟踪 `tasks.md`。新 product change 不生成 change-local `feature.md`，交付结论只写入共享 `FEATURE.md`。

三条路径按行为和治理面选择，不以代码行数、文件数或预计工时为主要依据。bugfix 调研出新 Requirement 时升级；system-change 一旦触及产品治理面即升级为 product-change。

## 4. 标准执行循环

1. **研究**：读取根 `SPEC.md`、受影响当前规格、相关活动 changes 和代码，验证业务证据与现状。
2. **选择路径**：按行为和治理面选择 bugfix、system-change 或 product-change。仅 product-change 需要团队先完成并确认共享 BR/PRD；这是团队流程治理，不是 OpenSpec Schema 依赖。
3. **提案**：`proposal.md` 只表达 Why、What Changes、Capabilities 与 Impact。
4. **定义行为与设计**：所有路径的 delta specs 写 SHALL/MUST 与 WHEN/THEN；product-change/spec-driven 在 proposal 后并行完成 `design.md`，bugfix 按其 Schema 直接进入 specs。
5. **计划实现**：当前 Schema 要求的 specs/design 完成后生成 `tasks.md`；每项都能以代码、测试或运行证据关闭。
6. **等待授权**：apply-required artifacts 及依赖闭包生成完成或实质修改后，AI 结束当前轮次，展示 change ID 与计划摘要，等待后续明确授权。
7. **实施验证**：获得仅适用于该 change 的授权后，先建立失败证据，再实现；按改动面执行质量门禁并更新任务状态。
8. **记录交付证据**：product-change 只有已验证行为才能逐条写入共享 `FEATURE.md` 并关联 closeout evidence；bugfix/system-change 直接准备非产品 closeout evidence。共享 FEATURE 的 `ready` 不等于关闭已完成。
9. **关闭 change**：运行 formal close，归档、重建两份生成历史并检查。

授权必须来自规划完成后的后续消息。原始请求、创建 change、生成 artifacts、`/opsx:continue`、`/opsx:ff` 或普通“继续”不构成授权；后续 `/opsx:apply <change>`、`确认实施 <change>`，或对单一明确 change 的授权提示作出无歧义确认才构成授权。授权只适用于该 change，规划 artifact 的范围、行为、技术决策或工作分解发生实质修改后必须重新确认；格式、链接、证据附加和 checkbox/状态备注不触发重新确认。该规则是 AI/团队治理，不由程序或 CI 强制证明。

## 5. 关闭与 sync 选择

正常路径不要先 sync，让唯一必需的正式 close wrapper 校验并应用 delta：

```powershell
node dist/bin/workflow.js close <change> --target .
```

如果此前已经执行 `/opsx:sync`，归档必须跳过 specs，避免同一 delta 重复应用：

```powershell
node dist/bin/workflow.js close <change> --skip-specs --target .
```

`validate:changes` 枚举全部活动 change 执行 OpenSpec strict validation；`validate:close <change>` 只校验显式指定的单个关闭输入，是可选的非变更性预检。未完成的真实 task checkbox 产生 `TASKS_INCOMPLETE` 警告但不阻止关闭；缺失、不可读或没有真实 checkbox 的 `tasks.md` 仍以 `TASKS_INVALID` 阻止关闭。

AI 应优先继续完成仍可实现的 task。若判断某项 task 无法实现、取消或需要延期，必须说明原因、交付影响、对 Requirement/FEATURE 声明的影响和后续安排，在执行 `workflow close` 前取得用户明确确认，并先修正不再真实的交付声明。该确认属于团队流程治理，不由 Schema、脚本或 CI 强制证明。

除 task 完成状态外，四项适用门禁及成功 evidence、product-change 的共享 FEATURE/evidence 与 Requirement/PRD 引用、bugfix/system-change 稳定 Requirement ID 和 OpenSpec strict validation 仍阻止关闭。system-change 不要求共享 BR/PRD/FEATURE 或 Requirement/PRD 映射。程序只证明结构、引用、项目内 evidence artifact 存在与声明的 gate evidence，不判定 PRD/Requirement 语义、证据充分性或 N/A 原因的合理性；`closeout.json.command` 可选且仅记录、不执行，`artifact` 仍必填。

## 6. AI 最小上下文协议

AI 开始任务时依次读取：

1. 根 `SPEC.md`。
2. 受影响的当前规格。
3. 修改同一 capability 的活动 changes。
4. 当前 change 的 proposal/specs/design/tasks。
5. 需要 Requirement 级演进时读取 `openspec/change-history.json`。
6. product-change 在范围冲突时读取共享 BR/PRD；bugfix/system-change 不创建共享产品文档。仅在回归或决策追溯时读取相关 archive。

`SPEC.md` 不嵌入需求正文，只做导航；`change-history.json` 保存详细、稳定排序的机器历史。活动 change 即使还没有 delta specs，也会以现有 artifact 路径出现在两份输出中。

## 7. 升级与历史边界

- 安装/升级 2.0 不移动或改写已有 archive 目录。
- 继续旧的活动 product change 前，先把 proposal/design/tasks 与 delta spec headings 迁移到原生 OpenSpec 模板。
- 历史错误通过新的 correction change 表达，避免把当前修订伪装成过去事实。
- CI 和本地 `verify` 从文件系统枚举所有活动 change，并逐项执行 `openspec validate <change> --strict`；损坏或非法命名的目录不能被静默遗漏。
- 已归档 change 的内容按团队流程不得修改。该规则依靠团队评审与协作执行；本项目不要求、也不承诺通过 base ref、full history、hash、脚本或 CI 强制证明归档不可变。

## 8. 完成定义

共享 FEATURE 的 `ready` 行只表示该逐条结论有实现与验证 evidence 支持；仍需完成适用测试、task 审查及必要的交付声明修正、OpenSpec 归档、`SPEC.md`/`change-history.json` 重建与治理检查，change 才完成关闭。
