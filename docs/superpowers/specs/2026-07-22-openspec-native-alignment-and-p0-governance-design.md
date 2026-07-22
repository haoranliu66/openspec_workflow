# OpenSpec 原生对齐与 P0 治理优化设计

## 1. 背景

当前仓库在 OpenSpec v1.5.0 之上增加了 `bugfix` 与 `product-change` 两套自定义 Schema，并用共享 BR、PRD、FEATURE、根 `SPEC.md` 和归档不可变约束补充产品与 AI 治理。

现有方向是合理的，但实现中存在两类偏差：

1. `product-change` 重写了 OpenSpec 原生 proposal、design、tasks 的职责与依赖关系，把原生可迭代的 artifact graph 变成了线性阶段。
2. 归档不可变、活动 change 严格校验和历史导航没有形成 CI 可强制的完整闭环。

本设计以 OpenSpec v1.5.0 为固定兼容基线。上游原生依据包括：

- `schemas/spec-driven/schema.yaml`
- `docs/concepts.md`
- `docs/customization.md`
- `src/core/archive.ts`
- OpenSpec CLI 1.5.0 的 JSON 命令契约

OpenSpec v1.5.0 的运行时要求是 Node.js `>=20.19.0`。本工作流的文档、package engine 和 CI 必须与该要求一致。

## 2. 目标

### 2.1 核心目标

- 保留 `bugfix`、`product-change` 两套 Schema 以及 BR、PRD、FEATURE 外层产品治理。
- 让 `product-change` 的 proposal、specs、design、tasks、apply 与 OpenSpec v1.5.0 原生 `spec-driven` 子图兼容。
- 让 AI 在开始任务时准确发现活动 change、受影响 capability 和当前规格。
- 让 AI 在需要回归、冲突分析或设计追溯时，能够机械定位历史 change 实际新增、修改、删除或重命名过的 Requirement。
- 让 CI 真正阻止历史归档篡改，并严格校验所有活动 change 的 delta specs。
- 将工作流仓库的可执行源码与测试统一为 TypeScript，同时保持安装目标的运行时零 TypeScript 依赖。

### 2.2 非目标

- 不修改已经提交的 archive 内容来补充新字段或正向链接。
- 不替代 OpenSpec 的 delta merge、validate、status、instructions 或 archive 实现。
- 不从 proposal 自由文本生成带主观判断的 AI 摘要。
- 不自动批准业务范围、技术方案、发布风险或合规结论。
- 不在本轮实现 manifest 三方合并、完整升级迁移器或发布平台集成。
- 不要求采用本工作流的业务项目安装 TypeScript、`tsx` 或其他 JavaScript 运行时依赖。

## 3. 设计原则

1. **原生核心不改写**：产品治理通过外层 artifacts、project rules 和治理脚本扩展，不改变 OpenSpec 核心 artifact 的语义。
2. **依赖是能力解锁，不是瀑布阶段**：design 与 specs 在 proposal 后并行可用，artifact 可以在实现过程中反复修订。
3. **当前事实与历史事实分离**：`openspec/specs/` 仍是当前行为事实来源；archive 与生成式历史索引负责演进追溯。
4. **机器事实优先**：change 影响范围从目录、delta section 和 Requirement 标题机械提取，不依赖人工维护完整历史链。
5. **失败关闭**：无法解析 Git 基线、OpenSpec 校验失败或索引漂移时，CI 不得静默通过。
6. **最小默认上下文**：`SPEC.md` 保持精简，详细历史放入独立的结构化索引，AI 仅在需要时读取。

## 4. Product Change Artifact 架构

### 4.1 Artifact Graph

`product-change` 保留七个 artifact，但原生核心形成独立子图：

```text
br ──→ prd

proposal
├──→ specs ──┐
└──→ design ─┴──→ tasks ──→ apply
                         └──→ feature
```

精确依赖为：

| Artifact | requires | 定位 |
|---|---|---|
| `br` | `[]` | 共享 BR 的 change 级轻量绑定 |
| `prd` | `[br]` | 共享 PRD 的交付切片绑定 |
| `proposal` | `[]` | OpenSpec 原生 proposal root |
| `specs` | `[proposal]` | OpenSpec 原生 delta specs |
| `design` | `[proposal]` | OpenSpec 原生技术设计，可与 specs 并行 |
| `tasks` | `[specs, design]` | OpenSpec 原生实施清单 |
| `feature` | `[tasks]` | 外层交付记录的生成就绪条件 |
| `apply` | `[tasks]` | OpenSpec 原生实施入口，跟踪 `tasks.md` |

BR/PRD 的业务顺序由工作流说明与外层治理约束，不通过修改 proposal 的原生 `requires` 实现。这样既保留产品治理，也不破坏 OpenSpec 的 schema-aware instructions、status 与 apply 语义。

