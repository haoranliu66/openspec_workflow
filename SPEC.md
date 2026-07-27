# AI 全栈规格索引

> 源仓库使用 `npm run index`，已安装目标使用 `node scripts/openspec-governance.js index`；本文件自动生成，请勿手工编辑。

## AI 最小上下文顺序

1. 使用本索引定位受影响 capabilities。
2. 只读取 `openspec/specs/` 下受影响的当前规格。
3. 读取修改相同 capabilities 的活动 changes。
4. 仅在处理回归、冲突或设计依据时读取历史归档。
5. BR/PRD 定义目标与范围；其前置完成属于团队流程治理，不是 OpenSpec artifact graph 或程序门禁。

## 活动 Change

详细历史与 Requirement 变更请查 `openspec/change-history.json`。

| Change | Schema | Capabilities | Existing artifacts |
|---|---|---|---|
| _暂无活动 Change_ | - | - | - |

## Capability 导航

| 当前规格 | 首次归档 change | 最新归档 change | 活动 changes |
|---|---|---|---|
| _暂无已同步或活动的 capability_ | - | - | - |

## 生命周期

`apply -> verify -> feature -> sync/archive -> index -> check`

归档内容按团队流程不得修改；该规则不由程序或 CI 强制证明。新 delta 可以向后链接历史 changes；旧归档不增加正向链接。
