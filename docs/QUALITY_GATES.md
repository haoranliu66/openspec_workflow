# 全栈质量门禁

只有命令或 CI 实际执行的检查才叫程序门禁。共享 BR/PRD 的完成顺序、规划完成后的实施授权和已归档 change 不得修改属于团队流程治理规则，依靠 AI、团队评审与协作执行；它们不由 Schema、脚本或 CI 强制证明。程序门禁按改动面选择，不要求每个 change 执行无关工具。`tasks.md` 必须写明选择了哪些门禁、命令和结果；跳过高相关门禁必须说明原因。

## 路径与风险分类

- `bugfix` 只恢复已确认行为且不新增 Requirement。
- `system-change` 用于不改变产品目标、用户旅程、角色权限、业务规则、公共契约或共享产品验收的有限系统行为；metadata 使用 OpenSpec 内置 `schema: spec-driven`。
- `product-change` 覆盖任一产品治理面变化，即使代码改动很小；边界不明确时也使用该路径。

路径决定所需产品追踪，但不替代按实际改动面选择质量门禁。system-change 没有共享产品文档，不等于可以跳过安全、迁移、浏览器或回滚评估；适用项仍必须有 matching passed evidence。

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
- 共享 FEATURE 每行只写一个具备实现与验证证据的可交付结论，并关联 passed closeout evidence。`ready` 不代表关闭已经完成，已知限制应有后续 change 或运营说明。

## 工作流仓库门禁

贡献者使用 Node.js `>=20.19.0`、OpenSpec `1.5.0`，并运行：

```powershell
npm ci
npm run build
npm run verify
git diff --check
```

CI 在 Node.js 20.19 和 22 上检查 TypeScript 源边界、测试、两个确定性生成文件、两个项目 Schema、OpenSpec 内置 `spec-driven`、全部活动 changes 的逐项 strict validation 以及当前治理命令。`dist/` 可以在构建时生成，但 `bin/`、`lib/`、`scripts/`、`tests/` 下不得出现 `.js`。system-change 直接使用内置 Schema，仓库与安装目标都不复制 `openspec/schemas/spec-driven/`。

## 收尾治理

未提前 sync：

```powershell
node dist/bin/workflow.js close <change> --target .
git diff --check
```

已经执行 `/opsx:sync` 时，将 close 命令改为：

```powershell
node dist/bin/workflow.js close <change> --skip-specs --target .
```

## Closeout validation boundary

An incomplete real task checkbox produces a visible `TASKS_INCOMPLETE` warning and does not block closeout. A missing, unreadable, or checkbox-free `tasks.md` remains a blocking `TASKS_INVALID` error. AI must continue feasible work; before closing a task it judges impossible, cancelled, or deferred, it must explain the reason, delivery and Requirement/FEATURE impact, and follow-up plan, obtain explicit user confirmation, and correct any delivery claim that is no longer true. This confirmation is team process governance and is not enforced or proved by Schema, scripts, or CI.

The security, migration, browser, and rollback matrix remains mandatory. Applicable gates require passed matching evidence; inapplicable gates require a reason and no evidence IDs. Product changes also require shared FEATURE/evidence and Requirement/PRD acceptance references; bugfixes and spec-driven system changes require stable delta Requirement IDs without product trace artifacts. The program establishes valid task input, structure, references, project-local artifact existence, and declared evidence only. It does not establish semantic correctness, evidence sufficiency, or a reasonable N/A rationale. `closeout.json.command` is optional and is never executed; `artifact` remains required. `workflow close <change>` is the only required formal close command, while the separate one-change `validate:close <change>` remains an optional non-mutating preflight.

活动 change strict validation 已是 2.1.0 程序门禁。已归档 change 的内容按团队流程不得修改；本项目不要求、也不承诺通过 base ref、full history、hash、脚本或 CI 强制证明归档不可变。
