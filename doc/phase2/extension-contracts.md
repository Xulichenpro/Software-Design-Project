# Phase 2 扩展点接口与实现契约

本文是 Phase 2 CLI 重构的执行契约，供测试与实现共同使用。需求见
[phase_cli_2.md](../../requirements/phase_cli_2.md)；总体目标架构见
[AGENTS.md](../../AGENTS.md)；Phase 1 语义见
[phase_cli_1.md](../../requirements/phase_cli_1.md)。

## 1. 范围与非目标

- 目标：把 Phase 1 的 `CommandFactory`、`ShapeFactory` 两处按名字分派，以及
  `instanceof GroupShape` 的容器判断，替换为四个内核侧扩展点、四个 Registry、
  `PluginHost`/`PluginLoader` 和启动时一次合并。
- 非目标：不新增 `CommandHistory`、`HistoryReceiver`、`bindTarget`；不新增
  `PluginShape`、`BoxShapeProvider` 等 Provider 实例类；不改变 Phase 1 命令语义、
  错误文案和 SVG 编码行为。
- 装配层（A 的顶层装配文件、B 的 `plugins.config.json`）可以变化；**内核与既有
  插件不得变化**。验证以“排除新插件包目录后，`src/` 与既有 `plugins/` 的 diff 为空”
  为准。

## 2. 包与目录

```text
src/
  domain/shapes/                 Shape, ShapeProvider, ShapeRegistration,
                                 ShapeCreationContext, 六种内置图形
  domain/tree/                   ShapeTree, CanvasRoot, ChildCollection,
                                 ShapeContainer, ShapeTopology
  application/commands/base/     Command, PluginCommand, QueryCommand,
                                 UndoableCommand, BarrierCommand,
                                 HistoryControlCommand
  application/commands/          Phase 1 具体命令
  application/contracts/         CommandResult, CommandRegistration,
                                 CommandServices, DocumentView, DocumentEvent,
                                 DocumentObserver, AttributeEditParameters, ...
  application/attributes/        AttributeHandler, AttributeService,
                                 AttributeTransaction, AttributeOutcome, ...
  application/tree/              TreeDecorator, TreeRenderer, TreeRow
  application/registries/        ShapeProviderRegistry, CommandRegistry,
                                 AttributeHandlerRegistry, TreeDecoratorRegistry
  application/receivers/         Phase 1 三个 receiver（改造）
  application/execution/         CommandExecutor（增加提交事件）
  infrastructure/svg/            SvgXmlCodec（查 Registry）
  bootstrap/                     ApplicationBootstrap, PluginHost, PluginLoader,
                                 builtinContributions, codeAssembly, main
  extension-api/                 插件唯一允许导入的公开入口
plugins/
  stats/                        @svgframe/plugin-stats
  dir/                          @svgframe/plugin-dir
  box/                          @svgframe/plugin-shape-box
  tree-star/                    @svgframe/plugin-tree-star
plugins.config.json             方式 B 配置
```

- 插件只允许从 `src/extension-api/index.ts` 导入内核公开类型/抽象；不得导入
  `src/application/**`、`src/domain/**`、`src/bootstrap/**` 的具体实现路径。
- `src/extension-api/index.ts` 只做 re-export，不放逻辑。
- 配置中的相对模块路径以配置文件目录为基准；包名按 Node 模块解析规则解析。

## 3. 公开接口

以下签名是实现契约；类型只表达公开面，不暴露可变 Map。

### 3.1 图形扩展点

```ts
// src/domain/shapes/Shape.ts
export abstract class Shape {
  readonly id: string;
  get kind(): string;              // 默认返回 tag；BoxShape 返回 "box"
  get tag(): string;               // SVG 标签
  get label(): string;             // 命令显示名：`${kind}#${id}`
  get parent(): ShapeContainer | undefined;
  get descendants(): readonly Shape[];
  describe(): ShapeDescription;    // heading 使用 `${tag}#${id}`
  toSvgElement(): SvgElement;
  getAttribute(name: string): string | undefined;
  setAttribute(name: string, value: string | undefined): void;
  move(dx: number, dy: number): void;
  scale(factor: number): void;
  validateMove(dx: number, dy: number): void;
  validateScale(factor: number): void;
}

