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
      bugfix/
      product-change/
    specs/
      operations-console/spec.md
    changes/
      add-cache-policy/          # system-change: schema spec-driven
        proposal.md
        specs/cache-policy/spec.md
        design.md
        tasks.md
      improve-operations-console/
        br.md
        prd.md
        proposal.md
        specs/operations-console/spec.md
        design.md
        tasks.md
```

路径按行为与治理面选择，而不是按代码规模：bugfix 只恢复已确认行为且不新增 Requirement；system-change 用于有限、非产品系统行为，metadata 直接写 `schema: spec-driven`；任一产品目标、用户旅程、角色权限、业务规则、公共契约或共享产品验收变化都使用 product-change。项目不创建 `openspec/schemas/spec-driven/`，该路径使用 OpenSpec `1.5.0` 内置 Schema。

团队应在启动 product change 前完成并确认共享 BR/PRD。该顺序属于 change 外的流程治理，不进入 OpenSpec 原生 artifact graph，也不由 Schema、脚本或 CI 校验；`proposal` 仍是原生 graph 的独立 root。活动 product change 中，`proposal` 后 `specs` 与 `design` 并行解锁，`tasks` 等待二者，`apply` 跟踪 `tasks.md`。新 change 不生成 local `feature.md`；共享 FEATURE 每行记录一个有 passed evidence 的交付结论，但 `ready` 仍不代表 change 已关闭。

规划包完成或发生实质修改后，AI 必须结束当前轮次、展示 change ID 和计划摘要，并等待后续 `/opsx:apply <change>`、`确认实施 <change>` 或针对单一 change 的无歧义确认。原始请求、artifact 生成、`/opsx:continue`、`/opsx:ff` 和普通“继续”不构成授权；授权仅适用于该 change，规划实质修改后失效。该规则是团队治理，不由程序或 CI 强制证明。

`SPEC.md` 是最小导航，`openspec/change-history.json` 是详细确定性历史，二者都由 `node scripts/openspec-governance.js index` 生成。安装目标只运行 JavaScript，不需要 TypeScript。

正常关闭只需运行正式入口 `node bin/workflow.js close <change> --target .`；`node scripts/validate-close.js <change>` 是可选预检。已经执行 `/opsx:sync` 时才向 `close` 传入 `--skip-specs`。升级不改写已有 archive，旧的活动 product change 应先迁移到当前 headings 和 artifact 结构。

安装目标在 CI 中运行 `node scripts/validate-changes.js`，按文件系统一级目录逐项执行 `openspec validate <change> --strict`。已归档 change 的内容按团队流程不得修改。该规则依靠团队评审与协作执行；本项目不要求、也不承诺通过 base ref、full history、hash、脚本或 CI 强制证明归档不可变。

## Closeout validation

Create and complete a change-specific closeout input before closing it:

```powershell
Copy-Item docs/closeout-templates/product-change.json openspec/changes/<change>/closeout.json
node bin/workflow.js close <change> --target .
```

对于 system-change，复制非产品模板：

```powershell
Copy-Item docs/closeout-templates/spec-driven.json openspec/changes/<change>/closeout.json
node bin/workflow.js close <change> --target .
```

The copied template is an input to complete with factual evidence and gate decisions; it is not ready to close as-is. Pass `--skip-specs` to `close` only after the change has already been synced with `/opsx:sync`.

Closeout validation checks task state, structured references, project-local evidence artifacts, and declared gate evidence. Product-change additionally requires Requirement/PRD and shared FEATURE trace; bugfix/spec-driven require stable delta Requirement IDs without product artifacts. It does not judge semantic correctness, evidence sufficiency, or N/A rationale. `closeout.json.command` is optional and is never executed; `artifact` remains required. `validate:changes` remains the separate all-active-change OpenSpec strict-validation gate.
