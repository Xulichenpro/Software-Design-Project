# Phase 2 指标报告（final → p2）

> 本报告由 `scripts/metrics.mjs` **从 Git 历史自动生成**（Generated from git history），请勿手工编辑。
> 生成命令：`node scripts/metrics.mjs --from final --to HEAD --label p2`；产物目录：`docs/metrics/`。
> 范围：`git diff` 统计；已排除 `node_modules`、`dist`；VSCode 扩展单列，不计入 CLI 增量。
> 圈复杂度为**决策点计数代理**（1 + if/for/while/case/catch/&&/||/三元 ?），用于增量比较，不是编译器级精确值。

## 概览

| 分类 | 文件数 | 新增行 | 删除行 |
|---|---:|---:|---:|
| 内核（Kernel） | 49 | 1056 | 278 |
| 装配（Assembly） | 6 | 558 | 11 |
| 插件（Plugin） | 16 | 501 | 0 |
| 工具与配置（Tooling） | 5 | 327 | 3 |
| VSCode 扩展（单列） | 10 | 415 | 0 |

## 圈复杂度增量（决策点计数代理）

| 分类 | final | HEAD | 增量 |
|---|---:|---:|---:|
| 内核（Kernel） | 202 | 262 | +60 |
| 装配（Assembly） | 2 | 109 | +107 |
| 插件（Plugin） | 0 | 77 | +77 |

### 文件明细

