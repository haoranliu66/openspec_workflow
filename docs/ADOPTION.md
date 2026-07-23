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

产品 change 的 BR/PRD 是外层治理；`proposal` 后 `specs` 与 `design` 并行，`tasks` 等待二者，`apply` 跟踪 `tasks.md`。继续升级前已存在的活动 product change 时，应先把 proposal/design/tasks 与 delta spec headings 迁移到原生 OpenSpec 结构。

## 建立共享需求包

从 `docs/requirements/_templates/` 创建：

```text
docs/requirements/REQ-001-example/
  README.md
  BR-001.md
  PRD-001.md
  FEATURE.md
```

先批准 BR/PRD，再按可独立交付的切片创建一个或多个 changes。`feature` artifact ready 只表示可以开始编写 FEATURE；FEATURE 中的可交付声明必须有实现与验证证据支持，而且仍不代表关闭已经完成。

## 接入 CI

至少加入以下步骤：

```powershell
node scripts/openspec-governance.js index
git diff --exit-code -- SPEC.md openspec/change-history.json
node scripts/validate-schemas.js
node scripts/openspec-governance.js check
git diff --check
```

`SPEC.md` 是最小导航，`openspec/change-history.json` 是详细机器历史；活动 change 在尚无 specs 时也会出现在历史中。跨 base ref 的归档不可变性检查与自动严格活动 change 校验属于暂缓 P0，2.0.0 CI 不要求 full-history checkout 或 baseRef 配置。

## 关闭 change

正常情况下直接执行 `openspec archive <change> --yes --json`，不要先 sync。若已经执行 `/opsx:sync`，改用 `openspec archive <change> --skip-specs --yes --json`，避免重复应用 delta；随后重建并检查两份生成文件。