// src/domain/shapes/ShapeProvider.ts
export abstract class ShapeProvider extends Shape {
  asContainer(): ShapeContainer | undefined;   // 默认 undefined
  canUngroup(): boolean;                       // 默认 true
  validateStructure(finalTopology: ShapeTopology): void; // 默认空实现
  toSvgElement(): SvgElement;                  // kind !== tag 时追加 data-kind
}

// src/domain/shapes/ShapeRegistration.ts
export interface ShapeRegistration {
  readonly type: string;                       // 注册键，如 "rect" / "box"
  readonly prototype: ShapeProvider;
  createFromArguments(
    id: string,
    args: readonly string[],
    quoted: readonly boolean[] | undefined,
    context: ShapeCreationContext,
  ): ShapeProvider;
  createFromSvgElement(
    element: SvgElement,
    context: ShapeCreationContext,
  ): ShapeProvider;
}

// src/domain/shapes/ShapeCreationContext.ts
export interface ShapeCreationContext {
  createFromArguments(
    type: string,
    id: string,
    args: readonly string[],
    quoted?: readonly boolean[],
  ): ShapeProvider;
  createFromSvgElement(element: SvgElement): ShapeProvider;
}
```

- Registry 保存的是**具体类对象**（如 `RectShape`、`BoxShape`），不是实例；静态侧
  由 `ShapeRegistration` 用接口约束，不使用 `abstract static`，也不产生独立 Provider
  对象。
- `Shape` 的 `kind` 默认等于 `tag`；`BoxShape.kind="box"`、`tag="g"`。命令消息使用
  `label`（`box#n1`），结构树标题使用 `describe().heading`（`g#n1`）。
- `GroupShape`、`BoxShape` 实现 `ShapeContainer`；容器判断一律用 `asContainer()`，
  不再用 `instanceof GroupShape`。
- 分组通过 Registry 的 `g` 创建，不允许 receiver 直接 `new GroupShape()`。

### 3.2 命令扩展点

```ts
// src/application/commands/base/PluginCommand.ts
export abstract class PluginCommand<TInput = void> extends Command<TInput> {}

// 四个类别都继承 PluginCommand
export abstract class QueryCommand extends PluginCommand<void> {}
export abstract class UndoableCommand<TParameters> extends PluginCommand<void> {}
export abstract class BarrierCommand extends PluginCommand<void> {}
export abstract class HistoryControlCommand extends PluginCommand<UndoableCommand> {}

// src/application/contracts/CommandRegistration.ts
export interface CommandRegistration {
  readonly name: string;
  readonly help: string;
  create(
    args: readonly ArgumentToken[],
    services: CommandServices,
  ): Command;
}

// src/application/contracts/CommandServices.ts
export interface CommandServices {
  readonly document: DocumentView;
}
```

- 具体命令自己选择类别；`canvas` 的一个注册项根据参数返回
  `ShowCanvasCommand` 或 `ResizeCanvasCommand`。
- Registry 只保存 `CommandRegistration`；`CliApplication` 查表、调用 `create`，不再有
  `CommandFactory`。
- `CommandRegistration.create` 负责该命令的参数规则；`move`/`scale`/`canvas` 的
  数值校验、`create ... in ...` 的解析都在注册项中。`set` 的注册项只检查参数个数并
  保留 `quoted`，属性白名单/数值/引号校验下沉到 `AttributeService` 默认路径。
- `stats` 从 `services.document` 取得共享文档的只读视图；`dir` 忽略 `services`。

### 3.3 属性扩展点