| 文件 | final | HEAD | 增量 |
|---|---:|---:|---:|
| `plugins/box/src/BoxAttributeHandler.ts` | 0 | 10 | +10 |
| `plugins/box/src/BoxShape.ts` | 0 | 21 | +21 |
| `plugins/box/src/BoxTypeDecorator.ts` | 0 | 2 | +2 |
| `plugins/box/src/index.ts` | 0 | 1 | +1 |
| `plugins/dir/src/DirCommand.ts` | 0 | 7 | +7 |
| `plugins/dir/src/DirectoryReader.ts` | 0 | 1 | +1 |
| `plugins/dir/src/index.ts` | 0 | 2 | +2 |
| `plugins/dir/src/NodeDirectoryAdapter.ts` | 0 | 2 | +2 |
| `plugins/stats/src/index.ts` | 0 | 2 | +2 |
| `plugins/stats/src/StatsCommand.ts` | 0 | 5 | +5 |
| `plugins/tree-star/src/index.ts` | 0 | 1 | +1 |
| `plugins/tree-star/src/ModifiedStarDecorator.ts` | 0 | 23 | +23 |
| `src/application/attributes/AttributeHandler.ts` | 0 | 1 | +1 |
| `src/application/attributes/AttributeOutcome.ts` | 0 | 1 | +1 |
| `src/application/attributes/AttributeService.ts` | 0 | 15 | +15 |
| `src/application/attributes/AttributeTransaction.ts` | 0 | 1 | +1 |
| `src/application/attributes/ReadonlyShape.ts` | 0 | 1 | +1 |
| `src/application/commands/base/BarrierCommand.ts` | 1 | 1 | +0 |
| `src/application/commands/base/HistoryControlCommand.ts` | 1 | 1 | +0 |
| `src/application/commands/base/PluginCommand.ts` | 0 | 1 | +1 |
| `src/application/commands/base/QueryCommand.ts` | 1 | 1 | +0 |
| `src/application/commands/base/UndoableCommand.ts` | 3 | 3 | +0 |
| `src/application/commands/editing/SetAttributeCommand.ts` | 1 | 1 | +0 |
| `src/application/contracts/AttributeEditParameters.ts` | 1 | 1 | +0 |
| `src/application/contracts/CommandRegistration.ts` | 0 | 1 | +1 |
| `src/application/contracts/CommandResult.ts` | 2 | 3 | +1 |
| `src/application/contracts/CommandServices.ts` | 0 | 1 | +1 |
| `src/application/contracts/DocumentEvent.ts` | 0 | 1 | +1 |
| `src/application/contracts/DocumentView.ts` | 0 | 1 | +1 |
| `src/application/execution/CommandExecutor.ts` | 12 | 19 | +7 |
| `src/application/execution/DocumentSnapshot.ts` | 0 | 5 | +5 |
| `src/application/factory/CommandFactory.ts` | 39 | 0 | -39 |
| `src/application/receivers/DocumentReceiver.ts` | 6 | 6 | +0 |
| `src/application/receivers/QueryReceiver.ts` | 5 | 2 | -3 |
| `src/application/receivers/ShapeEditorReceiver.ts` | 22 | 31 | +9 |
| `src/application/registries/AttributeHandlerRegistry.ts` | 0 | 6 | +6 |
| `src/application/registries/CommandRegistry.ts` | 0 | 6 | +6 |
| `src/application/registries/ShapeProviderRegistry.ts` | 0 | 11 | +11 |
| `src/application/registries/TreeDecoratorRegistry.ts` | 0 | 11 | +11 |
| `src/application/tree/TreeDecorator.ts` | 0 | 1 | +1 |
| `src/application/tree/TreeRenderer.ts` | 0 | 6 | +6 |
| `src/application/tree/TreeRow.ts` | 0 | 1 | +1 |
| `src/bootstrap/ApplicationBootstrap.ts` | 1 | 3 | +2 |
| `src/bootstrap/builtinContributions.ts` | 0 | 15 | +15 |
| `src/bootstrap/codeAssembly.ts` | 0 | 1 | +1 |
| `src/bootstrap/main.ts` | 1 | 2 | +1 |
| `src/bootstrap/PluginHost.ts` | 0 | 30 | +30 |
| `src/bootstrap/PluginLoader.ts` | 0 | 58 | +58 |
| `src/cli/CliApplication.ts` | 5 | 6 | +1 |
| `src/domain/factory/ShapeFactory.ts` | 30 | 0 | -30 |
| `src/domain/shapes/CircleShape.ts` | 1 | 3 | +2 |
| `src/domain/shapes/EllipseShape.ts` | 1 | 3 | +2 |
| `src/domain/shapes/GroupShape.ts` | 5 | 6 | +1 |
| `src/domain/shapes/LineShape.ts` | 1 | 3 | +2 |
| `src/domain/shapes/RectShape.ts` | 1 | 3 | +2 |
| `src/domain/shapes/Shape.ts` | 24 | 24 | +0 |
| `src/domain/shapes/ShapeCreationContext.ts` | 0 | 2 | +2 |
| `src/domain/shapes/ShapeProvider.ts` | 0 | 2 | +2 |
| `src/domain/shapes/ShapeRegistration.ts` | 0 | 1 | +1 |
| `src/domain/shapes/ShapeSvgReadback.ts` | 0 | 14 | +14 |
| `src/domain/shapes/TextShape.ts` | 5 | 10 | +5 |
| `src/domain/tree/DocumentView.ts` | 0 | 1 | +1 |
| `src/domain/tree/ShapeTopology.ts` | 0 | 1 | +1 |
| `src/domain/tree/ShapeTree.ts` | 30 | 35 | +5 |
| `src/extension-api/index.ts` | 0 | 1 | +1 |
| `src/infrastructure/svg/SvgXmlCodec.ts` | 5 | 5 | +0 |
| `src/infrastructure/svg/XmlParser.ts` | 0 | 2 | +2 |

## 内核（Kernel）

### 文件清单与职责

