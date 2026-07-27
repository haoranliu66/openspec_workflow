# 单 Change 关闭校验设计

**日期：** 2026-07-27  
**状态：** 用户已确认分段设计，等待书面设计复核  
**范围：** `validate:close <change>`、标准关闭入口、closeout 数据契约与安装产物

## 1. 背景

仓库当前的 `validate:changes` 会枚举全部活动 changes，并逐项执行
`openspec validate <change> --strict`。它负责开发过程中的 OpenSpec 结构校验，
不判断单个 change 是否已经满足交付关闭条件。

关闭前需要增加四类内容级治理：

1. `tasks.md` 的真实任务已经全部完成；
2. 安全、迁移、浏览器、回滚四项门禁的适用性矩阵完整，适用项具有成功证据；
3. change `feature.md` 的每条交付结论与 Evidence ID 逐条关联，并在共享
   `FEATURE.md` 中登记当前 change；
4. product-change 的每个 delta Requirement 都与共享 PRD 中真实存在的验收 ID
   建立引用。

这些规则应成为关闭阶段的程序硬门禁，但不得影响仍在开发中的其他活动 changes。

## 2. 目标与非目标

### 2.1 目标

- 提供明确传入一个活动 change 的 `validate:close <change>`。
- 在关闭校验中先执行该 change 的 OpenSpec strict validation，再执行内容级校验。
- 使用 change 内的 `closeout.json` 保存机器可读的引用关系和证据索引。
- 为 product-change 和 bugfix 提供不同的关闭规则。
- 提供包含关闭校验、归档、索引重建和治理检查的标准 `workflow close` 入口。
- 将所需模板和 emitted JavaScript 安装到目标项目。
- 保持零新增运行时依赖。

### 2.2 非目标

- 不改变 bugfix 或 product-change 的 OpenSpec artifact graph。
- 不在日常 `validate:changes` 中要求未完成的活动 change 满足关闭规则。
- 不执行 `closeout.json` 中记录的命令。
- 不通过程序判断 Requirement 与 PRD 验收项的语义是否真正等价。
- 不通过程序判断门禁“不适用”理由是否合理。
- 不阻止有意绕过标准入口、直接调用底层 `openspec archive` 的人员；治理文档只认可
  `workflow close` 为标准关闭路径。
- 不增加 archive base-ref、full-history、hash 或跨提交不可变性证明。

## 3. 命令与组件

### 3.1 命令

源仓库：

```powershell
npm run validate:close -- <change>
node dist/bin/workflow.js close <change> --target <project>
```

安装目标：

```powershell
node scripts/validate-close.js <change>
node bin/workflow.js close <change> --target <project>
```

标准 CLI 形式：

```text
workflow validate:close <change> --target <project>
workflow close <change> [--skip-specs] --target <project>
```

`validate:close` 和 `close` 都只接受一个符合现有 change ID 规则的活动 change。
`--skip-specs` 只允许用于 `close`。

### 3.2 组件边界

- `lib/closeout-validation.ts`
  - 定义 closeout 类型、诊断类型和纯校验函数；
  - 读取已经由调用者提供的文件内容或项目根目录；
  - 不执行外部命令、不写文件。
- `scripts/validate-close.ts`
  - 解析单个 change ID；
  - 确认 change 是活动 change；
  - 通过安全参数数组执行 `openspec validate <change> --strict`；
  - 调用关闭内容校验并设置退出状态。
- `bin/workflow.ts`
  - 暴露 `validate:close`；
  - 暴露标准 `close` 编排入口。
- `lib/installer.ts`
  - 将新增 emitted JavaScript、closeout 模板和相关文档作为受管安装产物分发。

### 3.3 `validate:close` 数据流

```text
change ID
  -> 活动 change 与 schema 识别
  -> openspec validate <change> --strict
  -> closeout.json 结构校验
  -> tasks 完成度
  -> Evidence 与门禁矩阵
  -> delta Requirement ID
  -> product-change 的 PRD 与 FEATURE 交叉引用
  -> 确定性诊断或成功结果
```

校验器一次性收集内容级问题。OpenSpec strict validation 无法执行或失败时立即停止，
因为后续内容校验不应掩盖 change 自身的结构错误。

## 4. `closeout.json` 数据契约

### 4.1 Product change