```ts
// src/application/attributes/ReadonlyShape.ts
export interface ReadonlyShape {
  readonly id: string;
  readonly kind: string;
  readonly tag: string;
  readonly label: string;
  readonly descendants: readonly ReadonlyShape[];
  getAttribute(name: string): string | undefined;
}

// src/application/contracts/AttributeEditParameters.ts
export interface AttributeEditRequest {
  readonly id: string;
  readonly name: string;
  readonly value: string;
  readonly quoted: boolean;
}
export interface AttributeWrite {
  readonly shapeId: string;
  readonly name: string;
  readonly value: string | undefined;
}
export interface AttributePatch {
  readonly writes: readonly AttributeWrite[];
  readonly lines: readonly string[];
}
export type AttributeEditParameters = AttributePatch;

// src/application/attributes/AttributeHandler.ts
export abstract class AttributeHandler {
  abstract readonly name: string;
  abstract handles(target: ReadonlyShape, attr: string): boolean;
  abstract apply(
    target: ReadonlyShape,
    request: AttributeEditRequest,
    transaction: AttributeTransaction,
  ): AttributeOutcome;
}

// src/application/attributes/AttributeOutcome.ts
export interface AttributeOutcome {
  readonly forwardLines: readonly string[];
  readonly inverseLines: readonly string[];
}

// src/application/attributes/AttributeTransaction.ts
export interface AttributeTransaction {
  setAttribute(shapeId: string, name: string, value: string | undefined): void;
}
```

- 选择规则：0 个 handler 命中 -> Phase 1 默认白名单；1 个 -> handler；多个 -> 报冲突，
  不执行任何写入。
- handler 只能读 `ReadonlyShape`；所有写入必须经 `AttributeTransaction`，底层 setter
  必须原子。部分成功后抛错时反序回滚，不返回记录、不更新历史、不发布事件，也不回退
  默认处理。
- 一次 `set` 生成一份 `AttributeEditRecord`，forward/inverse 都是 `AttributePatch`，
  各自携带输出行。undo/redo 经原 receiver 重放 patch，不重新选择/执行 handler。
- 默认路径生成 Phase 1 文案：`<label> updated: <attributeSummary>`；box handler 生成
  `box#id fill propagated to id-rect`、`box#id label updated: "..."`、
  `box#id label restored: "..."` 等文案。

### 3.4 树标签扩展点

```ts
// src/application/contracts/DocumentEvent.ts
export type DocumentEventKind =
  | 'edited' | 'history' | 'saved' | 'replaced' | 'initialized' | 'resized';

export interface ShapeSnapshot {
  readonly id: string;
  readonly kind: string;
  readonly tag: string;
  readonly content: string;          // 自身内容（不含孩子内容）
  readonly parentId: string | undefined;
  readonly childrenIds: readonly string[];
}
export interface DocumentEvent {
  readonly kind: DocumentEventKind;
  readonly before: ReadonlyMap<string, ShapeSnapshot>;
  readonly after: ReadonlyMap<string, ShapeSnapshot>;
}
export interface DocumentObserver {
  onCommitted(event: DocumentEvent): void;
}

// src/application/tree/TreeDecorator.ts
export interface TreeRow {
  readonly id: string | undefined;    // 根行为 undefined
  readonly kind: string | undefined;
  readonly isRoot: boolean;
  readonly base: string;             // 完整基础行（含树连接前缀，不含标签）
}
export abstract class TreeDecorator {
  abstract readonly name: string;
  onCommitted(_event: DocumentEvent): void {}
  abstract decorate(row: TreeRow, document: DocumentView): string | undefined;
}
```

- `CommandExecutor` 构造签名为 `(observer?: DocumentObserver, document?: DocumentView)`；
  `document` 用于编辑/历史命令的前后快照采集。`ApplicationBootstrap` 传入共享
  `ShapeTree`；没有 document 时事件快照为空（测试专用）。
