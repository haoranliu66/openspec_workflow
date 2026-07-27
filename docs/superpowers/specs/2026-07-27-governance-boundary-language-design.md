# 全仓治理边界文案统一设计

**日期：** 2026-07-27  
**状态：** 用户已确认  
**范围：** 当前规范、模板、生成文案及历史设计记录

## 1. 背景

仓库已经区分 OpenSpec 原生 artifact graph、项目流程治理和实际程序门禁，但部分文案仍可能让读者误以为所有流程规则都会由 Schema、脚本或 CI 强制执行。需要统一说明两条规则的真实边界：

1. 归档内容按团队流程不得修改，但本项目不要求、也不承诺通过程序或 CI 强制证明归档不可变。
2. 团队应在启动 product change 前完成并确认共享 BR/PRD，但这一顺序属于外层流程治理，不进入 OpenSpec `requires`，也不由脚本或 CI 校验。

两条规则仍是团队应遵守的流程治理规则，不降级为可选建议。

## 2. 统一术语

### 流程治理规则

由团队通过工作约定、评审和协作落实的规则。文档可以使用“应”“不得”等规范性用语，但必须同时明确其不由 Schema、脚本或 CI 强制证明。

本次明确属于流程治理规则的内容包括：

- 已归档 change 的内容不得修改；
- product change 启动前应完成并确认共享 BR/PRD。

### 程序门禁

只有仓库当前真实实现并由命令或 CI 执行的检查才称为程序门禁，例如：

- OpenSpec schema validation；
- 所有活动 change 的逐项 strict validation；
- `SPEC.md` 与 `openspec/change-history.json` 的漂移检查；
- 当前实现范围内的工作区检查。

文档不得把计划、历史提案或团队规则描述为已经存在的程序门禁。

## 3. 目标文案

### 归档不可变

统一表达为：

> 已归档 change 的内容按团队流程不得修改。该规则依靠团队评审与协作执行；本项目不要求、也不承诺通过 base ref、full history、hash、脚本或 CI 强制证明归档不可变。现有治理命令只说明其实际检查范围。

不得再使用容易暗示未来必须补齐程序实现的 P0、验收标准或失败关闭措辞。

### Product change 与 BR/PRD

统一表达为：

> 团队应在启动 product change 前完成并确认共享 BR/PRD。该顺序属于 change 外的流程治理，不进入 OpenSpec 原生 artifact graph；`proposal` 仍是原生 graph 的独立 root，Schema、脚本和 CI 不校验 BR/PRD 是否已经完成。

change 内的 `br.md` 与 `prd.md` 继续作为共享文档的轻量绑定和交付切片，不复制共享正文。

## 4. 修改范围

全仓检查并统一以下内容：

- `README.md`、`AGENTS.md`、`CHANGELOG.md`；
- `docs/FULLSTACK_WORKFLOW.md`、`docs/QUALITY_GATES.md`、`docs/ADOPTION.md`、`docs/OPERATIONS.md`；
- `examples/sample-project/README.md`；
- `openspec/config.yaml` 和相关 schema/template instruction；
- `SPEC.md` 的生成文案及 `scripts/openspec-governance.ts`；
- 受生成文案影响的测试期望；
- `docs/superpowers/specs/` 下已有历史设计记录。

历史设计记录不保留与最终决策冲突的“archive base-ref/hash/full-history 强制属于待实现 P0”表述；改为记录最终边界，避免历史文档继续被搜索结果或 AI 上下文误当成现行目标。

## 5. 不改变的内容

- 不改变 `bugfix` 或 `product-change` 的 artifact graph；
- 不给 `proposal` 增加对 `br` 或 `prd` 的 `requires`；
- 不新增 BR/PRD 完成度校验器；
- 不新增 archive base-ref、full-history、hash 或跨提交完整性检查；
- 不移除当前已经存在的 schema、strict change、生成文件漂移等程序检查；
- 不把两条流程治理规则降级为可选建议。

## 6. 一致性检查

实施后应满足：

1. 搜索“归档不可变”“archive immutable”“base ref”“full-history”“hash”时，不再出现本项目必须新增程序强制的现行或历史目标。
2. 搜索“BR/PRD”“product change”时，所有流程说明都明确“团队应先完成”与“不进入程序门禁”可以同时成立。
3. 文档中只有真实执行的检查被称为 CI 门禁、程序强制或自动校验。
4. 生成后的 `SPEC.md` 与生成器文案一致。
5. 构建、测试、schema validation、活动 change validation 和治理检查继续通过。

## 7. 风险与控制

- **风险：** 过度弱化措辞，让读者误认为归档和 BR/PRD 顺序可选。  
  **控制：** 保留“团队应遵守”“不得修改”等规范性用语，并单独说明执行方式是人工治理。
- **风险：** 历史设计与当前文档继续冲突。  
  **控制：** 按用户决定同步修订历史设计记录，而不是只增加新的覆盖声明。
- **风险：** 修改生成文件但遗漏生成器。  
  **控制：** 先修改生成器和测试期望，再通过正式 index 命令重建 `SPEC.md`。

