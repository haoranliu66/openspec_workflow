# AI 全栈规格索引

> 源仓库使用 `npm run index`，已安装目标使用 `node scripts/openspec-governance.js index`；本文件自动生成，请勿手工编辑。

## AI 最小上下文顺序

1. 使用本索引定位受影响 capabilities。
2. 只读取 `openspec/specs/` 下受影响的当前规格。
3. 读取修改相同 capabilities 的活动 changes。
4. 需要 Requirement 级演变时读取 `openspec/change-history.json`；详细本地归档是可选记录，公开克隆通常不包含。
5. BR/PRD 定义目标与范围；其前置完成属于团队流程治理，不是 OpenSpec artifact graph 或程序门禁。

## 活动 Change

详细历史与 Requirement 变更请查 `openspec/change-history.json`。

| Change | Schema | Capabilities | Existing artifacts |
|---|---|---|---|
| publish-clean-docs-and-core-example | product-change | [change-lifecycle-governance](openspec/changes/publish-clean-docs-and-core-example/specs/change-lifecycle-governance/spec.md) | [br.md](openspec/changes/publish-clean-docs-and-core-example/br.md)<br>[prd.md](openspec/changes/publish-clean-docs-and-core-example/prd.md)<br>[proposal.md](openspec/changes/publish-clean-docs-and-core-example/proposal.md)<br>[design.md](openspec/changes/publish-clean-docs-and-core-example/design.md)<br>[tasks.md](openspec/changes/publish-clean-docs-and-core-example/tasks.md) |

## Capability 导航

| 当前规格 | 首次归档 change | 最新归档 change | 活动 changes |
|---|---|---|---|
| [change-lifecycle-governance](openspec/specs/change-lifecycle-governance/spec.md) | 2026-08-01-simplify-closeout-and-gate-apply | 2026-08-03-replace-machine-closeout-with-team-review | [publish-clean-docs-and-core-example](openspec/changes/publish-clean-docs-and-core-example/specs/change-lifecycle-governance/spec.md) |

## 生命周期

Product change: `planning -> implementation authorization -> apply -> change-local verification -> shared FEATURE/team review -> close authorization -> workflow close (strict/archive/index/check)`

Bugfix / system-change: `planning -> implementation authorization -> apply -> change-local verification/team review -> close authorization -> workflow close (strict/archive/index/check)`

归档内容按团队流程不得修改；该规则不由程序或 CI 强制证明。公开历史使用无路径摘要，不依赖详细归档目录。
