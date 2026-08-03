# 维护手册

## 运行环境

- Node.js `>=20.19.0`
- OpenSpec `1.5.0`
- 源码仓库执行 `npm ci`、`npm run build` 和 `npm run verify`
- 安装目标只运行 emitted JavaScript，不依赖 TypeScript

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

不得手工编辑 `SPEC.md` 或 `openspec/change-history.json`。索引器接受 v1/v2 history 种子，只把 archived change 规范化为 v2 无路径摘要，并与本地 archive 按日期、change ID、Schema 合并。本地 archive 缺失时已有摘要不会消失；无效 JSON 或未知版本会中止，避免历史被覆盖。

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

命令从文件系统枚举全部活动 changes，并逐项执行 `openspec validate <change> --strict`。单项失败不会阻止继续枚举，其结果最终汇总。

## Schema 校验与 system-change

`node scripts/validate-schemas.js` 校验项目自定义 bugfix/product-change，以及 OpenSpec `1.5.0` 内置 spec-driven。仓库和安装目标不得复制 `openspec/schemas/spec-driven/`。

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

对本工作流源仓库，close 生成的详细 archive 保留在本地且受上游 `.gitignore` 排除，只有 v2 摘要和同步后的 canonical spec 进入公开快照。下游安装目标不继承这条 Git 规则。

## 升级已接入项目

安装器先做冲突预检。`--force` 会备份冲突的受管文件后覆盖。3.0 升级还会读取旧 `.ai-workflow.json`：只有 manifest 拥有且位于明确退役清单中的 closeout 脚本、库和模板才会先备份后删除。

退役绝不匹配 `openspec/changes/**`、archive、`verification.md`、`evidence/` 或 `artifacts/**`。旧 manifest 不拥有的同名文件原样保留。无有效 manifest 时不会推断所有权。

安装器不会复制本仓库根 `.gitignore`，也不会删除或忽略目标项目的编号 REQ、活动/归档 changes 或验证材料。升级目标已有 v1 history 时会生成 pathless v2；已有有效 v2 在详细 archive 缺失时仍保留。无效 history 必须先由团队从可信备份恢复，即使 `--force` 也不会静默覆盖。

## 历史修正策略

已归档 change 按团队流程不可变。发现历史错误时创建新的 delta change 修正当前规格，并在新记录中向后追踪；不要修改旧本地 archive 或 history 摘要来伪造演变。公开上游 checkout 只提供 `CHANGELOG.md` 和 history v2，旧详细记录可能仍能从未重写的 Git 旧提交恢复。

## 版本策略

- patch：兼容修复和文案更正；
- minor：兼容的新能力；
- major：删除命令、格式或其他公开工作流契约。

3.0.0 删除 `validate:close` 和 `closeout.json` 合同，因此是主版本变更。
