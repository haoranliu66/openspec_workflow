# 变更日志

## Unreleased

- 澄清共享 BR/PRD 与归档规则属于团队流程治理，不改变 `bugfix` 或 `product-change` 的 artifact graph，也不新增程序校验。

## 2.1.0 - 2026-07-23

- 新增活动 change 文件系统枚举器，按英文名称稳定排序，并逐项执行精确命令 `openspec validate <change> --strict`。
- 单个 change 校验失败后继续处理其他 change，最终稳定汇总非法名称与全部 OpenSpec strict validation 失败项。
- 新增跨平台安全 OpenSpec 调用层与共享项目根识别；源仓库和安装后的 JavaScript 运行时使用同一逻辑。
- CI 在 Node.js 20.19 与 22 上启用活动 change 严格校验，安装器同步分发所需脚本和共享库。
- 归档不可变仍是工作流政策；本版本不新增 base ref、full-history、hash 或其他程序化强制。

## 2.0.0 - 2026-07-23

- 将 `bin/`、`lib/`、`scripts/` 与 `tests/` 的维护源码统一为 TypeScript；`dist/` 为不跟踪的编译产物，安装目标只接收可由普通 Node.js 执行的 JavaScript。
- 将 Node.js 下限提升到 `>=20.19.0`，兼容目标固定为 `@fission-ai/openspec@1.5.0`。
- product-change 对齐原生 OpenSpec graph：`proposal` 后并行解锁 `specs` 与 `design`，`tasks` 等待二者，`apply` 跟踪 `tasks.md`；BR/PRD 保持外层治理。
- 新增确定性的 `SPEC.md` 最小导航与 `openspec/change-history.json` 机器历史，活动 change 在尚无 specs 时也可见。
- 加固安装器的非 P0 JavaScript 映射、生成文件管理和真实目标运行验证；CI 覆盖 Node.js 20.19 与 22、TypeScript 源边界及双生成文件漂移。
- 2.0 升级不会改写已有 archive；活动 product changes 需迁移到原生 artifact/template 结构。
- 自动严格活动 change 校验和基于 base ref 的归档不可变性检查仍为暂缓 P0，不属于本版本。

## 1.0.0 - 2026-07-21

- 新增 `bugfix` 与 `product-change` OpenSpec Schema。
- 新增精简共享 BR、PRD 和 FEATURE 模板。
- 新增确定性 `SPEC.md` 生成与工作区归档变更提示。
- 新增冲突安全安装器、测试、CI、接入指南和质量门禁。
