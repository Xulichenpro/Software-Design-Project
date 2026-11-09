# ADR-007：CommandServices 与插件命令依赖注入

- Status: Accepted
- Date: 2026-11-09

## Context

`stats` 是独立插件包，不能导入 `ApplicationBootstrap`、receiver 或宿主模块，但需要
访问共享的只读文档。AGENTS 的图只画了 `StatsCommand --> ShapeTree`，没有画依赖注入
路径；会话中 `PluginContext` 曾写“公开服务”，定稿遗漏。

## Decision

1. 增加内核侧 `CommandServices`：
   ```ts
   interface CommandServices {
     readonly document: DocumentView;
   }
   ```
   `DocumentView` 暴露 `requireInitialized()`、`root: ShapeContainer`、`findShape(id)`；
   `ShapeTree` 实现它。
2. `CommandRegistration.create(args, services)` 在 `CliApplication` 实例化命令时接收
   `services`；内置命令的注册项可以闭包绑定 receiver，也可以使用 services。
3. `stats` 从 `services.document` 只读 DFS；`dir` 忽略 services，自己构造
   `NodeDirectoryAdapter`。插件命令不得反向导入 receiver/宿主。
4. `help` 的帮助行由 `CommandRegistry.values()` 提供；`HelpCommand` 仍调用
   `QueryReceiver.help()`，后者持有 Registry 的只读查询。
5. `CommandServices` 是内核公开契约，不属于插件扩展点；新增服务必须走新的 ADR，
   不能把 receiver 直接暴露给插件。

## Consequences

- stats 可以在独立包内测试：传入替身 `DocumentView` 即可。
- CommandRegistry 的注册项统一签名；A/B 注入同一个 services。
- DocumentView 仍是可变 Shape 的只读视图（TypeScript 结构类型），只读是契约而非
  运行时强制；stats 测试断言不改变状态。

## Alternatives

- 让 stats 导入 `ApplicationBootstrap`/receiver：违反插件依赖规则，拒绝。
- 在 `QueryReceiver` 增加 `stats()`：stats 必须修改内核/receiver，拒绝。
- 全局单例树：无法独立测试、A/B 不一致，拒绝。

## Verification

- `tests/plugin/stats.test.ts`：替身 DocumentView、空文档、box 计数、只读。
- `tests/cli/CliApplication.test.ts`：注册项接收 services、unknown command。
- `tests/acceptance/*`：stats 在未初始化/初始化后的行为。
