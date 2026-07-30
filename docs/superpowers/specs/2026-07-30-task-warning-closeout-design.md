# Tasks 警告式关闭设计

**日期：** 2026-07-30
**状态：** 已批准，待实施

## 1. 目标

降低 change 关闭时对 `tasks.md` 的机械性阻塞，同时保留清晰、可审计的交付边界：

- 未完成的真实 checkbox 产生程序警告，但不再阻止 `validate:close` 或 `workflow close`；
- AI 应优先继续完成仍可实现的 task；
- AI 判断 task 无法实现、取消或需要延期时，必须先向用户说明原因与交付影响并取得明确确认；
- 用户确认属于团队流程治理，不由 Schema、脚本或 CI 强制证明；
- 其他现有关闭硬门禁保持不变。

本次不改变 OpenSpec artifact graph，不新增运行时依赖，也不增加 `closeout.json` 字段。

## 2. 语义边界

### 2.1 程序警告

排除 fenced code block 后，`tasks.md` 中每个真实 checkbox 按以下规则处理：

- `[x]`、`[X]`：已完成，不产生消息；
- `[ ]`、`[-]`、`[~]` 或其他非 `x` marker：产生 `TASKS_INCOMPLETE` 警告；
- 警告包含 `tasks.md` 路径和原始行号；
- 只有 `TASKS_INCOMPLETE` 警告时，关闭校验退出码为 `0`，标准关闭流程可以继续。

### 2.2 结构性硬错误

以下情况不是“未完成”，仍产生阻止关闭的 `TASKS_INVALID`：

- `tasks.md` 缺失或无法读取；
- 排除 fenced code block 后没有任何真实 checkbox。

其他现有硬门禁不降级：

- `closeout.json` 严格结构；
- evidence artifact 的项目内文件约束；
- security、migration、browser、rollback 门禁矩阵与成功 evidence；
- product-change 的 Requirement/PRD 验收引用；
- product-change 的 FEATURE/evidence 引用；
- bugfix 的稳定 delta Requirement ID；
- 显式 change 的 OpenSpec strict validation。

## 3. AI 与用户治理规则

程序只报告未完成 task，不判断它是否“无法实现”，也不验证用户确认。

AI 收到 `TASKS_INCOMPLETE` 后：

1. 对仍可实现的 task，继续实现和验证；
2. 对因技术限制、外部依赖、授权边界、范围取消或延期而无法完成的 task，说明：
   - 未完成原因；
   - 对 Requirement、FEATURE 结论和交付范围的影响；
   - 建议的取消、延期或后续 change；
3. 在执行 `workflow close` 前取得用户明确确认；
4. 若未完成 task 使某项 Requirement 或 FEATURE 结论不再真实，必须先缩小、撤回或标记相应声明，不得继续宣称已经交付。

该确认是团队评审与协作责任。程序和 CI 不读取对话记录，也不增加审批字段或审批凭据。

## 4. 类型与组件设计

### 4.1 Task 校验结果

`lib/closeout-p0.ts` 新增：

```ts
export interface TaskValidationResult {
  diagnostics: CloseoutDiagnostic[];
  warnings: CloseoutDiagnostic[];
}

export function validateTasksMarkdown(
  content: string,
  sourcePath: string,
): TaskValidationResult;
```

`diagnostics` 只保存阻止关闭的结构错误；`warnings` 保存 `TASKS_INCOMPLETE`。

### 4.2 聚合关闭结果

`CloseoutValidationResult` 保留 `diagnostics` 的阻止语义，并新增：

```ts
warnings: CloseoutDiagnostic[];
```

结果必须始终显式包含 `warnings`，避免调用方把缺失字段误解为未处理。

校验顺序保持：

1. OpenSpec strict；
2. closeout contract；
3. tasks errors/warnings；
4. evidence/gates；
5. Requirement/PRD；
6. FEATURE/evidence。

warnings 不改变 diagnostics 的确定性顺序。

### 4.3 命令行为

`npm run validate:close -- <change>` 与安装目标的 `node scripts/validate-close.js <change>`：

- 每条 warning 写入 stderr，格式为 `WARNING CODE path: message`；
- 只有 warnings 时仍输出成功摘要并以 `0` 退出；
- 存在 diagnostics 时保持非零退出。

`workflow validate:close` 使用相同语义。

### 4.4 标准关闭编排

`closeChange()` 在 archive 前：

1. 执行关闭校验；
2. 报告所有 warnings；
3. 仅当 diagnostics 非空时阻止 archive；
4. 只有 warnings 时继续 `archive -> index -> check`。

为保证 warning 在归档前可见，`CloseWorkflowDependencies` 增加可注入的 warning writer。默认 writer 输出到 stderr；测试注入 recorder 验证 warning 先于 archive。

`CloseWorkflowResult` 不承担延迟报告 warning 的职责，避免归档后才暴露未完成 task。

## 5. 模板与文档

需要统一更新：

- `AGENTS.md`；
- `README.md`；
- `docs/FULLSTACK_WORKFLOW.md`；
- `docs/QUALITY_GATES.md`；
- `docs/OPERATIONS.md`；
- `docs/ADOPTION.md`；
- `openspec/config.yaml`；
- product-change 与 bugfix 的 `tasks.md` 模板。

统一表述：

- 未完成 tasks 是程序警告，不再是关闭硬门禁；
- AI 的判断、说明和用户确认属于流程治理；
- 缺失或不可解析的 tasks 输入仍阻止关闭；
- 其他 closeout 结构与引用门禁保持强制；
- archive 不可变和 product change 前置 BR/PRD 的既有治理边界不变。

## 6. 测试策略

行为测试必须覆盖：

- `[x]`、`[X]` 无 warning；
- `[ ]`、`[-]`、`[~]` 产生 `TASKS_INCOMPLETE`，保留路径和行号；
- fenced 示例不产生 warning；
- 无 checkbox 产生 `TASKS_INVALID`；
- 缺失 `tasks.md` 产生 `TASKS_INVALID`；
- product-change 与 bugfix 都聚合 task warnings；
- `validate:close` 只有 warnings 时退出 `0`，warning 走 stderr；
- `workflow close` 在 archive 前报告 warning，并继续归档；
- blocking diagnostic 仍阻止归档；
- 真实安装目标中，带未完成 task 的 change 可以关闭且输出 warning；
- evidence、gate、PRD、FEATURE 与稳定 Requirement ID 的失败行为保持阻止关闭。

测试断言 code、path、severity collection、退出码和调用顺序，不新增完整人类说明文案字符串测试。

## 7. 非目标

- 不让程序判断 task 是否技术上无法实现；
- 不让程序读取或验证用户确认；
- 不增加 `--force`、`--allow-incomplete-tasks` 或交互式确认参数；
- 不增加 task waiver、审批人或对话凭据字段；
- 不降低 evidence、gate、PRD、FEATURE 或 Requirement ID 门禁；
- 不改变 `validate:changes`；
- 不改变 OpenSpec schema graph；
- 不改写 archive。
