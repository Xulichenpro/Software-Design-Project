# ADR-001：四 Registry、PluginHost 与启动时一次合并

- Status: Accepted
- Date: 2026-11-09

## Context

Phase 1 在 [CommandFactory](../../../src/application/factory/CommandFactory.ts) 和
[ShapeFactory](../../../src/domain/factory/ShapeFactory.ts) 中按命令名/类型名 switch。
Phase 2 要求四个内核侧扩展点，新增插件不得修改内核、加载器、receiver、渲染器或既有插件。
A（改一个顶层装配文件）与 B（只改配置文件）必须走同一条注册与校验路径。

## Decision

1. 删除 `CommandFactory`、`ShapeFactory`，不保留按名字分派的工厂。
2. 四类贡献分别进入四个 Registry：
   - `ShapeProviderRegistry`：`type -> ShapeRegistration`（具体类对象）
   - `CommandRegistry`：`name -> CommandRegistration`
   - `AttributeHandlerRegistry`：`name -> AttributeHandler`
   - `TreeDecoratorRegistry`：`name -> TreeDecorator`（保序）
3. 启动时由 `ApplicationBootstrap` 收集 `builtinContributions` 与
   `pluginContributions`，做无覆盖合并，然后每个 Registry 只 `install()` 一次。
4. 运行期 Registry 只暴露 `get()`/`values()` 等查询，不暴露可变 Map，不再合并。
5. `PluginHost` 负责每个插件的暂存、重名检查、`contributes` 校验、整包接纳/回滚；
   A 与 B 都调用它。`PluginLoader` 只负责按字符串解析模块和读取配置，不属于内核。
6. 装配层变化（A 的 `src/bootstrap/codeAssembly.ts`、B 的 `plugins.config.json`）
   不计入“内核零差异”判据；判据只要求 `src/` 与既有 `plugins/` 不变。

## Consequences

- `CliApplication` 直接持有 `CommandRegistry`，查表后调用注册项实例化；不再依赖工厂。
- 内置命令/图形也通过注册项装配，禁用可选插件时仍完整。
- 新增插件只新增字典项；A 改一个装配文件，B 改配置。
- Registry 的 `install()` 必须防止二次安装；合并时同名视为实现错误（Host 已提前拒绝）。

## Alternatives

- 保留 Factory，在 Factory 内查 Registry：仍是第三个名字分派点，拒绝。
- 运行期可变 Registry：无法保证 A/B 一致与“安装一次”，拒绝。
- 每个插件直接写全局 Registry：无法整包回滚，拒绝。

## Verification

- `tests/application/registries/*.test.ts`：四条注册路径、重名、只安装一次、只读查询。
- `tests/acceptance/bootstrap.test.ts`：内置装配、Phase 1 回归。
- `tests/plugin/loader.test.ts`：A/B 共用路径、失败回滚。
- `git diff C^ C -- src/ plugins/ ':(exclude)plugins/<新增>'` 为空。
