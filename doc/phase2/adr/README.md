# Phase 2 ADR 标准与索引

本目录记录 Phase 2 CLI 重构的架构决策。ADR 是测试与实现的共同依据：测试先按 ADR
断言可观察行为，实现不得绕过 ADR 另做一套。

## 标准

- 文件名：`ADR-<三位序号>-<kebab-case-title>.md`，序号一旦分配不复用。
- 每份 ADR 必须包含：Status、Date、Context、Decision、Consequences、Alternatives、
  Verification。
- Status 取值：`Proposed`、`Accepted`、`Superseded by ADR-xxx`、`Deprecated`。
- Decision 必须写成可执行约束：涉及接口的给出签名；涉及输出的给出逐字节样例；涉及
  失败路径的给出错误文案。
- Verification 必须能对应到测试文件/命令；没有验证方式的决策视为未完成。
- 一个决策一份 ADR；不要用一份 ADR 记录多个互不相关的决定。
- 修改已 Accepted 的 ADR 必须新增 Superseding ADR，不直接改写历史结论。
- ADR 中的日期使用 `YYYY-MM-DD`；本仓库使用 Asia/Shanghai 时区。

## 索引

| ADR | 主题 | 状态 |
|---|---|---|
| [ADR-001](ADR-001-registries-and-bootstrap.md) | 四 Registry、PluginHost 与启动时一次合并 | Accepted |
| [ADR-002](ADR-002-shape-provider-static-registration.md) | ShapeProvider 继承 Shape、类对象注册与静态创建 | Accepted |
| [ADR-003](ADR-003-attribute-handler-contract.md) | AttributeHandler 事务、选择规则与输出契约 | Accepted |
| [ADR-004](ADR-004-box-structure-and-readback.md) | Box 结构、模板、序列化与读回降级 | Accepted |
| [ADR-005](ADR-005-tree-decorator-dirty-semantics.md) | TreeDecorator、dirty 语义与标签顺序 | Accepted |
| [ADR-006](ADR-006-plugin-manifest-and-loader.md) | contributes 校验、加载失败与 A/B 装配 | Accepted |
| [ADR-007](ADR-007-command-services.md) | CommandServices 与插件命令依赖注入 | Accepted |
| [ADR-008](ADR-008-shape-topology-validation.md) | ShapeTopology 与结构校验时机 | Accepted |
| [ADR-009](ADR-009-directory-reader-and-dir-output.md) | DirectoryReader 归属、适配器与 dir 输出 | Accepted |
| [ADR-010](ADR-010-label-heading-and-box-messages.md) | 命令 label 与树 heading 分离、box 文案 | Accepted |

## 模板

```markdown
# ADR-xxx：标题

- Status: Proposed
- Date: YYYY-MM-DD

## Context

为什么需要这个决策；相关需求/代码位置；有哪些约束。

## Decision

决策内容；接口签名、输出样例、错误文案；必须可执行。

## Consequences

正面/负面影响；对内核、插件、测试、文档的约束。

## Alternatives

考虑过但未采用的方案，以及不采用的原因。

## Verification

对应测试文件/命令；如何证明决策被遵守。
```
