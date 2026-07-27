# 维护手册

## 运行环境

维护版本 `2.1.0` 需要 Node.js `>=20.19.0` 与 OpenSpec `1.5.0`：

```powershell
npm ci
npm run build
npm run verify
```

`bin/`、`lib/`、`scripts/` 与 `tests/` 保存 TypeScript 源码，`dist/` 仅为不跟踪的编译结果。安装目标接收 JavaScript，可用普通 Node.js 运行。

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

## 关闭 change

正常关闭不要先 sync，让 OpenSpec archive 应用 delta：

```powershell
openspec archive <change> --yes --json
node scripts/openspec-governance.js index
node scripts/openspec-governance.js check
```

如果已经执行 `/opsx:sync`，必须避免二次应用同一 delta：

```powershell
openspec archive <change> --skip-specs --yes --json
node scripts/openspec-governance.js index
node scripts/openspec-governance.js check
```

`feature` artifact ready 只表示前置 artifact 已具备、可以开始编写 FEATURE；FEATURE 中只有具备实现与验证证据的内容才能声明可交付。即便已经形成这样的交付声明，也需完成归档、历史重建和检查后 change 才关闭。

## 升级已接入项目

1. 在本仓库更新 schema、模板或工具，增加相应测试并提升版本。
2. 运行 `npm ci`、`npm run build` 与 `npm run verify` 并提交。
3. 在目标项目执行不带 `--force` 的安装，查看冲突。
4. 审核本地定制后再决定是否 `--force`；保留并检查自动备份。
5. 合并 config 示例，验证两个 schemas、两份生成文件、严格校验项目全部活动 changes，并确认项目已有 CI 调用 `node scripts/validate-changes.js`。
6. 不移动或改写已有 archive；继续旧的活动 product change 前，将 proposal/design/tasks 与 delta headings 迁移到原生结构。

## 历史修正策略

历史记录存在错误时，创建新的 correction change，在 delta spec 中引用相关历史与当前规格，明确修正后的完整行为。

## 版本策略

- Patch：文案澄清、兼容性修复，不改变产物图。
- Minor：新增模板字段、校验或向后兼容能力。
- Major：schema 产物顺序、目录契约或安装语义不兼容变化。
