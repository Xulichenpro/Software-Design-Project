# ADR-006：contributes 校验、加载失败与 A/B 装配

- Status: Accepted
- Date: 2026-11-09

## Context

Phase 2 要求同一插件既能用代码装配（A），也能用 `plugins.config.json` 加载（B）；
两者必须共用扩展点、注册路径与失败回滚。加载器不得硬编码插件名、导入或分支；四类
失败必须按固定格式输出并继续启动。

## Decision

1. 插件 `package.json` 用 `contributes` 声明 `shapes`、`commands`、`attributes`、
   `decorators` 四类名称列表，缺省为空集。实际注册名来自 `ShapeRegistration.type`、
   `CommandRegistration.name`、`AttributeHandler.name`、`TreeDecorator.name`。
2. `PluginHost.load(module, manifest, options?)` 的固定流程：
   创建暂存 `PluginContext` → `await module.activate(ctx, options)` → 比较声明/实际
   集合 → 检查与内置/已接纳插件的同类重名 → 全部通过才整包接纳，否则丢弃本插件全部
   暂存注册。
3. A 与 B 的差别只在最外层：A 在 `src/bootstrap/codeAssembly.ts` 静态导入并调用
   `host.load`；B 用 `PluginLoader` 按字符串解析模块、读取 `package.json`、调用同一个
   `host.load`。两者不绕过校验。
4. 错误输出：
   - 模块找不到：`error: plugin not found: <module>`
   - 没有默认导出：`error: plugin has no default export: <module>`
   - 清单不一致：`error: plugin manifest mismatch: <name> (declared: …, registered: …)`
   - 激活抛错：`error: plugin failed to activate: <name> (<reason>)`
   - 同类重名：`error: duplicate registration: <category>/<name>`
   - 配置非法：`error: invalid plugin config`
   以上均不退出主程序；配置非法时只用内置能力。
5. 先解析模块、再动态导入：解析失败归 `plugin not found`；模块存在但求值/依赖失败
   归 `plugin failed to activate`。相对模块路径以配置文件目录为基准；支持无扩展名的
   `./plugins/<name>`（解析到 `src/index.ts`/`index.ts`/package main）。包名按运行环境
   模块解析规则。
6. 按配置数组顺序加载，`enabled:false` 完全跳过；`options` 原样传给 activate 并冻结。
7. 装配层（A 的装配文件、B 的配置文件）不计入内核零差异判据；只要求 `src/` 与既有
   `plugins/` 不变。

## Consequences

- 新增插件只新增包和一条装配/配置；加载器无需修改。
- 插件失败不影响已成功插件与内置能力；启动继续。
- A/B 的插件集合、顺序、options 必须一致，输出才能逐字节一致。
- 测试需要覆盖四条失败、重复、整包回滚、disabled、options、相对/包名解析。

## Alternatives

- 每个插件在代码里写 switch：违反加载器独立性，拒绝。
- 清单不一致只警告：会留下半套注册，拒绝。
- 配置非法时尝试加载部分合法项：需求要求默认内置能力，拒绝。

## Verification

- `tests/plugin/PluginLoader.test.ts`：四条失败、重复、回滚、disabled、options、顺序。
- `tests/plugin/PluginHost.test.ts`：暂存/整包接纳/清单比较。
- `tests/acceptance/transcripts.test.ts`：A/B 双装配逐字节一致。
- `rg -n "import|require|switch" src/bootstrap` 人工检查无具体插件硬编码。
