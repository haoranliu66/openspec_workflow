# 维护手册

## 运行环境

- Node.js `>=20.19.0`
- 固定 OpenSpec `1.8.0`，来源 commit `d57889664cab4f2f061d236ec3ff82a5578701bb`
- 源码仓库执行 `npm ci`、`npm run build` 和 `npm run verify`
- 安装目标使用 `node bin/openspec.js` 调用受管运行时，只运行 emitted JavaScript，不依赖 TypeScript 或全局 OpenSpec

维护和排障时先按行为与治理面识别 bugfix、system-change 或 product-change，不用代码量替代路径判断。

## 更新导航与 compact history

源码仓库：

```bash
npm run index
```

安装目标：

```bash
node scripts/openspec-governance.js index
```

不得手工编辑 `SPEC.md` 或 `openspec/change-history.json`。索引器只接受严格的 pathless v1 seed，与本地 archive 按日期、change ID、Schema 合并；本地 archive 缺失时已有摘要不会消失。

## 治理检查

```bash
npm run check
```

安装目标：

```bash
node scripts/openspec-governance.js check
```

治理检查覆盖必要目录、生成文件漂移和活动 Schema 支持；它不以 Git diff 强制证明归档不可变，也不判断验证是否充分或团队是否批准关闭。

## 活动 change 严格校验

```bash
npm run validate:changes
```

安装目标：

```bash
node scripts/validate-changes.js
```

命令从文件系统枚举全部活动 changes，并逐项通过项目内运行时执行 `node bin/openspec.js validate <change> --strict`。单项失败不会阻止继续枚举，其结果最终汇总。

## Schema 校验与 system-change

`node scripts/validate-schemas.js` 校验项目自定义 bugfix/product-change，以及 OpenSpec `1.8.0` 内置 spec-driven。
## 更新 OpenSpec 核心 skills

`vendor/openspec` 是官方仓库 submodule；更新时必须同时固定新的 gitlink commit 和相同版本的 `@fission-ai/openspec` npm 依赖，不能让源码基准与运行时漂移。随后用新版 CLI 重新生成 `.agents/skills` 的 core profile，再运行 `npm run skills:adapt`。该命令只把官方 core skills 的 CLI 调用改为 `node bin/openspec.js`，并用本项目关闭授权/formal-close wrapper 覆盖 `openspec-archive-change`。最后运行完整 `npm run verify`，并检查 system-change 的 `spec-driven` 与 product-change Schema 都能完成 propose、status、instructions 和 apply 指令解析。

## 团队关闭审核

实施与验证后，在活动 change 内准备 `verification.md`，必要时增加 `evidence/`。审核至少覆盖：实际交付范围、测试用例与结果、四项风险适用性、未完成 tasks、限制、产品声明和回滚。

AI 代为关闭前展示准确 change ID 和上述摘要，并结束当前轮次。只有后续明确的 `确认关闭 <change>` 或等价指令才授权关闭；原实施授权不构成关闭授权。

## 正式关闭

源码仓库：

```bash
node dist/bin/workflow.js close <change> --target .
```

安装目标：

```bash
node bin/workflow.js close <change> --target .
```

命令只执行 strict validation、OpenSpec archive、index/history 重建和治理检查。它不读取 tasks、verification、evidence、BR/PRD/FEATURE 或历史 closeout。

正常路径不提前 sync。若团队已经提前执行 `/opsx:sync` 并确认 canonical specs 已包含 delta，恢复时使用：

```bash
node bin/workflow.js close <change> --skip-specs --target .
```

archive 成功但 index/check 失败时，不要重复 archive；修复原因后分别运行 `workflow index` 和 `workflow check`。

## 升级已接入项目

安装器先做冲突预检。`--force` 会备份冲突的受管文件后覆盖。升级时还会读取旧 `.ai-workflow.json`：只有 manifest 拥有且位于明确退役清单中的 closeout 脚本、库和模板才会先备份后删除。

`docs/AI_WORKFLOW_AGENTS.md` 与根 `AGENTS.ai-workflow.example.md` 是可升级的受管文件。目标根 `AGENTS.md` 不属于 manifest：缺失时安装器只创建一次项目自有种子，存在时始终原样保留，即使使用 `--force`；所有嵌套 `AGENTS.md` 也不在安装器枚举范围内。根据安装提示人工审阅并合并最新治理样例。

退役绝不匹配 `openspec/changes/**`、archive、`verification.md`、`evidence/` 或 `artifacts/**`。旧 manifest 不拥有的同名文件原样保留。无有效 manifest 时不会推断所有权。

## 版本策略

- patch：兼容修复和文案更正；
- minor：兼容的新能力；
- major：删除命令、格式或其他公开工作流契约。

当前 `v0.0.1` 是本项目的首次公开发行。后续发行按兼容性影响选择 patch、minor 或 major。