### 4.2 原生核心不变量

以下内容以 OpenSpec v1.5.0 内置 `spec-driven` 为基线：

- proposal 必须包含 `Why`、`What Changes`、`Capabilities`、`Impact`。
- proposal 中 New/Modified Capabilities 是生成 delta specs 的契约。
- design 使用 `Context`、`Goals / Non-Goals`、`Decisions`、`Risks / Trade-offs`，并在适用时覆盖 Migration Plan 与 Open Questions。
- tasks 必须使用 `- [ ] X.Y ...`，以便 apply 正确跟踪进度。
- design 只依赖 proposal，不依赖 specs。
- tasks 同时依赖 specs 与 design。
- apply 只依赖 tasks，并跟踪 `tasks.md`。

产品来源、Requirement ID、质量门禁和交付证据等项目特有要求，优先通过 `openspec/config.yaml` 的 rules、BR/PRD/FEATURE 外层文档和治理检查增加；不得删除或改名原生核心章节。

### 4.3 FEATURE 的状态语义

OpenSpec v1.5.0 Schema DSL 没有可供 artifact 依赖的“apply 已完成”节点。因此 `feature.requires: [tasks]` 只能表示 tasks 文件存在后可以创建 feature，不能证明代码已经实现或验证。

本工作流明确区分：

- **ready**：OpenSpec artifact graph 允许创建 `feature.md`。
- **final**：tasks 已完成，适用验证通过，证据已记录，共享 FEATURE 已更新。

归档前的外层治理负责检查 final 条件。文档不得再把 artifact ready 描述成真实交付完成。

## 5. AI 导航与历史数据模型

### 5.1 根 SPEC.md

`SPEC.md` 继续作为最小上下文入口，并增加独立的活动 change 表。活动 change 即使尚未生成 delta spec，也必须出现在表中。

活动 change 表至少包含：

- change ID；
- Schema；
- proposal 链接；
- 已发现的 capabilities；
- 已存在 artifact 的文件链接；
- 结构化历史索引路径。

Capability 表继续包含 canonical spec、首次归档、最新归档和活动 changes，但详细历史不直接展开，避免默认上下文随归档数量线性增长。

### 5.2 openspec/change-history.json

新增确定性生成文件 `openspec/change-history.json`，作为 AI 和 CI 使用的结构化历史导航。顶层格式版本固定为 `1`，不包含生成时间戳。

每个 change 记录：

```json
{
  "changeId": "add-example",
  "state": "active",
  "archiveDate": null,
  "schema": "product-change",
  "paths": {
    "proposal": "openspec/changes/add-example/proposal.md",
    "design": "openspec/changes/add-example/design.md",
    "tasks": "openspec/changes/add-example/tasks.md",
    "feature": "openspec/changes/add-example/feature.md"
  },
  "capabilities": [
    {
      "name": "example-capability",
      "canonicalSpec": "openspec/specs/example-capability/spec.md",
      "deltaSpec": "openspec/changes/add-example/specs/example-capability/spec.md",
      "requirements": [
        {
          "operation": "ADDED",
          "id": "CAP-001",
          "name": "Example behavior"
        }
      ]
    }
  ]
}
```

`paths` 中不存在的 artifact 使用 `null`，不得生成指向不存在文件的链接。

提取规则：

- change 来源于活动目录和 archive 顶层目录。
- Schema 优先读取 change 的 `.openspec.yaml`；缺失时标记为 `unknown`，不根据文件组合猜测。
- capability 来源于 `specs/<capability>/spec.md`。
- ADDED、MODIFIED、REMOVED 来源于对应二级标题下的 `### Requirement:`。
- RENAMED 同时支持 OpenSpec 原生 `FROM:` / `TO:` 对和 Requirement 标题形式。
- Requirement ID 仅在标题首 token 符合稳定 ID 格式时提取；否则为 `null`，完整名称仍保留。
- archiveDate 只从 OpenSpec 的 `YYYY-MM-DD-<change>` 目录前缀提取。

手工填写的 Previous changes 只表达因果或设计依赖，不再承担完整历史目录职责。

### 5.3 确定性与漂移检查

`index` 同时生成 `SPEC.md` 与 `openspec/change-history.json`。`check` 在内存中重新渲染两者并逐字节比较；任一文件缺失或过期都失败。

排序规则固定为：

- capability、活动 change、Requirement 使用英文 locale 的字典序；
- archive 首先按 `YYYY-MM-DD`，同日按完整 archive 目录名排序；
- JSON 使用两空格缩进并以单个 LF 结尾。

## 6. P0：归档不可变

### 6.1 检查范围

归档不可变由两层检查共同完成：

