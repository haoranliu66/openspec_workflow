# 维护手册

## 更新导航

```powershell
node scripts/openspec-governance.js index
```

该命令扫描当前规格、活动 changes 和归档 delta，确定性生成根 `SPEC.md`。输出不含时间戳，连续执行结果应完全一致。

## 治理检查

```powershell
node scripts/openspec-governance.js check
```

检查内容：必要目录存在、`SPEC.md` 未过期、相对 Git HEAD 的已提交归档没有修改/删除/重命名。新增归档允许提交。

## 升级已接入项目

1. 在本仓库更新 Schema、模板或工具，增加相应测试并提升版本。
2. 运行 `npm run verify` 并提交。
3. 在目标项目执行不带 `--force` 的安装，查看冲突。
4. 审核本地定制后再决定是否 `--force`；保留并检查自动备份。
5. 合并 config 示例，验证两个 Schema 和项目已有 changes。

## 归档修正策略

归档存在错误时不要原地修改。创建一个新的 correction change，在其 delta spec 中引用错误归档和当前规格，明确修正后的完整行为。这样 Git 历史、交付审计和 AI 回溯路径保持一致。

## 版本策略

- Patch：文案澄清、兼容性修复，不改变产物图。
- Minor：新增模板字段、校验或向后兼容能力。
- Major：Schema 产物顺序、目录契约或安装语义不兼容变化。
