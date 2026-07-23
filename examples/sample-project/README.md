# 示例项目结构

```text
project/
  SPEC.md
  lib/
    change-history.js
    schema-alignment.js
  scripts/
    openspec-governance.js
    validate-schemas.js
  docs/requirements/
    REQ-001-operations-console/
      README.md
      BR-001.md
      PRD-001.md
      FEATURE.md
  openspec/
    config.yaml
    change-history.json
    schemas/
    specs/
      operations-console/spec.md
    changes/
      improve-operations-console/
        br.md
        prd.md
        proposal.md
        specs/operations-console/spec.md
        design.md
        tasks.md
        feature.md
```

共享 BR/PRD 是 change 外的长期产品治理；活动 product change 中，`proposal` 后 `specs` 与 `design` 并行解锁，`tasks` 等待二者，`apply` 跟踪 `tasks.md`。`feature` artifact ready 只表示前置 artifact 已具备、可以开始编写 FEATURE；可交付声明必须有实现与验证证据支持，而且仍不代表 change 已关闭。

`SPEC.md` 是最小导航，`openspec/change-history.json` 是详细确定性历史，二者都由 `node scripts/openspec-governance.js index` 生成。安装目标只运行 JavaScript，不需要 TypeScript。

正常关闭使用 `openspec archive <change> --yes --json`；已经执行 `/opsx:sync` 时使用 `--skip-specs`。升级 2.0 不改写已有 archive，旧的活动 product change 应先迁移到原生 OpenSpec headings 和 artifact 结构。
