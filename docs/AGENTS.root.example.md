# 项目 AI 交付治理

对代码、产品行为或系统行为的变更，先阅读并遵守 `docs/AI_WORKFLOW_AGENTS.md`，并以 `docs/FULLSTACK_WORKFLOW.md` 的“统一生命周期”为唯一完整流程。优先使用安装的 OpenSpec 原生 `openspec-explore/propose/update/apply` skills，并通过 `node bin/openspec.js` 使用项目固定运行时；本文件不复制或改写主流程。

其他 workflow 或 skill 只可作为该生命周期内按需加载的有界辅助，不得建立并行交付流程或绕过 change-scoped 实施与关闭授权。AI 必须执行主流程规定的 planning 后停顿和团队审核后停顿；普通“继续”或先前实施授权不得被解释为关闭授权。

安装的 `openspec-archive-change` 是本项目 formal-close 治理 wrapper。没有针对准确 change 的后续明确关闭授权时不得执行；正常关闭不得直接调用 OpenSpec archive 或手工移动 change。

系统、开发者、用户指令以及本项目强制的安全、发布、迁移、运维和领域规则继续按其既有优先级生效。若其他 workflow、skill 或项目规则与本流程发生实质冲突，AI 必须说明冲突来源、影响、优先级和建议方案；无法消解时停止相关实施并等待用户决定。

GitNexus 推荐用于大型或陌生代码库的探索、影响分析、调试和重构。使用前检查仓库上下文与索引新鲜度，按任务加载匹配能力；不可用时回退到代码搜索与测试。其结果不替代 specs、代码、测试、verification 或团队审核，也不是 CI 或 formal close 门禁。
