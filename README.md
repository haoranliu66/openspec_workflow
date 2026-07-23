# AI 全栈 OpenSpec 工作流

版本 `2.0.0` 是一套可移植、可审计、低上下文负担的 AI 全栈开发工作流。OpenSpec 负责 change 内的行为契约，精简 BR/PRD 负责 change 外的产品目标；`SPEC.md` 提供最小导航，`openspec/change-history.json` 保存确定性的机器可读变更历史。

## 两条交付路径

| 变更类型 | Schema | 流程 |
|---|---|---|
| 小 Bug，预期行为已明确，无新业务规则或接口 | `bugfix` | `proposal -> specs -> tasks -> apply` |
| 新功能、管理台、跨角色流程、接口或业务规则调整 | `product-change` | `BR/PRD（外层治理） -> proposal -> {specs ∥ design} -> tasks -> apply -> feature` |

产品 change 中，`proposal` 完成后同时解锁 `specs` 和 `design`；`tasks` 必须等待二者完成，`apply` 以 `tasks.md` 为进度事实。FEATURE ready 只表示已验证行为可供交付，不表示关闭流程已经完成。

## 开发与安装

前置条件：Node.js `>=20.19.0`、Git、`@fission-ai/openspec@1.5.0`。

```powershell
cd D:\ai-fullstack-openspec-workflow
npm ci
npm run build
npm run verify
node dist\bin\workflow.js install --target D:\your-project
```

仓库的 `bin/`、`lib/`、`scripts/` 和 `tests/` 只保存 TypeScript 源码；`dist/` 是不跟踪的编译产物。安装目标只接收 emitted JavaScript，可直接用 Node.js 运行，不需要安装 TypeScript。

目标项目已有 `openspec/config.yaml` 时，安装器不会覆盖，而是生成 `openspec/ai-workflow.config.example.yaml` 供人工合并。其他受管文件如有内容冲突，默认整批拒绝写入；显式使用 `--force` 才会先备份后覆盖。

## 日常命令

```powershell
# 创建 changes
openspec new change fix-example --schema bugfix
openspec new change add-example --schema product-change

# 查看下一份 artifact 及生成指引
openspec status --change add-example
openspec instructions proposal --change add-example

# 在源仓库中重建历史并校验
npm run index
npm run check
npm run verify

# 在安装目标中重建历史并校验
node scripts/openspec-governance.js index
node scripts/openspec-governance.js check
node scripts/validate-schemas.js
```

## 正常关闭 change

没有提前执行 `/opsx:sync` 时，让 archive 完成规格同步：

```powershell
openspec archive <change> --yes --json
node scripts/openspec-governance.js index
node scripts/openspec-governance.js check
```

如果已经执行过 `/opsx:sync`，归档时必须跳过再次同步，避免同一 delta 重复应用：

```powershell
openspec archive <change> --skip-specs --yes --json
```

## 核心约束与迁移边界

- `docs/requirements/REQ-*/BR-*.md` 与 `PRD-*.md` 是外层产品治理，可对应多个 changes。
- PRD 只写结果级验收；精确 `WHEN/THEN` 场景只在 `spec.md` 维护。
- `SPEC.md` 只做最小导航；`openspec/change-history.json` 记录详细历史，也会记录尚未产生 specs 的活动 change。
- `design.md` 是唯一 TD；FEATURE 只记录已验证的 readiness、证据、运营要点和限制。
- 升级 2.0 不改写已有 archive 目录；继续活动 product change 前，应把 proposal/design/tasks 与 delta spec 标题迁移到原生 OpenSpec 结构。
- 自动严格校验所有活动 changes，以及基于 base ref 的归档不可变性检查属于暂缓 P0，不在 2.0.0 发布范围内。

完整规则见[全栈工作流](docs/FULLSTACK_WORKFLOW.md)、[质量门禁](docs/QUALITY_GATES.md)、[接入指南](docs/ADOPTION.md)和[维护手册](docs/OPERATIONS.md)。

本仓库运行时零第三方依赖；Schema 校验脚本调用本机固定兼容版本的 OpenSpec CLI。
