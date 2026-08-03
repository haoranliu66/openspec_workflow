# 接入指南

## 前置条件

- Node.js `>=20.19.0`
- Git
- `@fission-ai/openspec@1.5.0` 可从命令行执行

维护本工作流仓库时先执行：

```powershell
npm ci
npm run build
npm run verify
```

源码统一为 TypeScript，`dist/` 是不跟踪的编译产物。

## 安装到项目

```powershell
npm exec --yes --package="github:haoranliu66/openspec_workflow#main" -- ai-fullstack-workflow install --target D:\your-project
```

该命令直接从 GitHub `main` 获取并构建工作流包，不依赖本地工作流仓库路径。

安装器复制项目自定义的 bugfix/product-change Schema、closeout/requirements 模板、核心指南与 emitted JavaScript，并创建 `openspec/specs/`、`openspec/changes/archive/`、`SPEC.md` 和 `openspec/change-history.json`。system-change 直接使用目标环境 OpenSpec `1.5.0` 内置的 `spec-driven`，安装器不复制对应 Schema 目录。目标项目用普通 Node.js 运行 `scripts/*.js`，不需要 TypeScript 或 ts-node。

### 已有文件的处理

- 内容相同：跳过，重复安装保持幂等。
- `openspec/config.yaml` 已存在：保留原文件，新增 `openspec/ai-workflow.config.example.yaml`。
- 其他受管文件冲突：默认在任何写入前失败。
- 确需升级受管文件：使用 `--force`，旧文件先备份到 `.ai-workflow-backup/<timestamp>/`。
- 升级不会改写已有 archive 目录。

## 合并项目配置

从示例配置中人工合并 `context` 和 `rules`。默认 schema 可按团队主要工作类型选择，单次 change 仍应显式指定：

```powershell
openspec new change fix-login --schema bugfix
openspec new change add-cache-policy --schema spec-driven
openspec new change add-operations-console --schema product-change
```

三条路径按行为和治理面选择：bugfix 只恢复已确认行为且不新增 Requirement；system-change 用于不改变产品目标、用户旅程、角色权限、业务规则、公共契约或共享产品验收的有限系统行为；product-change 覆盖所有产品治理面变化，即使实现规模很小。`system-change` 只是治理名称，metadata 始终使用 `schema: spec-driven`。无法确认边界时使用 product-change。

团队应在启动 product change 前完成并确认共享 BR/PRD。该顺序属于 change 外的流程治理，不进入 OpenSpec 原生 artifact graph，也不由 Schema、脚本或 CI 校验；`proposal` 仍是原生 graph 的独立 root。product-change 和 spec-driven 都在 `proposal` 后并行解锁 `specs` 与 `design`，`tasks` 等待二者，`apply` 跟踪 `tasks.md`；spec-driven 的 design 可以简洁但不能省略。新 product change 不生成 local `feature.md`；历史 archive 中已有的 `feature.md` 保留。继续升级前已存在的活动 product change 时，应先把 proposal/design/tasks 与 delta spec headings 迁移到原生 OpenSpec 结构。

接入团队还必须采用实施授权治理：apply-required artifacts 及依赖闭包生成完成或实质修改后，AI 结束当前轮次并展示 change ID 与计划摘要；用户只能在后续消息中以 `/opsx:apply <change>`、`确认实施 <change>` 或对单一明确 change 的无歧义确认授权。原始请求、artifact 生成、`/opsx:continue`、`/opsx:ff` 和普通“继续”不是授权；授权仅适用于指定 change，规划实质修改后失效。该规则不创建 approval artifact，也不由 Schema、脚本或 CI 强制证明。

## 建立共享需求包

从 `docs/requirements/_templates/` 创建：

```text
docs/requirements/REQ-001-example/
  README.md
  BR-001.md
  PRD-001.md
  FEATURE.md
```

团队应在启动 product change 前完成并确认共享 BR/PRD，再按可独立交付的切片创建一个或多个 changes。该顺序是团队流程治理，而非 Schema、脚本或 CI 门禁。共享 FEATURE 每行记录一个交付结果、一个稳定结果 ID 和对应 evidence IDs；只有实现与验证证据支持的行才能标记 `ready`，而且仍不代表关闭已经完成。

## 接入 CI

至少加入以下步骤：

```powershell
node scripts/openspec-governance.js index
git diff --exit-code -- SPEC.md openspec/change-history.json
node scripts/validate-schemas.js
node scripts/validate-changes.js
node scripts/openspec-governance.js check
git diff --check
```

`SPEC.md` 是最小导航，`openspec/change-history.json` 是详细机器历史；活动 change 在尚无 specs 时也会出现在历史中。`node scripts/validate-changes.js` 从文件系统枚举所有活动 change 目录并逐项执行 `openspec validate <change> --strict`。已归档 change 的内容按团队流程不得修改。该规则依靠团队评审与协作执行；本项目不要求、也不承诺通过 base ref、full history、hash、脚本或 CI 强制证明归档不可变。

## 关闭 change

关闭单个活动 change 时，只需执行正式入口 `node bin/workflow.js close <change> --target .`。若已经执行 `/opsx:sync`，在 `close` 命令后加上 `--skip-specs`，避免重复应用 delta。该 wrapper 自身先执行关闭校验，再归档、重建两份生成文件并执行治理检查；`node scripts/validate-close.js <change>` 只是可选的非变更性预检。

未完成的真实 task checkbox 只产生 `TASKS_INCOMPLETE` 警告；缺失、不可读或没有真实 checkbox 的 `tasks.md` 以及其他 closeout diagnostics 仍阻止关闭。AI 应优先继续可实现的 task；若判断某项无法实现、取消或延期，必须说明原因、交付及 Requirement/FEATURE 影响和后续安排，修正不再真实的交付声明，并在执行 `workflow close` 前取得用户明确确认。该确认是团队治理规则，不由 Schema、脚本或 CI 强制证明。

product-change 关闭还要求 Requirement/PRD acceptance 与共享 FEATURE/evidence 引用。bugfix 和 spec-driven 使用同一非产品 closeout 形状，只要求稳定 delta Requirement ID、项目内 passed evidence 和完整四项 gate，不要求共享 BR/PRD/FEATURE；可分别从 `docs/closeout-templates/bugfix.json` 和 `docs/closeout-templates/spec-driven.json` 创建。
