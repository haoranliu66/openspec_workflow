# 接入指南

## 前置条件

- Git
- Node.js `>=20.19.0`
- npm
- OpenSpec `1.5.0`

目标项目运行 emitted JavaScript，不需要 TypeScript 或 ts-node。

## 从 GitHub 安装到项目

PowerShell：

```powershell
$repoUrl = "https://github.com/haoranliu66/openspec_workflow.git"
$targetProject = "D:\path\to\your-project"
$download = Join-Path ([System.IO.Path]::GetTempPath()) ("openspec-workflow-" + [guid]::NewGuid())

git clone --depth 1 $repoUrl $download
Push-Location $download
npm ci
npm run build
node dist/bin/workflow.js install --target $targetProject
Pop-Location
```

Bash：

```bash
repo_url="https://github.com/haoranliu66/openspec_workflow.git"
target_project="/path/to/your-project"
download="$(mktemp -d)"

git clone --depth 1 "$repo_url" "$download"
cd "$download"
npm ci
npm run build
node dist/bin/workflow.js install --target "$target_project"
```

安装器复制 bugfix/product-change Schema、requirements 模板、核心指南和 emitted JavaScript，并创建 `openspec/specs/`、`openspec/changes/archive/`、`SPEC.md` 与 pathless `openspec/change-history.json` v2。system-change 使用目标环境 OpenSpec 内置 spec-driven，不复制 Schema。

源工作流仓库用自己的根 `.gitignore` 排除上游开发记录，但安装器不复制该文件。目标团队可以且通常应按自身审计要求跟踪 `docs/requirements/REQ-*`、活动/归档 changes、`verification.md` 和安全 evidence；安装或升级不会改变这些路径的 Git 策略。

### 已有文件的处理

- 内容相同：跳过。
- 内容不同：默认在写入前整体失败。
- `--force`：备份冲突文件后覆盖。
- 已有 `openspec/config.yaml`：保留原文件，并写出 `openspec/ai-workflow.config.example.yaml` 供人工合并。
- 旧受管 closeout 文件：仅在旧 manifest 声明所有权时备份并退役。
- 现有 history：有效 v1 自动迁移为 v2，有效 v2 在详细 archive 缺失时保持历史；无效或未知版本会在任何写入前失败，`--force` 不绕过历史保护。

## 合并项目配置

将示例中的 context/rules 合入项目实际 `openspec/config.yaml`，保留团队自己的领域约束。重点确保：路径选择、apply 前授权停顿、change 内 verification、团队关闭审核、独立关闭授权和 archive 不可变边界没有冲突。

product-change 的共享 BR/PRD 前置属于团队流程治理，不是 artifact graph 或 CI 门禁。新 product change 不生成 local FEATURE，仍保留 change-local BR/PRD 绑定。

## 建立共享需求包

从 `docs/requirements/_templates/` 创建：

```text
docs/requirements/REQ-123-example/
├── README.md
├── BR-123.md
├── PRD-123.md
└── FEATURE.md
```

BR/PRD 记录外层产品目标和结果级验收；精确 SHALL/MUST 与 WHEN/THEN 只进入 capability specs。FEATURE 只声明已经实现、验证并经团队审核的结果。

## 接入 CI

源仓库推荐：

```bash
npm ci
npm run verify
```

安装目标至少运行：

```bash
node scripts/validate-schemas.js
node scripts/validate-changes.js
node scripts/openspec-governance.js check
```

这些命令验证结构、strict OpenSpec 和生成文件一致性，不验证 tasks 完成、证据充分性、产品追踪或团队批准。

## 验证与关闭 change

在 `openspec/changes/<change>/verification.md` 保存详细测试用例、实际结果、四项风险适用性、未完成项、限制、回滚和安全 evidence 引用。补充材料可放在 `evidence/`；敏感或大型材料使用外部受控存储。

团队审核后，AI 展示关闭摘要并等待后续明确关闭授权。获得授权后运行：

```bash
node bin/workflow.js close <change> --target .
```

formal close 只执行 strict/archive/index/check。项目不再使用 `closeout.json`、closeout template 或 `validate:close`。目标项目已有的历史 closeout/evidence 原样保留但被新命令忽略；新归档的 Requirement 演变同时进入无路径 history v2。
