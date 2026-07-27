# P0：活动 OpenSpec Changes 逐项严格校验设计

**日期：** 2026-07-23  
**状态：** 用户已批准  
**目标版本：** 2.1.0  
**兼容基线：** Node.js >=20.19.0，OpenSpec CLI 1.5.0

## 1. 背景

工作流 2.0.0 已恢复 OpenSpec 1.5.0 原生 product-change 核心图，提供 TypeScript 源码、确定性 change history、schema 校验和目标项目安装能力，但 CI 尚未逐项严格校验活动 changes。仅校验 schema 不能证明每个活动 change 的 delta specs 满足 OpenSpec strict 规则。

本改动补齐这一项 P0：CI 枚举所有活动 change 目录，并对每个 change 执行精确命令：

```text
openspec validate <change> --strict
```

归档不可变和启动 product change 前完成并确认共享 BR/PRD，均继续作为团队应遵守的流程治理规则。本改动不将二者转化为 Schema、脚本或 CI 门禁；其中归档不可变不新增任何程序、Git 基线比较或 CI full-history 要求。

## 2. 目标与非目标

### 2.1 目标

- 以文件系统为活动 change 的权威枚举源，避免损坏的 change 被 OpenSpec 列表命令静默遗漏。
- 对每个活动 change 单独执行 OpenSpec strict validation。
- 一个 change 失败后继续校验其余 changes，最终一次性报告全部失败项。
- 同一实现可在源码仓库、Windows/Linux CI 和安装后的目标项目中运行。
- 保持 TypeScript-only 源码；目标项目只接收 emitted JavaScript。
- 将工作流版本提升到 2.1.0，并同步 CI、安装器、验证脚本与操作文档。

### 2.2 非目标

- 不实现 archive 内容哈希、Git baseRef、merge-base 或跨分支历史比较。
- 不创建 `archive-integrity` 模块，不增加任何 archive 基线 CLI 行为。
- 不修改、移动或重写任何现有 archive。
- 不将归档不可变或 product change 前置 BR/PRD 转化为 Schema、脚本或 CI 门禁；两者由团队流程治理执行。
- 不使用 `openspec validate --changes` 聚合命令替代逐项校验。
- 不校验 proposal、design、tasks 的业务质量；本功能只执行 OpenSpec CLI 的 strict change validation。

## 3. 活动 Change 枚举契约

活动 change 的枚举规则固定如下：

1. 读取 `<project>/openspec/changes/` 的直接子项。
2. 只保留一级目录，不递归。
3. 排除名称精确等于 `archive` 的目录。
4. 排除名称以 `.` 开头的隐藏目录。
5. 排除普通文件、符号链接和其他非目录项。
6. 按英文名称稳定升序排列。
7. 每个目录名必须满足 OpenSpec change ID 约束 `^[a-z0-9][a-z0-9-]*$`；不合法名称记为失败，绝不拼接进 Windows Shell 命令。

边界行为：

- `openspec/changes/` 不存在或不可读：失败关闭。
- 目录存在但没有活动 changes：输出明确的无活动 change 提示并成功退出。
- change 内 metadata 或 artifact 损坏：仍进入 OpenSpec strict validation，由该 change 失败。

## 4. 架构

### 4.1 `lib/project-root.ts`

从现有 `validate-schemas.ts` 提取项目根目录识别逻辑：

- 源码编译布局：`<repo>/dist/scripts/*.js` 解析到 `<repo>`。
- 安装布局：`<target>/scripts/*.js` 解析到 `<target>`。
- 安装目标目录本身名为 `dist` 时，优先通过 `openspec/schemas` 或 `.ai-workflow.json` marker 识别真实目标根，不能错误上移。

`validate-schemas.ts` 与 `validate-changes.ts` 共同使用该模块，避免两套根目录规则漂移。

### 4.2 `lib/openspec-cli.ts`

提供可测试的跨平台 OpenSpec 调用层：

- `buildInvocation(platform, args, commandShell?)`：验证全部参数后构造命令。
- Unix：使用 `execFileSync("openspec", args)`，不经过 Shell。
- Windows：通过 `cmd.exe /d /s /c` 调用 `openspec.cmd`；因为 `.cmd` 需要 Shell，所以所有参数必须先通过白名单校验。
- `runOpenSpec(args, options)`：统一 cwd、stdio 和编码处理。

change 校验的参数数组必须精确为：

```text
["validate", changeId, "--strict"]
```

`validate-schemas.ts` 同步迁移到共享调用层，但保留现有 native schema alignment 检查和两套 schema 校验行为。

### 4.3 `scripts/validate-changes.ts`

