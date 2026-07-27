# 示例项目结构

```text
project/
  SPEC.md
  lib/
    change-history.js
    openspec-cli.js
    project-root.js
    schema-alignment.js
  scripts/
    openspec-governance.js
    validate-changes.js
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

团队应在启动 product change 前完成并确认共享 BR/PRD。该顺序属于 change 外的流程治理，不进入 OpenSpec 原生 artifact graph，也不由 Schema、脚本或 CI 校验；`proposal` 仍是原生 graph 的独立 root。活动 product change 中，`proposal` 后 `specs` 与 `design` 并行解锁，`tasks` 等待二者，`apply` 跟踪 `tasks.md`。`feature` artifact ready 只表示前置 artifact 已具备、可以开始编写 FEATURE；可交付声明必须有实现与验证证据支持，而且仍不代表 change 已关闭。

`SPEC.md` 是最小导航，`openspec/change-history.json` 是详细确定性历史，二者都由 `node scripts/openspec-governance.js index` 生成。安装目标只运行 JavaScript，不需要 TypeScript。

正常关闭先运行 `node scripts/validate-close.js <change>`，再运行 `node bin/workflow.js close <change> --target .`；已经执行 `/opsx:sync` 时才向 `close` 传入 `--skip-specs`。升级 2.0 不改写已有 archive，旧的活动 product change 应先迁移到原生 OpenSpec headings 和 artifact 结构。

安装目标在 CI 中运行 `node scripts/validate-changes.js`，按文件系统一级目录逐项执行 `openspec validate <change> --strict`。已归档 change 的内容按团队流程不得修改。该规则依靠团队评审与协作执行；本项目不要求、也不承诺通过 base ref、full history、hash、脚本或 CI 强制证明归档不可变。

## Closeout validation

Create and complete a change-specific closeout input before closing it:

```powershell
Copy-Item docs/closeout-templates/product-change.json openspec/changes/<change>/closeout.json
node scripts/validate-close.js <change>
node bin/workflow.js close <change> --target .
```

The copied template is an input to complete with factual evidence and gate decisions; it is not ready to close as-is. Pass `--skip-specs` to `close` only after the change has already been synced with `/opsx:sync`.

Closeout validation checks task state, structured references, project-local evidence artifacts, and declared gate evidence. It does not judge semantic correctness, evidence sufficiency, or N/A rationale, and it records rather than executes `closeout.json.command`. `validate:changes` remains the separate all-active-change OpenSpec strict-validation gate.