1. **提交区间**：比较 CI 基线提交与 `HEAD`，发现已提交的 archive 变化。
2. **当前工作区**：比较 `HEAD` 与 index/working tree，并包含未跟踪文件。

治理 CLI 新增显式参数：

```text
npm run check -- --archive-base <git-ref> # 工作流源码仓库
node scripts/openspec-governance.js check --archive-base <git-ref> # 已安装的目标项目
ai-fullstack-workflow check --target <project> --archive-base <git-ref> # package CLI
```

未传基线时仍执行本地工作区检查；CI 必须传入基线。传入的 ref 不存在、Git 不可用或无法读取基线树时失败关闭。

### 6.2 允许与拒绝规则

对于基线提交中已经存在的 `openspec/changes/archive/<archive>/`：

- 新增文件：拒绝；
- 修改文件：拒绝；
- 删除文件：拒绝；
- 重命名或移动：拒绝；
- 未跟踪文件：拒绝。

只有当顶层 archive 目录在基线中完全不存在时，才允许该新目录下出现新增文件。不能通过向旧归档添加新文件绕过不可变约束。

### 6.3 GitHub Actions 基线

- `actions/checkout` 使用 `fetch-depth: 0`。
- pull request 使用 `github.event.pull_request.base.sha`。
- push 使用 `github.event.before`。当该值为全零 SHA 时，优先使用 `HEAD` 与远端默认分支的 merge-base；仓库根提交没有可用父提交或默认分支时使用 Git empty tree 作为显式基线。
- CI 仍运行本地工作区检查，以发现生成文件漂移和未提交污染。

## 7. P0：OpenSpec 严格校验与原生漂移守卫

### 7.1 活动 change 校验

CI 与 `npm run verify` 增加：

```text
openspec --no-color validate --changes --strict --json --no-interactive
```

该命令校验所有活动 change 的 delta specs。它不负责验证 proposal、design、tasks、BR、PRD 或 FEATURE 的业务内容，因此不能替代自定义治理检查。

跨平台调用继续使用 `execFileSync` 参数数组。Windows 调用 `openspec.cmd`，Unix 调用 `openspec`；Schema 名和其他枚举参数继续白名单校验。

### 7.2 原生核心漂移守卫

测试和治理检查至少验证：

- product-change 的 proposal/specs/design/tasks/apply 依赖图与 v1.5.0 一致；
- `apply.requires` 中每个 ID 都真实存在；
- proposal 模板保留原生四个核心标题；
- design 模板保留原生核心章节；
- tasks 模板和 instruction 保留可跟踪 checkbox 格式；
- project schema 的解析来源确实是仓库内 `openspec/schemas/product-change`。

Schema 结构校验与真实 change fixture 必须同时存在。fixture 通过 OpenSpec CLI 验证以下状态转换：

1. proposal 完成后，specs 与 design 同时 ready；
2. specs 或 design 单独完成时，tasks 仍 blocked；
3. 两者完成后，tasks ready；
4. tasks 存在后，apply ready；
5. 有效 delta change 能通过 strict validate。

## 8. Archive 与 Sync 规范

OpenSpec v1.5.0 的 `openspec archive` 默认先应用 delta 到 canonical specs，再移动 change。标准收尾只使用以下两条互斥路径之一。

### 路径 A：由 archive 同步并归档

```text
openspec archive <change> --yes --json
```

### 路径 B：已经执行 /opsx:sync

确认 canonical specs 已包含 delta 后执行：

```text
openspec archive <change> --skip-specs --yes --json
```

禁止先 sync 后再执行不带 `--skip-specs` 的 archive；当 canonical spec 已包含相同 ADDED Requirement 时，重复应用会失败。

文档同时说明 v1.5.0 archive 使用 UTC 日期生成目录名；这不是业务发布日期。

## 9. 安装、版本与兼容性

### 9.1 安装产物

安装器新增受管文件：

- OpenSpec 严格校验脚本；
- 原生核心对齐检查所需脚本；
- 空状态的 `openspec/change-history.json`；
- 更新后的核心说明与 CI 示例。

安装仍遵守冲突预检、幂等、`--force` 前备份和已有 config 人工合并规则。

### 9.2 版本

本次变更会改变 product-change artifact graph、模板契约、Node 基线和治理输出，属于不兼容升级。工作流版本提升为 `2.0.0`，Schema version 提升为 `2`。

### 9.3 既有项目迁移

- archive 永不重写。
- 既有活动 product-change 保留原目录，但 proposal/design/tasks 需要按新原生章节迁移后再通过新门禁。
- 安装器默认报告冲突，不自动覆盖本地定制。
- `--force` 覆盖前必须保留 `.ai-workflow-backup/<timestamp>/`。
- 更新后重新执行 Schema 校验、活动 change 严格校验、index 和 check。

