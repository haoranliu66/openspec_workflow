# 接入指南

## 前置条件

- Node.js 18+
- Git
- OpenSpec CLI 可从命令行执行

## 安装到项目

```powershell
node D:\ai-fullstack-openspec-workflow\bin\workflow.js install --target D:\your-project
```

安装器复制 Schema、模板、治理脚本和核心指南，并创建 `openspec/specs/`、`openspec/changes/archive/` 与生成式 `SPEC.md`。

### 已有文件的处理

- 内容相同：跳过，重复安装保持幂等。
- `openspec/config.yaml` 已存在：保留原文件，新增 `openspec/ai-workflow.config.example.yaml`。
- 其他文件冲突：默认在任何写入前失败。
- 确需升级受管文件：使用 `--force`，旧文件先备份到 `.ai-workflow-backup/<timestamp>/`。

## 合并项目配置

从示例配置中人工合并 `context` 和 `rules`。默认 Schema 可按团队主要工作类型选择，单次 change 仍应显式指定：

```powershell
openspec new change fix-login --schema bugfix
openspec new change add-operations-console --schema product-change
```

## 建立共享需求包

从 `docs/requirements/_templates/` 创建：

```text
docs/requirements/REQ-001-example/
  README.md
  BR-001.md
  PRD-001.md
  FEATURE.md
```

先批准 BR/PRD，再按可独立交付的切片创建一个或多个 changes。

## 接入 CI

至少加入以下步骤：

```powershell
node scripts/openspec-governance.js index
git diff --exit-code -- SPEC.md
node scripts/openspec-governance.js check
openspec schema validate bugfix
openspec schema validate product-change
```

归档不可变检查依赖 Git HEAD，因此 CI 必须正常 checkout 历史。