- `TreeDecoratorRegistry` 实现 `DocumentObserver`，按注册顺序转发；单个 decorator 抛错
  被隔离，不破坏已提交状态。
- `TreeRenderer` 先生成基础行，再按注册顺序拼接非空标签；每个非空前缀前加一个空格，
  无标签时不追加字符。
- `ModifiedStarDecorator` 的状态是实例私有字段：`dirtyIds`、`rootDirty`。采用“保存后
  发生过编辑”的语义，undo/redo 不消星；save/read 成功清空，失败保留；init 标根并清空
  旧 ids；resize 标根。
- `BoxTypeDecorator` 只看 `row.kind === 'box'` 返回 `(box)`，不感知星号。

### 3.5 文档视图与拓扑

```ts
// src/application/contracts/DocumentView.ts
export interface DocumentView {
  requireInitialized(): void;
  readonly root: ShapeContainer;
  findShape(id: string): Shape;
}

// src/domain/tree/ShapeTopology.ts
export interface ShapeTopology {
  parentOf(shape: Shape): ShapeContainer | undefined;
  childrenOf(container: ShapeContainer): readonly Shape[];
  contains(shape: Shape): boolean;
}
```

- `ShapeTree` 实现 `DocumentView`。
- `ShapeTree.editStructure()` 在现有虚拟孩子表构建后、真正 remove/insert 前，构造
  不可变 topology，并对每个可达 shape 调用 `validateStructure(topology)`；失败无副作用。
- Box 的 `validateStructure` 只检查自己的直接必需子部件，不递归；嵌套 box 自己校验
  自己。整体删除 box 时 box 不可达，跳过。

## 4. Registry、PluginHost 与 Bootstrap

```ts
// 四个 Registry 的共同形状
install(builtin: ReadonlyMap<string, T>, plugin: ReadonlyMap<string, T>): void; // 只允许一次
get(name: string): T;
values(): readonly T[];
```

- `ShapeProviderRegistry` 额外实现 `ShapeCreationContext`，负责 `data-kind`/tag 选择。
- `CommandRegistry.get` 未命中抛 `unknown command: <name>`。
- `ShapeProviderRegistry.get` 未命中抛
  `unknown shape type: <type> (is the plugin loaded?)`。
- `TreeDecoratorRegistry` 实现 `DocumentObserver`，并提供
  `decorate(row, view): readonly string[]`（按注册顺序，过滤空串）。
- `AttributeHandlerRegistry` 提供 `values()`；`AttributeService` 过滤 `handles`。

装配顺序固定为：

```text
ApplicationBootstrap
  -> 创建 ShapeTree、四个空 Registry
  -> 创建 AttributeService / 三个 receiver / SvgXmlCodec / TreeRenderer / Executor
  -> 构造 builtinContributions
  -> 创建 PluginHost（持有内置名称与终端）
  -> A: codeAssembly.load(host)；B: PluginLoader.load(host)
  -> 校验每个插件的 contributes、重名、整包回滚
  -> 合并 builtinContributions + pluginContributions（不覆盖）
  -> 四个 Registry 各 install 一次
  -> CliApplication.run()
```

- A 与 B 只差最外层：A 在 `src/bootstrap/codeAssembly.ts` 静态导入插件；B 用
  `PluginLoader` 按字符串解析。两者都调用同一个 `PluginHost`。
- `PluginContext` 是内核侧公开接口，插件只看到四类注册方法；暂存实现属于宿主。
- `PluginHost.load(module, manifest, options?)` 负责：创建暂存 context、`await activate`、
  比较 `contributes`、检查重名、整包接纳/回滚。
- `contributes` 类别为 `shapes`、`commands`、`attributes`、`decorators`；缺省为空集。
- 失败输出格式按需求第 6 节；加载失败继续启动；配置非法则只用内置能力。

## 5. Box 与 dir 的固定行为

### 5.1 box

