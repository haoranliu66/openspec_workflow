# AI 全栈 OpenSpec 工作流

一套可移植、可审计、低上下文负担的 AI 全栈开发工作流。它以 OpenSpec 为行为契约核心，用精简 BR/PRD 管理产品目标，用 `design.md` 承担 TD，用自动生成的 `SPEC.md` 导航当前规格，并禁止修改已提交归档。

## 两条交付路径

| 变更类型 | Schema | 流程 |
|---|---|---|
| 小 Bug，预期行为已明确，无新业务规则或接口 | `bugfix` | proposal -> specs -> tasks -> apply |
| 新功能、管理台、跨角色流程、接口或业务规则调整 | `product-change` | BR -> PRD -> proposal -> specs -> design(TD) -> tasks -> apply -> feature |

两条路径在实现验证后都执行：同步当前规格 -> 归档 change -> 重建 `SPEC.md` -> 治理检查。

## 快速开始

前置条件：Node.js 18+、Git、OpenSpec CLI。

```powershell
node D:\ai-fullstack-openspec-workflow\bin\workflow.js install --target D:\your-project
cd D:\your-project
openspec schema validate bugfix
openspec schema validate product-change
```

目标项目已有 `openspec/config.yaml` 时，安装器不会覆盖，而是生成 `openspec/ai-workflow.config.example.yaml` 供人工合并。其他受管文件如有内容冲突，默认整批拒绝写入；显式使用 `--force` 才会先备份后覆盖。

## 日常命令

```powershell
# 创建小 Bug change
openspec new change fix-example --schema bugfix

# 创建产品 change
openspec new change add-example --schema product-change

# 查看下一份文档及生成指引
openspec status --change add-example
openspec instructions br --change add-example

# 归档后刷新导航并检查治理约束
node scripts/openspec-governance.js index
node scripts/openspec-governance.js check
```

完整规则见[全栈工作流](docs/FULLSTACK_WORKFLOW.md)、[质量门禁](docs/QUALITY_GATES.md)、[接入指南](docs/ADOPTION.md)和[维护手册](docs/OPERATIONS.md)。

## 核心约束

- `docs/requirements/REQ-*/BR-*.md` 与 `PRD-*.md` 是共享产品目标，可对应多个 changes。
- PRD 只写结果级验收；精确 `WHEN/THEN` 场景只在 `spec.md` 维护。
- `openspec/specs/` 是当前行为事实来源；根目录 `SPEC.md` 只是自动生成的导航索引。
- 新 delta spec 向后引用历史 change；已提交的 `openspec/changes/archive/` 永不修改。
- `design.md` 是唯一 TD，不另建重复技术方案。
- `feature.md` 只记录真实交付、验证证据、运营要点和已知限制。

## 仓库自检

```powershell
npm run verify
```

本仓库运行时零第三方依赖；Schema 校验脚本调用本机 OpenSpec CLI。