| 文件 | 职责 | 新增行 | 删除行 | 当前行数 |
|---|---|---:|---:|---:|
| `src/application/attributes/AttributeHandler.ts` | 属性语义扩展点 | 15 | 0 | 15 |
| `src/application/attributes/AttributeOutcome.ts` | 属性扩展点与事务 | 4 | 0 | 4 |
| `src/application/attributes/AttributeService.ts` | 零/一/多命中分派、默认白名单、事务回滚 | 116 | 0 | 116 |
| `src/application/attributes/AttributeTransaction.ts` | 属性扩展点与事务 | 4 | 0 | 4 |
| `src/application/attributes/ReadonlyShape.ts` | 属性扩展点与事务 | 9 | 0 | 9 |
| `src/application/commands/base/BarrierCommand.ts` | 具体命令实现 | 3 | 2 | 3 |
| `src/application/commands/base/HistoryControlCommand.ts` | 具体命令实现 | 3 | 2 | 6 |
| `src/application/commands/base/PluginCommand.ts` | 具体命令实现 | 4 | 0 | 4 |
| `src/application/commands/base/QueryCommand.ts` | 具体命令实现 | 3 | 2 | 3 |
| `src/application/commands/base/UndoableCommand.ts` | 具体命令实现 | 2 | 2 | 22 |
| `src/application/commands/editing/SetAttributeCommand.ts` | 具体命令实现 | 6 | 6 | 11 |
| `src/application/contracts/AttributeEditParameters.ts` | 命令/文档/属性公开契约 | 19 | 1 | 19 |
| `src/application/contracts/CommandRegistration.ts` | 命令/文档/属性公开契约 | 14 | 0 | 14 |
| `src/application/contracts/CommandResult.ts` | 命令/文档/属性公开契约 | 7 | 1 | 7 |
| `src/application/contracts/CommandServices.ts` | 命令/文档/属性公开契约 | 6 | 0 | 6 |
| `src/application/contracts/DocumentEvent.ts` | 命令/文档/属性公开契约 | 31 | 0 | 31 |
| `src/application/contracts/DocumentView.ts` | 命令/文档/属性公开契约 | 1 | 0 | 1 |
| `src/application/execution/CommandExecutor.ts` | 历史双栈与 edited/history/barrier 事件通知 | 40 | 3 | 82 |
| `src/application/execution/DocumentSnapshot.ts` | 不可变前后文档快照 | 32 | 0 | 32 |
| `src/application/factory/CommandFactory.ts` | 内核源码 | 0 | 103 | 0 |
| `src/application/receivers/DocumentReceiver.ts` | 命令 receiver | 20 | 4 | 42 |
| `src/application/receivers/QueryReceiver.ts` | 命令 receiver | 10 | 22 | 19 |
| `src/application/receivers/ShapeEditorReceiver.ts` | 命令 receiver | 42 | 18 | 132 |
| `src/application/registries/AttributeHandlerRegistry.ts` | 属性处理器注册表 | 29 | 0 | 29 |
| `src/application/registries/CommandRegistry.ts` | 命令注册表与 unknown command 文案 | 29 | 0 | 29 |
| `src/application/registries/ShapeProviderRegistry.ts` | 图形类对象注册表与 data-kind 读回选择 | 60 | 0 | 60 |
| `src/application/registries/TreeDecoratorRegistry.ts` | 树标签注册表、Observer 转发与异常隔离 | 55 | 0 | 55 |
| `src/application/tree/TreeDecorator.ts` | 树标签扩展点 | 10 | 0 | 10 |
| `src/application/tree/TreeRenderer.ts` | Phase 1 基础树行与标签拼接 | 57 | 0 | 57 |
| `src/application/tree/TreeRow.ts` | 树标签与渲染 | 6 | 0 | 6 |
| `src/cli/CliApplication.ts` | CLI 输入输出 | 18 | 6 | 36 |
| `src/domain/factory/ShapeFactory.ts` | 内核源码 | 0 | 51 | 0 |
| `src/domain/shapes/CircleShape.ts` | 内置图形具体类：静态创建/读回与多态几何 | 23 | 6 | 24 |
| `src/domain/shapes/EllipseShape.ts` | 内置图形具体类：静态创建/读回与多态几何 | 25 | 6 | 26 |
| `src/domain/shapes/GroupShape.ts` | 内置图形具体类：静态创建/读回与多态几何 | 17 | 2 | 32 |
| `src/domain/shapes/LineShape.ts` | 内置图形具体类：静态创建/读回与多态几何 | 28 | 7 | 29 |
| `src/domain/shapes/RectShape.ts` | 内置图形具体类：静态创建/读回与多态几何 | 28 | 7 | 29 |
| `src/domain/shapes/Shape.ts` | 图形基类：kind/label/heading、几何与样式、SVG 编码 | 3 | 2 | 83 |
| `src/domain/shapes/ShapeCreationContext.ts` | 复合图形递归创建上下文 | 16 | 0 | 16 |
| `src/domain/shapes/ShapeProvider.ts` | 图形扩展点：容器能力、canUngroup、结构校验、data-kind | 22 | 0 | 22 |
| `src/domain/shapes/ShapeRegistration.ts` | 图形注册项静态契约 | 19 | 0 | 19 |
| `src/domain/shapes/ShapeSvgReadback.ts` | 内置图形共用的参数与 SVG 读回规则 | 57 | 0 | 57 |
| `src/domain/shapes/TextShape.ts` | 内置图形具体类：静态创建/读回与多态几何 | 21 | 3 | 34 |
| `src/domain/tree/DocumentView.ts` | 文档只读视图契约（root/findShape/requireInitialized） | 9 | 0 | 9 |
| `src/domain/tree/ShapeTopology.ts` | 结构校验的不可变最终拓扑视图 | 12 | 0 | 12 |
| `src/domain/tree/ShapeTree.ts` | 共享文档、id 索引、最终拓扑校验与结构提交 | 61 | 17 | 104 |
| `src/extension-api/index.ts` | 插件唯一公开导入入口（只做 re-export） | 42 | 0 | 42 |
| `src/infrastructure/svg/SvgXmlCodec.ts` | 基础设施适配器 | 6 | 5 | 98 |
| `src/infrastructure/svg/XmlParser.ts` | 基础设施适配器 | 12 | 0 | 12 |