- 必要部件：`<id>-rect`（rect）与 `<id>-label`（text）。`createFromArguments` 只创建
  这两个；`createFromSvgElement` 恢复实际子节点后检查这两个；`validateStructure` 只检查
  这两个且允许额外子节点。
- `move`/`scale` 遍历**所有**直接子节点；嵌套 box 通过多态递归；不是只处理 rect/text。
- 模板：rect `x,y,w,h`，默认 `fill=#4a90d9`；text `(x+20, y+35)`，内容为标题。
- `create box` 输出
  `box#<id> created (g#<id> + rect#<id>-rect + text#<id>-label)`；`in` 子句时仍遵循
  现有 create 消息格式。
- 序列化：`<g id="<id>" data-kind="box">` + 子节点；g 上允许 `ShapeStyle.names`
  （`fill`/`stroke`/`stroke-width`），以便 `set <box> stroke` 的输出可读回。
- 读回：先查 `data-kind`，未注册则按 tag 降级为普通 `g`；已选 box 类但缺少/类型错误
  必要部件时拒绝整个 read；重复 id 一律拒绝。
- `ungroup <box>` 报 `cannot ungroup composite shape: <id>`。
- `front`/`back` 对必要部件的重排不额外禁止；box 仍保持必要部件在场。

### 5.2 dir

- 插件包内定义 `DirectoryReader`/`NodeDirectoryAdapter`，内核不新增目录接口。
- `DirectoryReader.currentDirectory()` 返回 `process.cwd()`；`list(path)` 只列直接
  子项，包含隐藏项，不追符号链接。
- 输出：每个标记后用**两个空格**连接名称：

```text
[DIR]  docs
[FILE]  demo.svg
```

- 目录在前、文件在后，各组按名称固定字符比较升序；符号链接及特殊项按 `[FILE]`。
- 空目录 `(empty directory)`；读取失败
  `error: cannot read directory: <path>`。
- `dir` 是 `QueryCommand`，不依赖文档、不改变文档/历史/dirty，不触发 undo 限制。

## 6. A/B 与零内核差异验证

- 设 `C` 为接入插件的那次提交。装配层文件（A 的 `codeAssembly.ts`、B 的
  `plugins.config.json`）允许变化，验证时不计入内核差异。
- 必查：

```bash
git diff C^ C -- src/ plugins/ ':(exclude)plugins/<新增插件包>'
# 输出必须为空
```

- A（代码装配）：新增插件包 + 修改 `src/bootstrap/codeAssembly.ts`；不得修改内核/加载器/
  既有插件。
- B（配置装配）：新增插件包 + 修改 `plugins.config.json`；不得修改已有运行代码。
- 允许的测试、文档、`package.json`、锁文件变化必须逐项说明。
- A/B 双装配一致性：同一输入、同一插件集合/顺序/options、同一初始文件和运行目录，
  两次输出逐字节相同；`dir` 使用固定临时目录，日志写到目录外。
- 基础兼容性：用禁用全部可选插件的配置（含树标签）对照 `final` 的输出，逐字节一致。

## 7. 阶段与提交

| 阶段 | 内容 | 测试提交 | 代码提交 |
|---|---|---|---|
| 0 | 本接口文档与 ADR 标准 | — | 文档提交 |
| 1 | 框架可扩展、Phase 1 回归、metrics 首次产出 | 先提交 | 后提交 |
| 2 | stats、dir 接入 | 先提交 | 后提交 |
| 3 | box 接入、A/B 各演示一次 | 先提交 | 后提交 |
| 4 | modified-star 与 (box) 并存 | 先提交 | 后提交 |
| 5 | 文档/架构对比/最终 metrics，打 tag `p2` | — | 收尾提交 |

每阶段测试先红；实现后必须运行：
`npm run test:phase1`、相关插件测试、`npm run typecheck`、`npm run build`。
失败补 fix commit；不得移动已打 tag。
