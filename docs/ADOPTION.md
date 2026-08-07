# 接入指南

## 前置条件

- Git
- Node.js `>=20.19.0`
- npm

无需预装全局 OpenSpec。源仓库通过固定 Git commit 构建 OpenSpec `1.8.0`，安装器把生产运行时、项目内 launcher 和核心 skills 一并复制到目标项目。目标项目运行 emitted JavaScript，不需要 TypeScript 或 ts-node。

## 从 GitHub 安装到项目

PowerShell：

```powershell
$repoUrl = "https://github.com/haoranliu66/openspec_workflow.git"
$targetProject = "D:\path\to\your-project"
$download = Join-Path ([System.IO.Path]::GetTempPath()) ("openspec-workflow-" + [guid]::NewGuid())

git clone --depth 1 --recurse-submodules $repoUrl $download
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

git clone --depth 1 --recurse-submodules "$repo_url" "$download"
cd "$download"
npm ci
npm run build
node dist/bin/workflow.js install --target "$target_project"
```

`vendor/openspec` 直接跟踪 OpenSpec 官方仓库 commit `d57889664cab4f2f061d236ec3ff82a5578701bb`，用于源码、Schema 和 skills 对齐；`npm ci` 安装该 commit 对应的官方 `1.8.0` 发布包作为可复制运行时。安装器复制其生产依赖闭包到 `.ai-workflow/openspec-runtime/`，安装 `bin/openspec.js`、OpenSpec 原生 core skills、项目治理版 archive skill、bugfix/product-change Schema、requirements 模板、核心指南和 emitted JavaScript，并创建 `openspec/specs/`、`openspec/changes/archive/`、`SPEC.md` 与 pathless `openspec/change-history.json` v1。system-change 使用该固定运行时内置的 spec-driven，不复制或 fork 项目级 `openspec/schemas/spec-driven/`。

安装后验证：

```bash
cd <target-project>
node bin/openspec.js --version
node bin/openspec.js schemas --json
```

版本必须为 `1.8.0`，且 skills 位于 `.agents/skills/`。AI 平台显示的调用名可能是 `/opsx:explore`、`/openspec-explore` 或 `$openspec-explore`；以平台发现的 `openspec-explore` skill 为准。

源工作流仓库用自己的根 `.gitignore` 在正常 Git 操作中排除上游开发过程记录，并由维护团队在提交前复核 staged/tracked 路径；它不新增 CI 或 hook 来阻止显式强制暂存。安装器不复制该文件。目标团队可以且通常应按自身审计要求跟踪 `docs/requirements/REQ-*`、活动/归档 changes、`verification.md` 和安全 evidence；安装或升级不会改变这些路径的 Git 策略。

### 已有文件的处理

- 内容相同：跳过。
- 内容不同：默认在写入前整体失败。
- `--force`：备份冲突文件后覆盖。
- `.agents/skills/openspec-*`：属于受管文件；升级时遵循同样的冲突预检和备份规则。archive skill 是本项目 wrapper，其余 core skills 保持固定上游版本，仅把 CLI 调用改为项目内 launcher。
- 已有 `openspec/config.yaml`：保留原文件，并写出 `openspec/ai-workflow.config.example.yaml` 供人工合并。
- 根 `AGENTS.md` 不存在：用合并样例创建项目自有种子；该文件不进入 `.ai-workflow.json`，后续由项目维护。
- 根 `AGENTS.md` 已存在：始终逐字节保留，即使指定 `--force`；安装结果提示团队审阅最新样例并人工合并。
- 嵌套目录的 `AGENTS.md`：不枚举、不备份、不覆盖、不删除。
- 旧受管 closeout 文件：仅在旧 manifest 声明所有权时备份并退役。
- 现有 history：只接受严格无路径 v1，并在详细 archive 缺失时保持摘要；legacy 完整 v1、v2、无效或未知结构会在任何写入前失败，`--force` 不绕过历史保护。

## 合并项目配置

先让根 `AGENTS.md` 引用 `docs/AI_WORKFLOW_AGENTS.md` 和 `docs/FULLSTACK_WORKFLOW.md`，或审阅 `AGENTS.ai-workflow.example.md` 后把适用的 AI 执行约束合入现有项目指引。完整流程及 `/opsx:explore` 的全部规则只以 [`FULLSTACK_WORKFLOW.md`](FULLSTACK_WORKFLOW.md#4-统一生命周期) 为准，不要在根 AGENTS 中复制另一套流程。

对代码、产品行为或系统行为的变更，本工作流应作为唯一 change 交付生命周期；其他 workflow/skill 只作为按需的有界辅助。发现实质冲突时记录来源、影响、优先级和建议方案，无法消解时等待用户决定。

再将 OpenSpec 示例中的 `context`、`rules` 和 `operations` 合入项目实际 `openspec/config.yaml`，保留团队自己的领域约束。配置只补充 OpenSpec 上下文和执行约束，不维护第二套生命周期；重点保留 apply 前授权停顿、change 内 verification、团队关闭审核、独立关闭授权和 archive wrapper 边界。

GitNexus 是可选推荐工具，尤其适合大型或陌生仓库。使用前检查仓库上下文和索引新鲜度，只加载与探索、影响分析、调试或重构任务匹配的能力；不可用时回退到代码搜索与测试。不要把 GitNexus 结果当成 specs、验证证据、CI 或 close 门禁。

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

formal close 只执行 strict/archive/index/check。项目不再使用 `closeout.json`、closeout template 或 `validate:close`。目标项目已有的历史 closeout/evidence 原样保留但被新命令忽略；新归档的 Requirement 演变同时进入无路径 history v1。