## 装配（Assembly）

### 文件清单与职责

| 文件 | 职责 | 新增行 | 删除行 | 当前行数 |
|---|---|---:|---:|---:|
| `src/bootstrap/ApplicationBootstrap.ts` | 一次性装配四个 Registry 并启动 CLI | 43 | 10 | 61 |
| `src/bootstrap/builtinContributions.ts` | 内置 19 命令与六种图形的装配字典 | 177 | 0 | 177 |
| `src/bootstrap/codeAssembly.ts` | 方式 A 顶层代码装配入口（加载 stats/dir/box/tree-star） | 17 | 0 | 17 |
| `src/bootstrap/main.ts` | 进程入口与 --config 选择 | 4 | 1 | 6 |
| `src/bootstrap/PluginHost.ts` | 插件暂存、manifest 校验、重名与整包回滚 | 164 | 0 | 164 |
| `src/bootstrap/PluginLoader.ts` | 配置读取、模块解析与委托 Host 加载 | 153 | 0 | 153 |

## 插件（Plugin）

### 文件清单与职责

| 文件 | 职责 | 新增行 | 删除行 | 当前行数 |
|---|---|---:|---:|---:|
| `plugins/box/package.json` | 插件包 | 12 | 0 | 12 |
| `plugins/box/src/BoxAttributeHandler.ts` | box fill/label 领域语义 | 50 | 0 | 50 |
| `plugins/box/src/BoxShape.ts` | box 复合图形：模板、容器能力与结构校验 | 112 | 0 | 112 |
| `plugins/box/src/BoxTypeDecorator.ts` | box 树标签 (box) | 11 | 0 | 11 |
| `plugins/box/src/index.ts` | box 插件注册入口 | 23 | 0 | 23 |
| `plugins/dir/package.json` | 插件包 | 9 | 0 | 9 |
| `plugins/dir/src/DirCommand.ts` | dir 插件：目录排序与两空格格式化 | 32 | 0 | 32 |
| `plugins/dir/src/DirectoryReader.ts` | dir 目录访问 Target 接口 | 11 | 0 | 11 |
| `plugins/dir/src/index.ts` | dir 插件注册入口 | 25 | 0 | 25 |
| `plugins/dir/src/NodeDirectoryAdapter.ts` | Node 文件系统 Adapter | 25 | 0 | 25 |
| `plugins/stats/package.json` | 插件包 | 9 | 0 | 9 |
| `plugins/stats/src/index.ts` | stats 插件注册入口 | 24 | 0 | 24 |
| `plugins/stats/src/StatsCommand.ts` | stats 插件：只读容器/叶子统计 | 41 | 0 | 41 |
| `plugins/tree-star/package.json` | 插件包 | 12 | 0 | 12 |
| `plugins/tree-star/src/index.ts` | tree-star 插件注册入口 | 19 | 0 | 19 |
| `plugins/tree-star/src/ModifiedStarDecorator.ts` | modified-star 标签状态机 | 86 | 0 | 86 |

