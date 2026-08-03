# AI 全栈 OpenSpec 工作流

## 1. 目标

本工作流把产品目标、可执行行为、实现计划、验证记录和历史导航分层管理。OpenSpec 负责 change artifact graph、strict validation 和 delta archive；团队负责判断需求、实现和证据是否真实充分。

## 2. 文档分层

| 层级 | 位置 | 责任 |
|---|---|---|
| 共享 BR/PRD/FEATURE | `docs/requirements/REQ-*/` | 产品目标、结果级验收和已交付结论 |
| 当前规格 | `openspec/specs/<capability>/spec.md` | 当前可执行行为事实 |
| change delta | `openspec/changes/<change>/specs/<capability>/spec.md` | 本次行为增量 |
| 技术设计 | `openspec/changes/<change>/design.md` | 本次技术决策 |
| 实现计划 | `openspec/changes/<change>/tasks.md` | 实施与验证任务 |
| 验证记录 | `openspec/changes/<change>/verification.md`、可选 `evidence/` | 团队审核使用的测试、证据、风险和限制 |
| 导航与历史 | `SPEC.md`、`openspec/change-history.json` v2 | 自动生成的当前导航和已归档 Requirement 演变摘要，不依赖详细 archive 路径 |

`verification.md` 不是 OpenSpec artifact，也不是机器合同；Schema、脚本、CLI 和 CI 不强制其存在、格式或充分性。

## 3. 路径选择

### `bugfix`

仅用于恢复已确认行为，且不新增 Requirement、不改变流程、角色、公共接口或业务规则。artifact graph 为 `proposal -> specs -> tasks`。

### `system-change`

用于有限、可观察且不涉及产品治理面的系统行为变化。治理名称是 system-change，metadata 必须使用 OpenSpec `1.5.0` 内置的 `schema: spec-driven`。原生 graph 为 `proposal -> {specs ∥ design} -> tasks`。

### `product-change`

产品目标、用户旅程、角色权限、业务规则、公共契约或共享产品验收任一发生变化时使用。团队应先完成共享 BR/PRD；change 内保留 BR/PRD 绑定，原生核心仍是 `proposal -> {specs ∥ design} -> tasks`。

路径按行为和治理面选择，不按代码行数选择。范围扩大时，bugfix 升级为 system-change 或 product-change；system-change 触及任何产品治理面时升级为 product-change。

## 4. 标准执行循环

1. 读取 `SPEC.md`，定位受影响 capability 和活动 changes。
2. 按路径加载当前规格、相关活动 change 和必要的历史依据。
3. 生成当前 Schema 的完整规划包。
4. 规划包完成或实质修改后，展示 change ID 与计划摘要，结束当前轮次。
5. 用户在后续消息中明确授权实施该 change。
6. 按 `tasks.md` 实施并运行与真实改动面匹配的测试和质量检查。
7. 在 change 内编写 `verification.md`，必要时增加 `evidence/`。
8. product-change 只把有实现和验证依据的结论更新到共享 `FEATURE.md`。
9. AI 展示关闭审核摘要，包括未完成 tasks、限制、风险适用性和回滚信息，然后结束当前轮次。
10. 团队在后续消息中明确授权关闭该 change。
11. 运行 `workflow close <change>` 完成 strict validation、archive、索引/历史重建和治理检查。

实施授权和关闭授权相互独立，且都只适用于明确的 change。它们属于团队/AI 治理，不创建 approval artifact，也不由 CI 证明。

## 5. 验证记录与团队审核

推荐的 `verification.md` 至少覆盖：

- 实际交付范围以及未交付范围；
- Requirement、PRD 验收和 FEATURE 结论的人工追踪；
- 测试用例 ID、场景、命令或步骤、预期结果、实际结果和结论；
- security、migration、browser、rollback 的适用性和审核结论；
- 未完成、取消或延期 tasks 的原因、交付影响、声明影响和后续安排；
- 已知限制、回滚方式以及安全的 evidence 引用。

大型测试报告、视频或日志可以保存在外部 CI/artifact 系统并链接。密钥、令牌、个人信息和其他敏感数据不得提交到 change。

团队负责判断验证是否充分、N/A 是否合理、声明是否真实以及是否允许关闭。formal close 不读取这些文件，也不检查 tasks checkbox、产品追踪或风险矩阵。

## 6. 关闭与 sync

源码仓库：

```bash
node dist/bin/workflow.js close <change> --target .
```

安装目标：

```bash
node bin/workflow.js close <change> --target .
```

formal close 的固定顺序是：

1. `openspec validate <change> --strict`；
2. `openspec archive <change> --yes --json`；
3. 重建 `SPEC.md` 和 `openspec/change-history.json`；
4. 运行治理检查。

index 会把新本地归档合入 pathless history v2；以后即使详细 archive 不在 checkout 中，摘要仍会稳定保留。history JSON 无效或版本不是 1/2 时会停止而不是覆盖。

正常路径不提前执行独立 sync，archive 会应用 delta。只有 change 已经提前 sync 的恢复场景才传入 `--skip-specs`。项目不再提供 `validate:close` 或其他独立关闭预检。

archive 成功但 index/check 失败时，change 已经归档；修复问题后分别运行 `workflow index` 与 `workflow check`，不要重复 archive。

## 7. AI 最小上下文协议

1. 读取 `SPEC.md`。
2. 读取受影响的当前 capability specs。
3. 读取修改相同 capability 的活动 changes。
4. 需要 Requirement 级历史时查询 `openspec/change-history.json`。
5. 只有本地详细 archive 存在，且回归、冲突或设计依据确有需要时才读取它；公开上游 checkout 通常没有这些目录。
6. product-change 在范围冲突时读取共享 BR/PRD；bugfix/system-change 不创建共享产品文档。

## 8. 升级与历史边界

- 新规则通过新的 delta change 演进，不改写历史摘要或已有本地 archive。
- `change-history.json` v2 只发布 archived change ID、日期、Schema、capability 和 Requirement operation/ID/name；v1 会在下一次 index 或安装升级时迁移，活动 change 和 artifact 路径不会持久化。
- 本工作流源仓库的详细 change/archive、编号 REQ 和 evidence 不进入公开 checkout；旧 Git 提交不重写。下游项目若保留历史 `closeout.json`、local FEATURE 或 evidence，新命令会忽略但安装器不会删除这些项目记录。
- 安装器升级只退役旧 manifest 明确拥有的 closeout 脚本、库和模板；退役前创建备份。
- 未受管同名文件以及 `openspec/changes/**`、`artifacts/**` 永不进入退役目标。
- 安装器不复制源仓库 `.gitignore`，下游团队自行决定是否跟踪自己的 REQ/change/archive/verification/evidence。

## 9. 完成定义

- 代码、文档、配置和测试与当前 change 一致。
- 适用测试和质量检查已执行，结果真实记录。
- 未完成项、限制、风险和回滚已向团队披露。
- product FEATURE 只包含有依据的已交付结论。
- 团队已审核验证材料并明确授权关闭。
- formal close 完成 strict/archive/index/check。
