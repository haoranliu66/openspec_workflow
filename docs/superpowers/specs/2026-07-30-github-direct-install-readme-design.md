# README GitHub 直接安装设计

**日期：** 2026-07-30

**状态：** 已确认

**目标文件：** `README.md`

## 目标

把 README “五分钟快速开始”中的本地源码路径安装方式改为从 GitHub `main` 分支一次性获取并执行工作流 CLI。接入团队不再需要预先克隆工作流仓库、设置 `$workflowRepo` / `workflow_repo`、安装工作流源仓库依赖或运行源仓库验证。

## 选定方案

PowerShell 与 Bash 都使用：

```text
npm exec --yes --package="github:haoranliu66/openspec_workflow#main" -- ai-fullstack-workflow install --target <project>
```

选择 `npm exec` 的原因：

- GitHub package spec 直接指向远程仓库；
- `--yes` 避免 npm 的临时安装确认提示；
- `--package` 将仓库 `package.json` 中声明的 `ai-fullstack-workflow` binary 加入临时 PATH；
- 仓库现有 `prepare` 会在 Git 依赖安装期间构建 TypeScript，现有 `bin` 指向生成的 `dist/bin/workflow.js`；
- 命令执行后不保留全局 CLI，也不要求用户管理工作流源码目录。

## README 变更

1. 前置条件保留 Node.js、Git、npm 与 OpenSpec `1.5.0`。
2. PowerShell 示例只保留 `$targetProject`，然后用 `npm exec` 从 GitHub 安装到该目标。
3. Bash 示例只保留 `target_project`，使用同一 GitHub package spec。
4. 两个平台安装后继续进入目标项目，运行 schema、index 与 check。
5. 快速开始后的说明改为：
   - `npm exec` 临时获取 GitHub `main` 并执行现有 CLI；
   - Git 依赖的 `prepare` 负责生成 emitted JavaScript；
   - 目标项目仍只接收 emitted JavaScript，不依赖 TypeScript 或 ts-node；
   - OpenSpec `1.5.0` 仍是目标环境的外部 CLI 前置条件。
6. 源仓库维护者的 `npm ci`、`npm run verify` 等命令仍保留在后文“命令参考”和“维护者验证”，不再出现在接入团队的安装主路径。

## 边界与失败语义

- 不新增或修改 CLI 命令、参数、依赖、Schema、模板或安装器行为。
- GitHub `main` 必须先包含待安装版本；本地未推送提交不会被远程安装命令获取。
- Git、GitHub 网络访问、npm 下载及 lifecycle scripts 必须在执行环境中可用。
- 组织若限制非 registry 依赖或 install scripts，需要按组织策略允许该 GitHub package spec 及其 `prepare`。
- `--force` 不进入快速开始；冲突处理继续由后文安装器章节说明。

## 验证

实施后验证：

1. README 不再包含 `$workflowRepo`、`workflow_repo` 或示例本地工作流源码路径。
2. PowerShell 与 Bash 使用相同的 GitHub package spec 和 binary。
3. `package.json` 仍声明 `prepare` 与 `ai-fullstack-workflow` bin。
4. 使用隔离临时目标实际运行 GitHub 安装命令，并执行已安装的 schema、index 与 check。
5. 运行 `git diff --check`；不新增文案字符串测试。

## 文件范围

实施阶段只修改 `README.md`。本文是设计记录；此前 README 的远程文档链接修改应保留，不与本次安装主路径调整混淆。
