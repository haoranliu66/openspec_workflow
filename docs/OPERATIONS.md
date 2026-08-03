# 维护手册

## 运行环境

维护版本 `2.1.0` 需要 Node.js `>=20.19.0` 与 OpenSpec `1.5.0`：

```powershell
npm ci
npm run build
npm run verify
```

`bin/`、`lib/`、`scripts/` 与 `tests/` 保存 TypeScript 源码，`dist/` 仅为不跟踪的编译结果。安装目标接收 JavaScript，可用普通 Node.js 运行。

维护和排障时按行为与治理面识别路径：`bugfix` 只恢复已确认行为；`system-change` 是 `schema: spec-driven` 的治理名称，只用于有限非产品系统行为；任何产品目标、用户旅程、角色权限、业务规则、公共契约或共享验收变化均为 `product-change`，不因实现规模小而降级。

## 更新导航与机器历史

```powershell
node scripts/openspec-governance.js index
```

该命令用同一份 change snapshot 确定性生成根 `SPEC.md` 与 `openspec/change-history.json`。前者只提供最小导航，后者保存 change、artifact、capability 与 Requirement 级历史；活动 change 即使还没有 specs 也会出现。输出不含时间戳，连续执行结果必须完全一致。

## 治理检查

```powershell
node scripts/openspec-governance.js check
```

当前 `check` 仅检查必要目录、两份生成文件是否过期、历史解析诊断，以及工作区相对当前 HEAD 的 archive 修改/删除。它不检查跨分支历史、base ref 或 hash，不能证明归档不可变。已归档 change 的内容按团队流程不得修改；该规则依靠团队评审与协作执行，不由 Schema、脚本或 CI 强制。

## 活动 change 严格校验

```powershell
node scripts/validate-changes.js
```

该命令读取 `openspec/changes/` 的一级目录，排除 `archive`、隐藏目录和非目录项，按英文名称排序，并逐项执行 `openspec validate <change> --strict`。单项失败不会阻止后续诊断，全部处理后统一失败。它只验证活动 change，不执行归档不可变性证明。

## Schema 校验与 system-change

`node scripts/validate-schemas.js` 校验项目自定义的 `bugfix`、`product-change`，以及 OpenSpec `1.5.0` 内置的 `spec-driven`。`system-change` 是治理名称，实际 metadata 使用 `schema: spec-driven`；源仓库和安装目标都不得存在复制的 `openspec/schemas/spec-driven/`。如果内置 Schema 校验失败，先检查实际调用的 OpenSpec 版本和 PATH，不要创建本地副本绕过版本问题。

## 关闭 change

正常关闭不要先 sync，让唯一必需的正式 close wrapper 校验并应用 delta：

```powershell
node dist/bin/workflow.js close <change> --target .
```

如果已经执行 `/opsx:sync`，必须避免二次应用同一 delta：

```powershell
node dist/bin/workflow.js close <change> --skip-specs --target .
```

安装目标使用 `node bin/workflow.js close <change> --target .`。只在已执行 `/opsx:sync` 时向 `close` 传入 `--skip-specs`。`npm run validate:close -- <change>`（安装目标为 `node scripts/validate-close.js <change>`）只是可选的非变更性单 change 预检。如果 archive 已成功而索引或治理检查失败，wrapper 会报告已归档状态；修复后单独运行 `workflow index` 和 `workflow check` 完成恢复。

未完成的真实 task checkbox 会在校验和归档前输出 `TASKS_INCOMPLETE` 警告，但不改变成功退出码，也不阻止归档。缺失、不可读或没有真实 checkbox 的 `tasks.md` 仍以 `TASKS_INVALID` 阻止关闭；其他 evidence、gate、Requirement 与 strict validation 错误也继续阻止关闭。product-change 额外要求 PRD/共享 FEATURE trace；bugfix 与 spec-driven 不要求产品 trace，但都要求稳定 delta Requirement ID。关闭校验只校验结构、引用与声明的 evidence artifact；`closeout.json.command` 可选且不会执行，`artifact` 必填。

AI 应继续完成可实现的 task。对于判断为无法实现、取消或延期的 task，必须先向用户说明原因、交付及 Requirement/FEATURE 影响和后续安排，修正不再真实的交付声明，并在运行 `workflow close` 前取得明确确认。该确认由团队流程治理，不由程序或 CI 强制证明。

共享 FEATURE 每行记录一个具备 passed closeout evidence 的可交付结论；`ready` 行仍需经过 formal close、历史重建和检查后，change 才关闭。

实施授权是独立的团队治理：apply-required artifacts 及依赖闭包生成完成或实质修改后，AI 必须结束当前轮次，展示 change ID 与计划摘要，并等待后续 `/opsx:apply <change>`、`确认实施 <change>` 或单一 change 提示下的无歧义确认。原始请求、artifact 生成、`/opsx:continue`、`/opsx:ff` 和普通“继续”不授权；授权仅适用于该 change，规划实质修改后失效。程序和 CI 不保存或证明该授权。

## 升级已接入项目

1. 在本仓库更新 schema、模板或工具，增加相应测试并提升版本。
2. 运行 `npm ci`、`npm run build` 与 `npm run verify` 并提交。
3. 在目标项目执行不带 `--force` 的安装，查看冲突。
4. 审核本地定制后再决定是否 `--force`；保留并检查自动备份。
5. 合并 config 示例，验证两个项目 Schema、内置 `spec-driven`、两份生成文件，严格校验项目全部活动 changes，并确认项目已有 CI 调用 `node scripts/validate-changes.js`。
6. 不移动或改写已有 archive；继续旧的活动 product change 前，将 proposal/design/tasks 与 delta headings 迁移到原生结构。

## 历史修正策略

历史记录存在错误时，创建新的 correction change，在 delta spec 中引用相关历史与当前规格，明确修正后的完整行为。

## 版本策略

- Patch：文案澄清、兼容性修复，不改变产物图。
- Minor：新增模板字段、校验或向后兼容能力。
- Major：schema 产物顺序、目录契约或安装语义不兼容变化。