```json
{
  "version": 1,
  "prd": "docs/requirements/REQ-001-login/PRD-001.md",
  "sharedFeature": "docs/requirements/REQ-001-login/FEATURE.md",
  "requirements": [
    {
      "id": "AUTH-001",
      "acceptanceIds": ["PA-001"]
    }
  ],
  "featureResults": [
    {
      "id": "FR-001",
      "evidenceIds": ["EV-E2E-001", "EV-TEST-001"]
    }
  ],
  "evidence": [
    {
      "id": "EV-E2E-001",
      "type": "browser",
      "status": "passed",
      "command": "npm run test:e2e",
      "artifact": "artifacts/e2e/report.json"
    },
    {
      "id": "EV-TEST-001",
      "type": "test",
      "status": "passed",
      "command": "npm test",
      "artifact": "artifacts/tests/report.json"
    },
    {
      "id": "EV-SEC-001",
      "type": "security",
      "status": "passed",
      "command": "npm run test:security",
      "artifact": "artifacts/security/report.json"
    },
    {
      "id": "EV-RB-001",
      "type": "rollback",
      "status": "passed",
      "command": "npm run test:rollback",
      "artifact": "artifacts/rollback/report.json"
    }
  ],
  "gates": {
    "security": {
      "applicable": true,
      "reason": "修改了登录授权流程",
      "evidenceIds": ["EV-SEC-001"]
    },
    "migration": {
      "applicable": false,
      "reason": "没有数据结构或历史数据变化",
      "evidenceIds": []
    },
    "browser": {
      "applicable": true,
      "reason": "修改了用户主流程",
      "evidenceIds": ["EV-E2E-001"]
    },
    "rollback": {
      "applicable": true,
      "reason": "需要验证版本回退路径",
      "evidenceIds": ["EV-RB-001"]
    }
  }
}
```

### 4.2 Bugfix

bugfix 的 closeout 只包含：

- `version`
- `evidence`
- `gates`

bugfix 没有 PRD 和 feature artifacts，因此不要求 `prd`、`sharedFeature`、
`requirements` 或 `featureResults`。bugfix 的 delta Requirements 仍必须使用稳定 ID。

### 4.3 字段规则

- `version` 必须精确为 `1`。
- 顶层对象和所有嵌套对象均拒绝未知字段。
- Requirement 与 PRD acceptance ID 使用现有格式：
  `^[A-Z][A-Z0-9]*-\d+$`。
- FEATURE result ID 使用：
  `^FR-[A-Z0-9]+(?:-[A-Z0-9]+)*$`。
- Evidence ID 使用：
  `^EV-[A-Z0-9]+(?:-[A-Z0-9]+)*$`。
- 所有 ID 在各自命名空间内唯一。
- 所有引用数组非空、元素唯一；`applicable: false` 的门禁是唯一允许空
  `evidenceIds` 的位置。
- Evidence `type` 只允许：
  `test`、`build`、`security`、`migration`、`browser`、`rollback`、
  `acceptance`、`monitoring`、`other`。
- Evidence `status` 在关闭时必须精确为 `passed`。
- Evidence `command` 必须为非空字符串，但仅作为执行记录，校验器绝不执行它。
- Evidence `artifact` 必须为项目根目录内的相对路径。
- artifact 必须存在并解析为普通文件。允许目标仍在项目根目录内的 symlink；
  拒绝绝对路径、`..` 目录穿越、目录目标和解析到项目外的 symlink。

### 4.4 门禁矩阵

`gates` 必须且只能包含：

- `security`
- `migration`
- `browser`
- `rollback`

每项都必须包含 `applicable`、非空 `reason` 和 `evidenceIds`。

- `applicable: true`
  - 至少引用一个 Evidence；
  - 所有引用存在且状态为 `passed`；
  - 每个被该门禁引用的 Evidence，其 `type` 都必须与门禁名称一致。
- `applicable: false`
  - `evidenceIds` 必须为空；
  - 理由是否合理留给评审人员判断。

## 5. Tasks 完成度

关闭校验读取 change 根目录的 `tasks.md`：

- 忽略 fenced code blocks 中的 checkbox 示例；
- 必须至少存在一个实际 Markdown checkbox；
- `[x]` 和 `[X]` 是唯一完成状态；
- `[ ]`、`[-]`、`[~]` 或其他 checkbox 状态都会阻止关闭。

取消或不适用任务必须先在正文中记录理由，再由团队明确处理为已完成；不得保留
未完成状态后关闭。

## 6. Requirement 与 PRD 验收引用

### 6.1 Delta Requirement

