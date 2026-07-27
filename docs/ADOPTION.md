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
node D:\ai-fullstack-openspec-workflow\dist\bin\workflow.js install --target D:\your-project
```

安装器复制 schema、模板、核心指南与 emitted JavaScript，并创建 `openspec/specs/`、`openspec/changes/archive/`、`SPEC.md` 和 `openspec/change-history.json`。目标项目用普通 Node.js 运行 `scripts/*.js`，不需要 TypeScript 或 ts-node。

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
openspec new change add-operations-console --schema product-change
```

团队应在启动 product change 前完成并确认共享 BR/PRD。该顺序属于 change 外的流程治理，不进入 OpenSpec 原生 artifact graph，也不由 Schema、脚本或 CI 校验；`proposal` 仍是原生 graph 的独立 root。`proposal` 后 `specs` 与 `design` 并行，`tasks` 等待二者，`apply` 跟踪 `tasks.md`。继续升级前已存在的活动 product change 时，应先把 proposal/design/tasks 与 delta spec headings 迁移到原生 OpenSpec 结构。

## 建立共享需求包

从 `docs/requirements/_templates/` 创建：

```text
docs/requirements/REQ-001-example/
  README.md
  BR-001.md
  PRD-001.md
  FEATURE.md
```

团队应在启动 product change 前完成并确认共享 BR/PRD，再按可独立交付的切片创建一个或多个 changes。该顺序是团队流程治理，而非 Schema、脚本或 CI 门禁。`feature` artifact ready 只表示可以开始编写 FEATURE；FEATURE 中的可交付声明必须有实现与验证证据支持，而且仍不代表关闭已经完成。

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

关闭单个活动 change 时，先执行 `node scripts/validate-close.js <change>`，再执行 `node bin/workflow.js close <change> --target .`。若已经执行 `/opsx:sync`，在 `close` 命令后加上 `--skip-specs`，避免重复应用 delta。该 wrapper 会完成归档、重建两份生成文件并执行治理检查。
