# AI 全栈 OpenSpec 工作流实施计划

**目标：** 建立一个独立、零运行时依赖的 Git 仓库，可向其他项目安装并校验精简 AI 全栈 OpenSpec 工作流。

**架构：** 仓库使用自身的 OpenSpec Schema 和治理索引。独立治理脚本负责当前规格发现、确定性索引生成和归档不可变检查；安装器以幂等、冲突安全的方式把版本化资产复制到目标项目。

**技术栈：** Node.js 18+ CommonJS、OpenSpec Schema、Markdown、GitHub Actions。

## 全局约束

- 运行时代码零第三方依赖。
- 未显式指定 `--force` 时，安装器不覆盖内容不同的文件。
- 强制覆盖前创建可恢复备份。
- 自动生成的 `SPEC.md` 只包含链接，不复制需求正文。
- 不修改目标项目业务代码和已有 `AGENTS.md`。
- Git 中已提交的归档不可变。

## 任务 1：治理运行时

**文件：** `scripts/openspec-governance.js`、`tests/governance.test.js`

- [x] 为当前规格、归档、活动 change 发现和确定性输出编写测试。
- [x] 为过期索引、缺失目录和归档篡改编写测试。
- [x] 实现治理运行时与 CLI 接口。
- [x] 运行测试并确认通过。

## 任务 2：冲突安全安装器与 CLI

**文件：** `lib/installer.js`、`bin/workflow.js`、`tests/installer.test.js`

- [x] 覆盖全新安装、幂等重装、冲突拒绝、强制备份和配置保留。
- [x] 实现 `install/index/check` 参数解析。
- [x] 运行安装器测试并确认通过。

## 任务 3：Schema、模板和运维文档

**文件：** `openspec/**`、`docs/requirements/_templates/**`、仓库说明文档

- [x] 加入稳定 ID、向后追溯、当前规格同步和不可变归档规则。
- [x] 加入按改动面选择的全栈质量门禁。
- [x] 记录安装、生命周期、恢复、升级和 AI 上下文顺序。
- [x] 使用 OpenSpec 校验两套 Schema。

## 任务 4：打包、示例、CI 与 Git 基线

**文件：** `package.json`、`.github/workflows/validate.yml`、`examples/`、`SPEC.md`

- [x] 提供 `test`、`index`、`check`、`validate:schemas` 和 `verify` 命令。
- [x] 在临时目标执行安装和治理脚本。
- [x] 验证测试、Schema、索引确定性、归档检查和 `git diff --check`。
- [x] 初始化 Git、提交基线并确认工作区干净。