校验器读取当前 change 的所有 `specs/*/spec.md`，复用并扩展现有 delta parser：

- ADDED、MODIFIED、REMOVED 的 `### Requirement:` 标题必须以稳定 Requirement ID
  开头；
- RENAMED 的 FROM 与 TO 都必须以稳定 ID 开头，而且 ID 必须相同；
- 任意 operation 缺少 ID 都会阻止关闭；
- 同一 change 中重复 Requirement ID 会阻止关闭。

示例：

```markdown
## RENAMED Requirements

- FROM: AUTH-001 Old name
- TO: AUTH-001 New name
```

### 6.2 PRD 路径与验收表

product-change 的 change `prd.md` 必须使用结构化字段绑定共享 PRD：

```markdown
- **共享 PRD**：`docs/requirements/REQ-001-login/PRD-001.md`
```

该规范化路径必须与 `closeout.json.prd` 完全一致。

共享 PRD 的 `## 结果级验收` 表第一列是验收 ID。校验器要求：

- 至少存在一个真实数据行；
- ID 格式有效；
- ID 唯一；
- 占位符或空 ID 不计为真实验收项。

### 6.3 映射完整性

- 每个 delta Requirement ID 必须在 `requirements` 中恰好出现一次；
- 每个映射至少引用一个共享 PRD 中真实存在的验收 ID；
- closeout 不得映射当前 change 中不存在的 Requirement；
- 一个共享 PRD 可以拆分到多个 changes，因此不要求当前 change 覆盖 PRD 的全部验收 ID；
- 程序只证明引用完整性，语义正确性仍由评审负责。

## 7. FEATURE 与 Evidence 引用

### 7.1 Change feature

product-change 的 `feature.md` 使用结构化结果表：

```markdown
| 结果 ID | 已交付结论 | Evidence IDs |
|---|---|---|
| FR-001 | 用户可以完成登录 | EV-E2E-001, EV-TEST-001 |
```

校验规则：

- 至少存在一条结果；
- 结果 ID 唯一且格式有效；
- 结论非空；
- Evidence ID 列至少包含一个唯一引用；
- FEATURE 表与 `closeout.json.featureResults` 的结果 ID 和 Evidence ID 集合完全一致；
- 每个 Evidence 引用都必须存在且为 `passed`；
- closeout 不得包含 FEATURE 中不存在的结果。

`feature.md` 的验证证据章节继续提供面向人的摘要，但 `closeout.json.evidence` 是关闭
校验使用的结构化证据索引。

### 7.2 Shared FEATURE

共享 `docs/requirements/REQ-*/FEATURE.md` 的交付台账改为：

```markdown
| Change | 结果 IDs | 已交付切片 | 版本 / 日期 | 状态 |
|---|---|---|---|---|
```

校验器只读取 `closeout.json.sharedFeature` 指向的文件，并只校验当前 change：

- 至少存在一条当前 change 的台账记录；
- 当前 change 多行记录中的结果 ID 合集覆盖 change `feature.md` 的全部结果；
- 不重新校验其他历史 changes 的结果或证据。

## 8. Schema 分层

| 规则 | product-change | bugfix |
|---|---:|---:|
| OpenSpec strict validation | 必须 | 必须 |
| tasks 全完成 | 必须 | 必须 |
| 四项门禁矩阵 | 必须 | 必须 |
| 适用门禁成功 Evidence | 必须 | 必须 |
| Delta Requirement 稳定 ID | 必须 | 必须 |
| Requirement → PRD acceptance | 必须 | 不适用 |
| change FEATURE → Evidence | 必须 | 不适用 |
| shared FEATURE 当前 change 台账 | 必须 | 不适用 |

schema 以 change 根目录 `.openspec.yaml` 为事实来源。未知 schema 或 schema 与字段组合
不一致时关闭失败。

## 9. 标准关闭入口

```text
workflow close <change> [--skip-specs] --target <project>
```

顺序固定为：

1. 执行 `validate:close <change>`；
2. 执行 `openspec archive <change> --yes --json`；
3. 指定 `--skip-specs` 时将其传给 archive；
4. 重建 `SPEC.md` 与 `openspec/change-history.json`；
5. 执行 governance check。

失败语义：

- 校验失败：不执行 archive，不修改项目；
- archive 失败：立即停止，不重建生成文件；
- archive 成功而 index/check 失败：
  - 不自动撤销 archive；
  - 退出非零；
  - 明确报告归档已经完成；
  - 指引运行现有 `workflow index` 与 `workflow check` 恢复。