职责分为三个可独立测试的接口：

- `listActiveChanges(root)`：执行第 3 节的目录枚举与排序。
- `validateActiveChanges(root, run?)`：顺序执行所有合法 change；记录非法名称与 OpenSpec 执行失败；不中途停止。
- `main(run?, cwd?)`：解析项目根、输出进度与汇总，并在存在任何失败时抛出单一聚合错误。

每个 change 执行前输出 `[current/total] validating <change>`。OpenSpec 子进程使用继承 stdio，使原始 strict validation 诊断直接出现在 CI 日志中。最终汇总只列失败 change 名称和简短原因，不吞掉原始错误。

### 4.4 Package、安装器与 CI

- 新增 `validate:changes:compiled` 与 `validate:changes` npm scripts。
- `verify` 在 schema validation 后执行逐项 strict change validation。
- 安装器将以下 emitted JavaScript 映射到目标项目：
  - `dist/scripts/validate-changes.js` -> `scripts/validate-changes.js`
  - `dist/lib/openspec-cli.js` -> `lib/openspec-cli.js`
  - `dist/lib/project-root.js` -> `lib/project-root.js`
- GitHub Actions 在 Node 20.19.x 与 22.x matrix 中运行 `npm run validate:changes:compiled`。
- CI 不增加 `fetch-depth: 0`、baseRef 计算、archive hash 或任何 Git 历史依赖。

## 5. 数据流与失败策略

1. 脚本解析源码或安装项目根目录。
2. 枚举、过滤并排序活动 change 目录。
3. 非法 change ID 直接记录失败，继续处理下一项。
4. 对每个合法 change 调用 `openspec validate <change> --strict`。
5. OpenSpec 返回非零时记录该 change 失败，继续处理下一项。
6. 全部处理后：
   - 无失败：成功退出；
   - 有失败：输出稳定排序的失败汇总并以非零状态退出。

失败隔离原则：一个 change 的错误不得阻止其他 change 产生诊断；基础目录无法读取属于全局错误，应立即失败。

## 6. 测试设计

### 6.1 单元测试

- 枚举只包含一级目录，稳定排序。
- 排除 `archive`、隐藏目录、普通文件和符号链接。
- 缺失 changes 根目录失败；空目录成功。
- 非法 change ID 不调用 OpenSpec，并出现在最终失败汇总。
- Unix invocation 保留精确参数数组。
- Windows invocation 生成精确、安全的 `openspec.cmd validate <change> --strict` 命令。
- Shell 元字符、路径分隔符和其他不安全参数被拒绝。
- 注入 runner 模拟多个成功/失败 change，断言全部 change 都被执行且最终聚合失败。

### 6.2 真实 OpenSpec 1.5.0 集成测试

- 将工作流安装到临时目标项目。
- 创建一个满足 strict validation 的有效 change，断言逐项校验成功。
- 创建或破坏一个 change 的 delta spec，使 strict validation 失败。
- 断言脚本仍校验其余 change，最终非零退出并在汇总中包含失败 change。
- 不依赖数组位置解析 OpenSpec artifact graph，不修改任何 archive。

### 6.3 安装与 CI 测试

- 真实 compiled distribution 安装后只包含 JavaScript runtime，无 TypeScript。
- 安装后的 `scripts/validate-changes.js` 可由普通 Node.js 执行。
- manifest 管理新增脚本与共享库。
- CI 源码语言边界、双生成文件漂移、schema validation、strict change validation 和现有 governance check 全部保留。

## 7. 文档与版本

- `package.json` 与 `package-lock.json` 升级到 2.1.0。
- `CHANGELOG.md` 新增 2.1.0 条目。
- README、AGENTS、FULLSTACK_WORKFLOW、QUALITY_GATES、ADOPTION、OPERATIONS 和示例项目文档说明逐项 strict validation 命令。
- 文档必须明确：活动 change strict validation 已启用；归档不可变和 product change 前置 BR/PRD 均仍是团队流程治理规则，没有新增 Schema、脚本或 CI 强制。

## 8. 验收标准

1. 两个活动 change 时，CI 日志出现两次独立的 `openspec validate <change> --strict` 执行。
2. 多个 change 同时失败时，所有 change 均被尝试，最终汇总全部失败项。
3. 空活动 change 仓库成功通过。
4. 损坏或非法命名的活动 change 不会被静默跳过。
5. 源码仓库和安装目标均可在 Windows/Linux 使用同一校验逻辑。
6. `npm run verify` 包含严格活动 change 校验并通过。
7. CI 无任何 archive baseRef、full-history 或 archive-integrity 程序。
8. 版本和操作文档统一为 2.1.0。