### 9.4 TypeScript 源码与运行产物

工作流仓库采用“TypeScript 单一源码、JavaScript 编译产物分发”的边界：

- `bin/`、`lib/`、`scripts/`、`tests/` 中现有与新增的可执行源码全部使用 `.ts`，不保留并行维护的 `.js` 源文件。
- `tsconfig.json` 开启 `strict`，目标为 ES2022，使用 CommonJS 模块，按原目录结构编译到 `dist/`，以兼容 Node.js `>=20.19.0` 和现有相对导入。
- `dist/` 是未提交的派生产物；`npm run build` 是唯一编译入口，`prepare`/`prepack` 保证 CLI 打包或本地安装前已有新鲜产物。
- 源仓库通过 npm scripts 执行 build、test、index、check 与 validate；package bin 指向 `dist/bin/workflow.js`。
- 安装器把 `dist/lib/*.js` 与 `dist/scripts/*.js` 映射为目标项目的 `lib/*.js` 与 `scripts/*.js`，目标项目继续直接使用 Node.js，不依赖 TypeScript 工具链。
- `typescript` 与 Node 类型声明只属于开发依赖；生产运行时不得新增第三方依赖。

## 10. 错误处理

- Git 不存在、HEAD 不存在或显式基线不可解析：治理检查失败并给出可执行修复提示。
- 活动 change 缺少 `.openspec.yaml` 或 schema 无法识别：历史索引写 `unknown`，治理检查失败。历史 archive 缺失元数据时保留 `unknown` 并报告非阻断警告，以兼容既有只读归档。
- delta spec 无法解析：index 不伪造 Requirement，治理检查失败并指出文件。
- OpenSpec JSON 命令退出非零：保留 stderr，CI 失败；不得把实验性提示与 stdout 合并后再解析 JSON。
- 生成文件写入采用同目录临时文件加原子替换，避免中断留下截断的 `SPEC.md` 或历史 JSON。
- TypeScript 类型检查或编译失败：build、测试和 CI 立即失败，不使用旧 `dist/` 继续执行。
- 安装器在第一次写入目标项目前验证全部编译产物；缺失时失败并提示先执行 `npm run build`，不得产生部分安装。

## 11. 测试策略

### 11.1 单元测试

- 原生核心 graph 与模板漂移。
- active change 在没有 delta spec 时仍进入 `SPEC.md`。
- delta operation 与 Requirement ID/名称提取。
- RENAMED FROM/TO 提取。
- 历史 JSON 和 SPEC 确定性。
- 旧归档中的 A/M/D/R/未跟踪文件全部拒绝。
- 新顶层 archive 目录允许新增。
- 无效或缺失 Git 基线失败关闭。
- Windows/Unix OpenSpec 调用参数。
- TypeScript 编译配置、严格类型边界和编译产物到安装路径的映射。
- 所有新增生产函数遵循测试先行，测试源码同样使用 TypeScript。

### 11.2 集成测试

- 在临时 Git 仓库创建旧归档并提交；后续提交修改旧归档时，使用 base ref 的 check 必须失败。
- 新归档目录相对 base 仅包含新增文件时必须通过。
- 使用真实 OpenSpec 1.5.0 创建 product-change fixture，验证 artifact readiness 与 strict validation。
- 安装到临时目标后执行 index、history、check 和 strict validation。
- 从 TypeScript 源码构建 CLI 后安装到临时目标，确认目标仅靠 Node.js 即可执行编译后的治理脚本。

### 11.3 CI 矩阵

- Node.js `20.19.x`；
- Node.js `22.x`；
- 固定 OpenSpec `1.5.0`。
- 在测试和治理命令前执行 `npm run build`，类型错误与编译错误失败关闭；
- `dist/` 不进入 Git diff，安装器测试验证其目标侧 JavaScript 产物。

## 12. 验收标准

全部满足后方可完成：

1. product-change 原生核心 graph 与 v1.5.0 一致。
2. proposal、design、tasks 保留原生章节和跟踪语义。
3. 所有活动 delta changes 严格校验进入 CI。
4. PR 或 push 中修改旧 archive 的任意路径都会失败。
5. 仅新增完整 archive 顶层目录可以通过。
6. `SPEC.md` 能发现尚无 delta spec 的活动 change。
7. `openspec/change-history.json` 能准确列出 change、capability、operation 和 Requirement。
8. index/check 连续运行字节一致。
9. Node、OpenSpec 版本、archive/sync 文档与实际行为一致。
10. 单元、集成、Schema、strict validation、Git diff 检查全部通过。
11. 仓库可执行源码与测试全部为 TypeScript，CLI 和安装目标使用编译后的 JavaScript 且无 TypeScript 运行时依赖。
