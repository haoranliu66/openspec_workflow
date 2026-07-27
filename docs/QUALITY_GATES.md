# 全栈质量门禁

只有命令或 CI 实际执行的检查才叫程序门禁。共享 BR/PRD 的完成顺序和已归档 change 不得修改属于团队流程治理规则，依靠团队评审与协作执行；它们不由 Schema、脚本或 CI 强制。程序门禁按改动面选择，不要求每个 change 执行无关工具。`tasks.md` 必须写明选择了哪些门禁、命令和结果；跳过高相关门禁必须说明原因。

## 所有变更

- 需求 ID、delta spec、任务和代码之间可追溯。
- 建立可复现的失败或现状证据，再实施修复或能力。
- 运行受影响单元测试、静态检查与构建。
- 检查错误、空态、重试、权限和回滚路径。
- 按当前 change 执行 OpenSpec 校验并记录结果；工作流 CI 还会枚举全部活动 changes 并逐项执行 `openspec validate <change> --strict`。

## 前端

- 核心状态与分支有组件或单元测试。
- 真实浏览器验证主要流程、失败态和权限态。
- 涉及布局时至少检查桌面和移动视口，不允许遮挡、溢出或布局跳动。
- 涉及实时数据时验证初始化、刷新、隐藏/恢复、请求防重和销毁。
- 检查键盘语义、焦点、可访问名称及项目国际化约定。

## 后端与接口

- 契约、校验、错误码、鉴权和租户/医院隔离有自动化证据。
- 幂等、并发、超时、重试和部分失败按风险验证。
- 前后端 DTO、状态枚举和空值语义一致。
- 接口变化有兼容策略或明确迁移边界。

## 数据与迁移

- 迁移可重复、可观测并具备回滚或前滚方案。
- 验证历史数据、脏数据、唯一性和隔离边界。
- 大数据量操作评估锁、耗时和发布窗口。

## 安全与隐私

- 后端执行真正授权，前端显隐不作为安全边界。
- 检查输入验证、敏感信息、审计、最小权限和越权测试。
- 高风险结论由相应负责人评审，不由 AI 自行假设合规。

## 发布与运营

- 明确开关、灰度、兼容窗口、监控指标和告警责任人。
- 回滚步骤可执行，且不会破坏已写入数据。
- `feature` artifact ready 只表示可以开始编写 FEATURE；FEATURE 仅写具备实现与验证证据的可交付行为。两者都不代表关闭已经完成，已知限制应有后续 change 或运营说明。

## 工作流仓库门禁

贡献者使用 Node.js `>=20.19.0`、OpenSpec `1.5.0`，并运行：

```powershell
npm ci
npm run build
npm run verify
git diff --check
```

CI 在 Node.js 20.19 和 22 上检查 TypeScript 源边界、测试、两个确定性生成文件、两个 schema、全部活动 changes 的逐项 strict validation 以及当前治理命令。`dist/` 可以在构建时生成，但 `bin/`、`lib/`、`scripts/`、`tests/` 下不得出现 `.js`。

## 收尾治理

未提前 sync：

```powershell
npm run validate:close -- <change>
node dist/bin/workflow.js close <change> --target .
git diff --check
```

已经执行 `/opsx:sync` 时，将 close 命令改为：

```powershell
npm run validate:close -- <change>
node dist/bin/workflow.js close <change> --skip-specs --target .
```

## Closeout validation boundary

Before closeout, every real task checkbox must be complete and the security, migration, browser, and rollback matrix must be present. Applicable gates require passed matching evidence; inapplicable gates require a reason and no evidence IDs. Product changes also require FEATURE/evidence and Requirement/PRD acceptance references; bugfixes require stable delta Requirement IDs. The program establishes structure, references, project-local artifact existence, and declared evidence only. It does not establish semantic correctness, evidence sufficiency, or a reasonable N/A rationale, and it never executes `closeout.json.command`. `validate:changes` remains separate from the one-change `validate:close <change>` gate.

活动 change strict validation 已是 2.1.0 程序门禁。已归档 change 的内容按团队流程不得修改；本项目不要求、也不承诺通过 base ref、full history、hash、脚本或 CI 强制证明归档不可变。