## 工具与配置（Tooling）

### 文件清单与职责

| 文件 | 职责 | 新增行 | 删除行 | 当前行数 |
|---|---|---:|---:|---:|
| `package.json` | 测试、metrics、构建脚本 | 16 | 2 | 37 |
| `plugins.config.json` | 方式 B 插件配置（stats/dir/box/tree-star） | 8 | 0 | 8 |
| `scripts/metrics.mjs` | 从 Git 历史生成 docs/metrics 报告 | 264 | 0 | 264 |
| `scripts/test-vscode.mjs` | 仓库脚本 | 38 | 0 | 38 |
| `tsconfig.json` | TypeScript 编译范围 | 1 | 1 | 13 |

## VSCode 扩展（单列，不计入 CLI 增量）

| 文件 | 职责 | 新增行 | 删除行 | 当前行数 |
|---|---|---:|---:|---:|
| `extensions/vscode-svg/build.mjs` | 配置/工具文件 | 15 | 0 | 15 |
| `extensions/vscode-svg/package.json` | 配置/工具文件 | 13 | 0 | 13 |
| `extensions/vscode-svg/README.md` | 配置/工具文件 | 59 | 0 | 59 |
| `extensions/vscode-svg/src/extension.ts` | 配置/工具文件 | 14 | 0 | 14 |
| `extensions/vscode-svg/src/SourceRangeIndex.ts` | 配置/工具文件 | 48 | 0 | 48 |
| `extensions/vscode-svg/src/SvgDocumentSymbolProvider.ts` | 配置/工具文件 | 12 | 0 | 12 |
| `extensions/vscode-svg/src/SvgFileDecorationProvider.ts` | 配置/工具文件 | 12 | 0 | 12 |
| `extensions/vscode-svg/src/SvgOutlineAdapter.ts` | 配置/工具文件 | 38 | 0 | 38 |
| `extensions/vscode-svg/tests/suite.ts` | 配置/工具文件 | 195 | 0 | 195 |
| `extensions/vscode-svg/tsconfig.json` | 配置/工具文件 | 9 | 0 | 9 |

## Git 历史

区间 `final..HEAD` 的提交标题（最新在前）：

- docs: finalize phase 2 report and metrics tooling
- feat: add modified-star decorator plugin
- test: define modified-star plugin contracts
- feat: add box shape plugin
- test: correct nested box label move expectation
- test: use unregistered type for unknown shape assertion
- test: move plugin tests under tests
- test: define box shape plugin contracts
- fix: keep metrics output under docs/metrics per specification
- chore: move metrics reports into doc and drop empty factory dirs
- feat: add stats and dir command plugins
- test: fix contradictory stats plugin assertions
- docs: exclude assembly files from kernel zero-diff check
- test: define stats and dir plugin contracts
- refactor: keep DocumentView and XML readback on domain contracts
- feat: make phase 2 extension framework executable
- test: fix tree row base and committed test typings
- test: give executor a document view for snapshots
- test: define phase 2 extensible framework contracts
- docs: define phase 2 extension contracts and adr standards
- feat: add new agents.md
- docs: document phase 2 VS Code deliverables and pattern analysis
- feat: add native SVG outline and Explorer file decorations
- test: define SVG extension behavior and preserve phase 1 contracts
- feat: add requirement file and rename phase1 readme with a distinct suffix

---

本文件由脚本生成；数字来自 Git 历史与当前工作树，不接受手工填写。
