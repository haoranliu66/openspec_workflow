# 核心流程完整示例：报表导出服务

本示例以同一个 `report-export` 服务为背景，依次演示 bugfix、原生 system-change 和 product-change。它展示的是可复制的工作方法，不是仓库根目录下的活动 OpenSpec change。

规范规则以 [`docs/FULLSTACK_WORKFLOW.md`](../../docs/FULLSTACK_WORKFLOW.md#4-统一生命周期) 为准。本示例只展示其应用，不定义第二套流程。

示例假设团队在 Windows PowerShell 中操作一个已经使用 Git 的目标项目；Bash 只需替换路径和环境变量写法。目标项目可以按自己的审计政策提交完整的 change、archive、REQ 和 verification，安装器不会替它设置 `.gitignore`。

## 0. 安装工作流

目标环境需要 Git、Node.js `>=20.19.0`、npm 和 OpenSpec `1.5.0`。

```powershell
$repoUrl = "https://github.com/haoranliu66/openspec_workflow.git"
$targetProject = "D:\projects\report-export-service"
$download = Join-Path ([System.IO.Path]::GetTempPath()) ("openspec-workflow-" + [guid]::NewGuid())

git clone --depth 1 $repoUrl $download
Push-Location $download
npm ci
npm run build
node dist/bin/workflow.js install --target $targetProject
Pop-Location

Set-Location $targetProject
node scripts/validate-schemas.js
node scripts/openspec-governance.js check
```

安装后关键结构如下：

```text
report-export-service/
├── AGENTS.md                         # 项目自有；缺失时由安装器创建种子
├── AGENTS.ai-workflow.example.md     # 受管的根治理合并样例
├── SPEC.md                           # 自动生成导航
├── bin/workflow.js
├── docs/
│   ├── FULLSTACK_WORKFLOW.md
│   ├── QUALITY_GATES.md
│   ├── AI_WORKFLOW_AGENTS.md         # 受管的 AI 执行约束
│   └── requirements/_templates/
├── openspec/
│   ├── config.yaml                   # 已存在时安装器改写 example 供人工合并
│   ├── change-history.json           # pathless v1 历史
│   ├── schemas/{bugfix,product-change}/
│   ├── specs/
│   └── changes/archive/.gitkeep
└── scripts/
```

安装器不会复制 `spec-driven` Schema；system-change 直接使用 OpenSpec 自带版本。

如果安装前已有根 `AGENTS.md`，安装器即使在 `--force` 下也会原样保留，并提示团队对照 `AGENTS.ai-workflow.example.md` 人工合并；所有嵌套 `AGENTS.md` 同样不受安装器管理。对代码、产品行为或系统行为的更改，本工作流是唯一 change 交付生命周期，其他 workflow/skill 只在当前 change 内按需辅助。实质冲突必须报告来源、影响、优先级与建议方案，无法消解时等待用户决定。

例如，面对陌生的报表服务，可先检查 GitNexus 仓库上下文与索引新鲜度，再按任务加载探索或影响分析能力；如果 GitNexus 不可用，则用代码搜索、调用关系检查和测试继续。分析结果帮助定位风险，但不替代下文的 specs、测试、verification 和团队审核。

## 1. 统一生命周期中的 explore 与路径选择

完整顺序是：需求进入 → explore → 路径选择 → 规划 → 实施授权 → 实施 → 验证与团队审核 → 关闭授权 → formal close。本节只演示其中的 explore 与路径选择；完整适用和豁免边界见[主流程](../../docs/FULLSTACK_WORKFLOW.md#4-统一生命周期)。

收到新的代码、产品行为或系统行为变更需求后，AI 先采用 `/opsx:explore` 的只读姿态检查活动 changes、current specs 和必要代码。例如：

```text
/opsx:explore 报表导出服务收到以下三个改动请求，分别应采用哪条路径？
```

在这个示例中，AI 只读检查服务上下文并形成下列路径结论；是否继续同轮规划、何时等待用户以及 slash command 不可用时的行为均按主流程处理。

报表服务收到三个请求：

| 请求 | 判断 | 路径 |
|---|---|---|
| 导出超时后状态错误地停留在 `processing`，已确认规格要求变成 `failed` | 只恢复现有行为，不新增 Requirement | `bugfix` |
| 清理崩溃遗留的临时文件，增加一个有限、可观察的内部系统策略，不改变用户旅程或公共契约 | 新系统行为，但没有产品治理面 | `system-change`，metadata 使用 `spec-driven` |
| 用户可以创建每日定时报表，新增用户旅程、权限和公共 API | 产品行为与公共契约变化 | `product-change` |

若 bug 调研发现“超时后允许用户选择自动重试”才是真实需求，它已经改变产品规则，必须停止 bugfix 并改走 product-change。改动只有几行也不能降级。

## 2. 准备当前规格

假设 canonical spec 已包含：

```markdown
# report-export Specification

## Requirements

### Requirement: RPT-001 Export terminal status

The service SHALL set a timed-out export to `failed` and expose the failure reason.

#### Scenario: Export times out

- **WHEN** an export exceeds its execution deadline
- **THEN** the export status becomes `failed` and a timeout reason is observable
```

运行 index 后，AI 的最小读取顺序是：

1. `SPEC.md`；
2. `openspec/specs/report-export/spec.md`；
3. 修改相同 capability 的活动 changes；
4. 需要 Requirement 级历史时读取 `openspec/change-history.json`；
5. 只有本地详细 archive 确实存在且有必要时才读取它。

写入任何 delta Requirement 前，再做一次 stable ID 归属盘点：canonical spec、修改同 capability 的活动 changes、Requirement-level history。后续三个示例的计划摘要应分别报告：bugfix 沿用 `RPT-001`；system-change 新增 `CLEAN-001`，且三源中没有既有 `CLEAN-*`；product-change 新增 `SCHED-001`，且三源中没有既有 `SCHED-*`。ADDED 不复用其他逻辑 Requirement 的 ID，MODIFIED/普通 RENAMED 沿用 ID，纠错 RENAMED 必须解释新 ID 和历史保留。相同结论在关闭审核再次展示，但不由 strict validation 或 CI 代替团队判断。

## 3. 路径一：有界 bugfix

### 3.1 创建 change

```powershell
openspec new change fix-export-timeout-status --schema bugfix
```

`openspec/changes/fix-export-timeout-status/.openspec.yaml`：

```yaml
schema: bugfix
```

`proposal.md` 的关键内容：

```markdown
# Bug 修复提案

## 缺陷

worker 超时退出时只写 failure reason，没有把状态从 `processing` 更新为 `failed`。

## 预期行为

恢复 RPT-001：超时导出进入 `failed`，并保留 timeout reason。

## 范围

仅修改 worker timeout error mapping 和回归测试。

## 非目标

不增加重试策略，不改变 API，不新增 Requirement。

## 能力范围

- **新增**：无
- **修改**：`report-export`

## 风险与回滚

风险是错误映射影响其他终态；回滚为恢复前一 handler 并重新运行终态回归。
```

`specs/report-export/spec.md` 保持稳定 ID，并写修改后的完整 Requirement：

```markdown
## MODIFIED Requirements

### Requirement: RPT-001 Export terminal status

The service SHALL atomically set a timed-out export to `failed` and expose the timeout reason.

#### Scenario: Export times out

- **WHEN** an export exceeds its execution deadline
- **THEN** the export status atomically becomes `failed` and a timeout reason is observable
```

`tasks.md`：

```markdown
## 诊断

- [x] 1.1 用聚焦测试复现 RPT-001 回归并确认根因。

## 实施

- [ ] 2.1 原子更新 timeout 状态和 reason。
- [ ] 2.2 增加 timeout 与非-timeout 终态回归测试。

## 验证与交付

- [ ] 3.1 运行聚焦测试和服务测试。
- [ ] 3.2 编写 verification.md，记录风险、限制和回滚。
- [ ] 3.3 展示关闭摘要并等待独立关闭授权。
```

用 `openspec status --change fix-export-timeout-status` 和 `openspec validate fix-export-timeout-status --strict` 检查规划结构。

### 3.2 第一次强制停顿：等待实施授权

规划 artifacts 全部完成后，AI 应结束当前轮次，给出类似摘要：

```text
Change: fix-export-timeout-status
范围: 恢复 RPT-001 的原子终态更新；不新增重试或接口。
计划: 修正 timeout handler，增加 timeout/非-timeout 回归，记录验证与回滚。
风险: 其他终态错误映射；以终态矩阵回归覆盖。
等待后续明确实施授权。
```

用户后续发送：

```text
确认实施 fix-export-timeout-status
```

才允许修改业务代码。创建 change、生成 artifacts、`/opsx:continue`、`/opsx:ff`、原始“修复它”或普通“继续”都不是实施授权。若随后把范围改成新增自动重试，旧授权失效，必须修改规划并再次停顿。

### 3.3 实施与 change-local verification

实施后勾选真实完成的 tasks，并创建不属于 artifact graph 的 `verification.md`：

```markdown
# Verification

## Delivered scope

- RPT-001 timeout 终态改为单次原子写入 `failed + reason`。
- 未新增 API、重试策略或数据迁移。

## Test cases

| ID | Scenario | Command or steps | Expected | Actual | Result |
|---|---|---|---|---|---|
| BF-TC-001 | worker timeout | `npm test -- timeout-status` | failed + timeout reason | matched | passed |
| BF-TC-002 | validation failure | `npm test -- terminal-status` | existing failed mapping unchanged | matched | passed |
| BF-TC-003 | success | `npm test -- terminal-status` | completed unchanged | matched | passed |

## Risk applicability

| Area | Applicable | Review conclusion | Evidence |
|---|---|---|---|
| Security | no | no auth/input boundary changed | code diff review |
| Migration | no | no schema/data rewrite | scope review |
| Browser | no | backend-only | scope review |
| Rollback | yes | revert timeout handler; rerun terminal matrix | BF-TC-001..003 |

## Incomplete work and limitations

- None.

## Rollback

- Revert the handler commit and run `npm test -- terminal-status`.
```

真实日志很大时，把它保存在受控 CI artifact，verification 只写结果和安全链接。不要提交令牌、个人数据或生产日志。

### 3.4 第二次强制停顿：等待关闭授权

AI 展示 change ID、已交付范围、测试结果、未完成 tasks、四项风险、限制和 formal close 计划，然后结束当前轮次。用户后续发送：

```text
确认关闭 fix-export-timeout-status
```

才运行：

```powershell
node bin/workflow.js close fix-export-timeout-status --target .
```

命令固定执行 strict validation、OpenSpec archive、index/history 重建和 governance check；它不会解析 tasks 或 verification，也不会再次判断团队结论。

## 4. 路径二：原生 system-change

### 4.1 创建与规划

```powershell
openspec new change add-orphan-export-cleanup --schema spec-driven
```

这里没有 `system-change` 自定义 Schema 目录。`.openspec.yaml` 必须是：

```yaml
schema: spec-driven
```

原生 graph 是：

```text
proposal -> specs ┐
                   ├-> tasks -> apply
proposal -> design┘
```

代表性 proposal：

```markdown
## Why

Worker crash can leave temporary export files indefinitely.

## What Changes

- Delete orphan temporary files older than the configured retention window.
- Emit cleanup counts and failures to service metrics.

## Capabilities

### New Capabilities

- `export-cleanup`: bounded orphan-file cleanup behavior.

### Modified Capabilities

- None.

## Impact

- Cleanup scheduler and temporary storage adapter; no user API or product rule changes.
```

`specs/export-cleanup/spec.md`：

```markdown
## ADDED Requirements

### Requirement: CLEAN-001 Orphan export cleanup

The service SHALL delete an unreferenced temporary export file after the configured retention window.

#### Scenario: Orphan exceeds retention

- **WHEN** an unreferenced temporary export file is older than the retention window
- **THEN** the cleanup run deletes it and records the outcome

#### Scenario: Active export still references the file

- **WHEN** a temporary file is referenced by an active export
- **THEN** the cleanup run leaves it unchanged
```

design 说明如何判断 orphan、并发锁、指标和回滚开关；tasks 覆盖实现、并发/失败测试、verification 与关闭审核。

### 4.2 授权、验证与关闭

proposal、specs、design、tasks 完成后必须先展示 `add-orphan-export-cleanup` 摘要并等待后续：

```text
确认实施 add-orphan-export-cleanup
```

实施后验证至少覆盖过期 orphan、活动引用、重复运行幂等、存储删除失败、指标和关闭开关。system-change 不创建共享 BR/PRD/FEATURE，但仍创建 change-local verification，并单独等待：

```text
确认关闭 add-orphan-export-cleanup
```

正常关闭：

```powershell
node bin/workflow.js close add-orphan-export-cleanup --target .
```

## 5. 路径三：product-change

“每日定时报表”增加用户操作、权限、API 和共享验收，因此即使实现很小也必须走 product-change。

### 5.1 change 外先完成共享 BR/PRD

从模板创建：

```text
docs/requirements/REQ-120-scheduled-exports/
├── README.md
├── BR-120.md
├── PRD-120.md
└── FEATURE.md
```

团队应在启动 product change 前完成并确认 BR/PRD。这个顺序是团队治理，不是 Schema、脚本或 CI 门禁。

`BR-120.md` 摘要：

```markdown
## 业务结果

| 目标 ID | 可衡量结果 | 基线 / 目标值 | 衡量周期 |
|---|---|---|---|
| BG-120 | 运营人员无需人工重复导出日报 | 每日手工 1 次 / 自动生成率 >= 99% | 30 天 |

## 范围边界

- **范围内**：管理员创建、暂停和查看每日 schedule。
- **范围外**：任意 cron 表达式、跨时区自动迁移、邮件发送。
```

`PRD-120.md` 摘要：

```markdown
## 结果级验收

| 验收 ID | 期望产品结果 | 证据方式 |
|---|---|---|
| PA-120 | 有权限管理员可创建每日 schedule | API/UI acceptance |
| PA-121 | 无权限用户不能创建或修改 schedule | authorization test |
| PA-122 | 到达下一执行时间后生成一次导出且可追踪 | integration/metric |
```

### 5.2 创建完整 product planning package

```powershell
openspec new change add-daily-export-schedule --schema product-change
```

product-change graph 同时保留外层绑定和原生核心：

```text
br -> prd

proposal -> specs ┐
                   ├-> tasks -> apply
proposal -> design┘
```

`br.md` 只绑定共享来源：

```markdown
# BR 绑定

## 来源

- **需求 ID**：REQ-120
- **共享 BR**：`docs/requirements/REQ-120-scheduled-exports/BR-120.md`
- **业务目标 ID**：BG-120

## 本次变更的业务切片

- **问题与预期结果**：交付每日 schedule 的创建、暂停和执行。
- **证据状态**：已验证
```

`prd.md` 绑定 PA-120..122，proposal 描述 `export-scheduling` 新 capability 和 `report-export` 修改；design 覆盖时区存储、幂等 execution key、权限、迁移和回滚开关。

delta spec 示例：

```markdown
## ADDED Requirements

### Requirement: SCHED-001 Daily export schedule authorization

The service SHALL allow only an administrator with `export.schedule.manage` to create or modify a daily export schedule.

#### Scenario: Authorized administrator creates a schedule

- **WHEN** an authorized administrator submits one report, local execution time, and timezone
- **THEN** the service creates an enabled daily schedule and returns its next execution time

#### Scenario: User lacks schedule permission

- **WHEN** a user without `export.schedule.manage` submits a create or update request
- **THEN** the service rejects the request without changing schedule state
```

tasks 应包含数据迁移、API、scheduler、权限、幂等、前端（若适用）、测试、部署、verification、共享 FEATURE 更新和关闭审核。

### 5.3 product-change 实施授权

所有 apply-required artifacts 及依赖完成后，AI 必须结束轮次并展示：

```text
Change: add-daily-export-schedule
产品范围: REQ-120 / BG-120 / PA-120..122。
行为: 管理员每日 schedule、权限拒绝、幂等执行与可追踪结果。
技术: timezone + next_run_at，execution key 防重复，feature flag 回滚。
验证: 权限、迁移、scheduler 幂等、API/UI、指标与 rollback drill。
等待后续明确实施授权。
```

后续授权必须明确：

```text
确认实施 add-daily-export-schedule
```

### 5.4 验证、风险审核和共享 FEATURE

product verification 的测试表可以包括：

| ID | 对应项 | 场景 | 证据 | 结果 |
|---|---|---|---|---|
| PC-TC-120 | SCHED-001 / PA-120 | 管理员创建 schedule | API integration + UI screenshot | passed |
| PC-TC-121 | SCHED-001 / PA-121 | 普通用户被拒绝且无状态变化 | authorization integration | passed |
| PC-TC-122 | SCHED-002 / PA-122 | 到期只创建一个 export | scheduler concurrency test | passed |
| PC-TC-123 | migration | 旧数据库升级并回退 flag | migration rehearsal | passed |

风险矩阵：

| Area | Applicable | Review conclusion | Evidence |
|---|---|---|---|
| Security | yes | permission is deny-by-default; tenant scope verified | PC-TC-121 + security review |
| Migration | yes | additive table/index; old runtime ignores it | PC-TC-123 |
| Browser | yes | Chromium/Firefox create/pause flows passed | visual/interaction artifact refs |
| Rollback | yes | disable scheduler flag, keep schedule data, drain jobs | rollback rehearsal |

团队审核验证材料后，才把共享 `FEATURE.md` 对应结果标记 ready：

```markdown
| Change | 结果 ID | 已交付结论 | Evidence IDs | 版本 / 日期 | 状态 |
|---|---|---|---|---|---|
| add-daily-export-schedule | FR-120 | 管理员可创建和暂停每日导出，未授权用户被拒绝，到期执行具备幂等保护 | PC-TC-120..123 | 2026-08-03 | ready |
```

如果 browser 验证没做，不能把包含 UI 可用性的结论写成 ready。若某 task 确实无法实现，AI 应继续其余可行工作，并向团队说明原因、交付影响、受影响 Requirement/PA/FEATURE 声明和后续安排；程序不会替团队作这个判断。

### 5.5 独立关闭授权与正常 close

AI 展示完整 close review 后结束轮次。用户后续发送：

```text
确认关闭 add-daily-export-schedule
```

然后才运行：

```powershell
node bin/workflow.js close add-daily-export-schedule --target .
```

成功后 canonical specs 包含新行为，活动 change 被 OpenSpec 移入本地 archive，`SPEC.md` 重建，history v1 增加无路径摘要：

```json
{
  "version": 1,
  "changes": [
    {
      "changeId": "add-daily-export-schedule",
      "archiveDate": "2026-08-03",
      "schema": "product-change",
      "capabilities": [
        {
          "name": "export-scheduling",
          "requirements": [
            {
              "operation": "ADDED",
              "id": "SCHED-001",
              "name": "Daily export schedule authorization"
            }
          ]
        }
      ]
    }
  ]
}
```

history 不包含 proposal/design/tasks/verification/FEATURE/delta 路径，也不包含活动 change。

## 6. 两个恢复流程

### 6.1 delta 已提前 sync

正常流程不要在 close 前单独 sync，archive 会应用 delta。只有团队已经执行过 `/opsx:sync <change>`，并确认 canonical spec 已包含该 delta 时，使用恢复参数避免重复应用：

```powershell
node bin/workflow.js close <change> --skip-specs --target .
```

`--skip-specs` 不是简化路径，也不替代 close review 或关闭授权。若无法确认是否已 sync，先比较 canonical spec 与 delta，不要猜测。

### 6.2 archive 成功，index/check 失败

close 会指出 change 已经归档。修复 history seed、文件权限或生成文件问题后，只运行 finalization：

```powershell
node bin/workflow.js index --target .
node bin/workflow.js check --target .
```

不要再次运行 archive。若 `openspec/change-history.json` 不是严格 pathless v1、含有 legacy 字段或 JSON 无效，先从可信 Git/备份恢复受支持的 v1；index 与 `--force` 安装都不会静默转换或覆盖它。

## 7. 安装器升级

使用最新 GitHub checkout 重新构建并安装：

```powershell
$repoUrl = "https://github.com/haoranliu66/openspec_workflow.git"
$targetProject = "D:\projects\report-export-service"
$upgrade = Join-Path ([System.IO.Path]::GetTempPath()) ("openspec-workflow-upgrade-" + [guid]::NewGuid())

git clone --depth 1 $repoUrl $upgrade
Push-Location $upgrade
npm ci
npm run build
node dist/bin/workflow.js install --target $targetProject
Pop-Location
```

若受管文件与目标定制冲突，安装会在写入前整体停止。团队审阅后可选择：

```powershell
node dist/bin/workflow.js install --target $targetProject --force
```

`--force` 先备份冲突的受管文件。受管的 AI 治理指南与根合并样例会升级，但项目自己的根/嵌套 `AGENTS.md` 保持不变。旧版本 manifest 明确拥有且位于退役清单的 closeout 脚本/模板会先备份再删除；未受管同名文件和所有项目 change/archive/REQ/verification/evidence 都不属于退役目标。

## 8. Git 保留边界

需要区分两个仓库角色：

| 仓库 | 默认策略 |
|---|---|
| 本工作流上游源仓库 | 根 `.gitignore` 在正常 Git 操作中排除自身的活动/归档 change 详情、编号 REQ、artifacts 及工具/规划输出；团队提交前复核 staged/tracked 路径；保留 canonical specs、模板、示例、CHANGELOG 和 history v1 |
| 安装后的业务项目 | 工作流不设置 `.gitignore`；团队自行决定是否跟踪完整 change、archive、REQ 和安全 evidence |

上游的排除策略不增加 CI、脚本或 hook 来阻止有权限的维护者故意使用 `git add -f`；维护者不得主动绕过根规则。它也不重写既有 Git commits。因此普通最新 checkout 没有完整开发过程文档，但显式查看旧提交仍可能恢复它们。若要从所有 Git 对象中永久清除，需要单独评估 filter-repo 和 force-push；这不属于工作流安装或 close。

## 9. 提交前检查

业务目标项目至少运行：

```powershell
node scripts/validate-schemas.js
node scripts/validate-changes.js
node scripts/openspec-governance.js check
```

这些命令验证 Schema、所有活动 change 的 OpenSpec strict 结构和生成文件一致性。它们不证明 tasks 完成、测试真实充分、风险 N/A 合理、Requirement/PRD/FEATURE 语义正确或用户已经授权关闭；这些结论必须来自团队审核。
