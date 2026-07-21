# AI 全栈可持续开发工作流设计

## 目标

将已在 PEIS 项目验证的 OpenSpec 治理方式抽象为独立 Git 仓库，使不同技术栈项目可以离线安装、持续升级并保持低注意力成本。工作流必须同时支持小 Bug 快速交付和跨角色、跨模块、接口/数据契约类产品变更。

## 核心原则

1. `openspec/specs/<capability>/spec.md` 是当前行为的唯一事实来源。
2. change 只保存本次增量；archive 保存不可变历史。
3. 根 `SPEC.md` 只做导航，不复制需求正文。
4. BR/PRD 只保留会影响决策、范围和验收的信息。
5. 精确 SHALL/MUST 与 WHEN/THEN 只存在于 spec。
6. AI 默认加载最小上下文，只有发生冲突或回归时才读取历史。
7. 自动化必须无运行时依赖、确定性、幂等，并对覆盖操作采取失败关闭策略。

## 两条交付路径

- `bugfix`：`proposal -> specs -> tasks -> apply`，用于行为已经明确、没有新增角色/流程/接口/业务规则的小 Bug。
- `product-change`：`BR -> PRD -> proposal -> specs -> design(TD) -> tasks -> apply -> feature`，用于新功能、管理台、跨角色流程、接口/数据契约和业务规则。

产品交付完成后执行 `verify -> feature -> sync/archive -> index -> check`。CLI archive 同时完成 delta 合并与归档，不与已经执行的 CLI sync 重复使用。

## 仓库结构

```text
ai-fullstack-openspec-workflow/
|- README.md
|- AGENTS.md
|- SPEC.md
|- bin/workflow.js
|- lib/installer.js
|- scripts/openspec-governance.js
|- openspec/config.yaml
|- openspec/schemas/bugfix/
|- openspec/schemas/product-change/
|- docs/requirements/_templates/
|- docs/FULLSTACK_WORKFLOW.md
|- docs/QUALITY_GATES.md
|- docs/ADOPTION.md
|- docs/OPERATIONS.md
|- examples/sample-project/
`- tests/
```

## CLI 边界

```text
node bin/workflow.js install --target <project> [--force]
node bin/workflow.js index --target <project>
node bin/workflow.js check --target <project>
```

`install` 只写工作流拥有的文件。目标文件不存在时复制；内容相同时跳过；内容冲突时默认终止且不覆盖。`--force` 将冲突文件备份到 `.ai-workflow-backup/<timestamp>/` 后覆盖。已有 `openspec/config.yaml` 不直接覆盖，而是写入 `openspec/ai-workflow.config.example.yaml` 供人工合并。

## 追溯模型

根索引记录 capability 的当前 spec、首次归档、最近归档和活动 changes。新 delta spec 保存稳定 Requirement ID、canonical spec 路径和零个或多个 Previous changes。旧 archive 永远不添加正向链接；并行开发通过多个 Previous changes 表达，历史关系是 DAG 而不是单链表。

## 高可用与恢复

- Node.js 18+，运行时零第三方依赖。
- 生成结果不含时间戳，重复执行字节一致。
- 安装冲突失败关闭；强制覆盖前创建备份。
- `check` 同时检查索引漂移、归档修改和必要目录。
- CI 在 Node 18/20 上执行测试，并用固定 OpenSpec 1.5.0 校验 Schema。
- 升级通过 Git tag 和 CHANGELOG 管理；安装器幂等重放。

## 全栈质量门禁

所有 change 必须经过规格一致性、测试证据和回滚检查。前端、API、数据库、安全、可观测性、性能和发布门禁按影响范围选择，不要求无关 change 填写空章节。design.md 是唯一 TD，负责记录跨层契约、迁移、兼容、故障恢复和回滚。

## 非目标

- 不替代 Git、CI、项目测试框架或发布平台。
- 不把所有历史文档自动注入 AI 上下文。
- 不发布中心化 SaaS 或依赖网络服务。
- 不自动改写已有项目的业务代码、AGENTS.md 或冲突配置。