所有 OpenSpec 调用继续使用 `execFileSync` 风格的参数数组，不使用 shell 命令拼接。

## 10. 诊断与确定性

内容校验返回结构化诊断：

```ts
interface CloseoutDiagnostic {
  code: string;
  path: string;
  message: string;
}
```

首版诊断类别：

- `CHANGE_NOT_ACTIVE`
- `SCHEMA_UNSUPPORTED`
- `CLOSEOUT_MISSING`
- `CLOSEOUT_INVALID`
- `TASKS_INVALID`
- `EVIDENCE_INVALID`
- `GATE_INVALID`
- `REQUIREMENT_INVALID`
- `PRD_TRACE_INVALID`
- `FEATURE_TRACE_INVALID`
- `SHARED_FEATURE_INVALID`

诊断按校验阶段、路径和出现顺序稳定输出。测试断言错误码、路径和行为，不依赖完整人类
措辞。成功时输出 change ID、schema 和通过的关闭检查摘要。

## 11. 模板、安装与文档

新增：

```text
docs/closeout-templates/product-change.json
docs/closeout-templates/bugfix.json
```

安装器将它们作为受管文件复制到目标项目。使用者复制对应模板到：

```text
openspec/changes/<change>/closeout.json
```

同步更新：

- `README.md`
- `AGENTS.md`
- `docs/FULLSTACK_WORKFLOW.md`
- `docs/QUALITY_GATES.md`
- `docs/OPERATIONS.md`
- `docs/ADOPTION.md`
- 示例项目 README
- product-change、bugfix 的 tasks/spec/feature/PRD/共享 FEATURE 模板说明
- `openspec/config.yaml`

官方关闭说明统一使用 `workflow close`。底层直接 archive 仅作为故障恢复背景知识，不再
作为标准流程入口。

## 12. 测试策略

按 TDD 实施：

1. `closeout-validation` 单元测试
   - JSON 类型、缺失字段、未知字段；
   - ID 格式、唯一性与悬空引用；
   - tasks checkbox、嵌套任务和 fenced code；
   - evidence artifact 绝对路径、穿越、目录、缺失文件、symlink 逃逸；
   - 四项门禁的完整性、适用性与 evidence type；
   - product-change 和 bugfix 分层。
2. 追溯测试
   - ADDED、MODIFIED、REMOVED、RENAMED Requirement；
   - PRD 路径与验收表；
   - local feature、closeout、shared FEATURE 三方一致性。
3. 命令与编排测试
   - change ID 和参数解析；
   - strict validation 在内容校验之前；
   - `close` 的调用顺序；
   - `--skip-specs`；
   - 校验失败、archive 失败、archive 后 index/check 失败。
4. 安装与集成测试
   - 安装 manifest 包含新增 emitted JavaScript 和模板；
   - 安装目标不依赖 TypeScript；
   - 在临时真实项目中运行成功和失败 fixture。
5. 完整验证
   - `npm run verify`
   - `git diff --check`

测试验证结构化契约、错误码和真实行为，不新增针对人类说明文案的精确字符串测试。

## 13. 采用与迁移

- 既有活动 change 在准备关闭前添加 `closeout.json`，不要求在开发开始时立即迁移。
- 已归档 changes 不改写。
- 未准备关闭的活动 changes 继续只受现有 `validate:changes` 约束。
- product-change 在关闭前补齐 PRD、FEATURE 和 trace 表。
- bugfix 在关闭前补齐 tasks、稳定 Requirement ID、门禁矩阵和 Evidence。
- 高风险门禁的“不适用”理由必须进入人工评审；程序不把非空理由等同于合理批准。

## 14. 验收标准

1. `validate:changes` 对开发中 change 的行为保持不变。
2. `validate:close <change>` 只校验指定的活动 change。
3. 缺失或无效 closeout、未完成 tasks、不完整门禁、无成功证据、悬空引用都会以非零状态
   失败。
4. product-change 的 Requirement/PRD 和 FEATURE/Evidence 引用完整性得到程序证明。
5. bugfix 不被错误要求提供不存在的 PRD/FEATURE artifacts。
6. `workflow close` 在校验成功前不会 archive。
7. 安装目标可用 emitted JavaScript 完成相同行为。
8. artifact graph、现有活动 change strict validation 和 archive 流程治理边界不被改写。
