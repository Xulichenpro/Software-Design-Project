# Phase 2 指标报告（final → HEAD）

> 本报告由 `scripts/metrics.mjs` **从 Git 历史自动生成**（Generated from git history），请勿手工编辑。
> 标签：`p2`（仅作展示，不替代 Git 端点）。
> 源提交：`final` = `214098542dee81fec1ab0994e651f29b5ab939e6`；`HEAD` = `c8540309bd3f81505b3ede6edfa56cf326f4ea35`。
> 复现命令：`node scripts/metrics.mjs --from 214098542dee81fec1ab0994e651f29b5ab939e6 --to c8540309bd3f81505b3ede6edfa56cf326f4ea35 --label "p2"`；默认产物目录：`docs/metrics/`。可用 `--repo <仓库目录>` 和 `--output <产物目录>` 指定独立输入与输出。
> 范围：两个不可变 Git 提交的树、blob 与 `git diff --no-renames`；覆盖 `src/`、`plugins/`、`scripts/`、`package.json`、`tsconfig.json`、`tsconfig.build.json`、`plugins.config.json`；VSCode 扩展单列，不计入 CLI 增量。依赖目录、锁文件和 `dist/out/build` 构建产物均排除。
> 圈复杂度使用 TypeScript 7.0.2 编译器 AST：每个有实现体的函数、方法、构造器、getter/setter、箭头函数计基数 1；每个 if、for/for-in/for-of、while/do-while、非 default case、catch、三元表达式、&&/||/??（含对应逻辑赋值）再计 1。嵌套函数各计一次；顶层决策计入但模块不另加基数；类型、声明签名、可选属性/参数/链、字符串、注释和正则字面量均不产生决策点。
> 分类复杂度为两端完整源码树的总量（包含未修改文件）；下方复杂度文件明细和职责清单只列区间内变化文件。缺失端点的文件复杂度与行数为 0。所有数字均与当前 HEAD、暂存区和工作树内容无关。

## 概览

| 分类 | 文件数 | 新增行 | 删除行 |
|---|---:|---:|---:|
| 内核（Kernel） | 49 | 1076 | 277 |
| 装配（Assembly） | 6 | 562 | 11 |
| 插件（Plugin） | 16 | 528 | 0 |
| 工具与配置（Tooling） | 7 | 444 | 6 |
| VSCode 扩展（单列） | 10 | 415 | 0 |

## 圈复杂度增量（TypeScript AST）

| 分类 | final | HEAD | 增量 |
|---|---:|---:|---:|
| 内核（Kernel） | 497 | 594 | +97 |
| 装配（Assembly） | 2 | 152 | +150 |
| 插件（Plugin） | 0 | 138 | +138 |

### 文件明细

| 文件 | final | HEAD | 增量 |
|---|---:|---:|---:|
| `plugins/box/src/BoxAttributeHandler.ts` | 0 | 14 | +14 |
| `plugins/box/src/BoxShape.ts` | 0 | 44 | +44 |
| `plugins/box/src/BoxTypeDecorator.ts` | 0 | 2 | +2 |
| `plugins/box/src/index.ts` | 0 | 1 | +1 |
| `plugins/dir/src/DirCommand.ts` | 0 | 12 | +12 |
| `plugins/dir/src/DirectoryReader.ts` | 0 | 0 | +0 |
| `plugins/dir/src/index.ts` | 0 | 3 | +3 |
| `plugins/dir/src/NodeDirectoryAdapter.ts` | 0 | 5 | +5 |
| `plugins/stats/src/index.ts` | 0 | 3 | +3 |
| `plugins/stats/src/StatsCommand.ts` | 0 | 10 | +10 |
| `plugins/tree-star/src/index.ts` | 0 | 1 | +1 |
| `plugins/tree-star/src/ModifiedStarDecorator.ts` | 0 | 43 | +43 |
| `src/application/attributes/AttributeHandler.ts` | 0 | 0 | +0 |
| `src/application/attributes/AttributeOutcome.ts` | 0 | 0 | +0 |
| `src/application/attributes/AttributeService.ts` | 0 | 26 | +26 |
| `src/application/attributes/AttributeTransaction.ts` | 0 | 0 | +0 |
| `src/application/attributes/ReadonlyShape.ts` | 0 | 0 | +0 |
| `src/application/commands/base/BarrierCommand.ts` | 0 | 0 | +0 |
| `src/application/commands/base/HistoryControlCommand.ts` | 0 | 0 | +0 |
| `src/application/commands/base/PluginCommand.ts` | 0 | 0 | +0 |
| `src/application/commands/base/QueryCommand.ts` | 0 | 0 | +0 |
| `src/application/commands/base/UndoableCommand.ts` | 6 | 6 | +0 |
| `src/application/commands/editing/SetAttributeCommand.ts` | 3 | 3 | +0 |
| `src/application/contracts/AttributeEditParameters.ts` | 0 | 0 | +0 |
| `src/application/contracts/CommandRegistration.ts` | 0 | 0 | +0 |
| `src/application/contracts/CommandResult.ts` | 0 | 0 | +0 |
| `src/application/contracts/CommandServices.ts` | 0 | 0 | +0 |
| `src/application/contracts/DocumentEvent.ts` | 0 | 1 | +1 |
| `src/application/contracts/DocumentView.ts` | 0 | 0 | +0 |
| `src/application/execution/CommandExecutor.ts` | 12 | 21 | +9 |
| `src/application/execution/DocumentSnapshot.ts` | 0 | 7 | +7 |
| `src/application/factory/CommandFactory.ts` | 47 | 0 | -47 |
| `src/application/receivers/DocumentReceiver.ts` | 10 | 11 | +1 |
| `src/application/receivers/QueryReceiver.ts` | 13 | 8 | -5 |
| `src/application/receivers/ShapeEditorReceiver.ts` | 47 | 62 | +15 |
| `src/application/registries/AttributeHandlerRegistry.ts` | 0 | 8 | +8 |
| `src/application/registries/CommandRegistry.ts` | 0 | 8 | +8 |
| `src/application/registries/ShapeProviderRegistry.ts` | 0 | 16 | +16 |
| `src/application/registries/TreeDecoratorRegistry.ts` | 0 | 15 | +15 |
| `src/application/tree/TreeDecorator.ts` | 0 | 1 | +1 |
| `src/application/tree/TreeRenderer.ts` | 0 | 11 | +11 |
| `src/application/tree/TreeRow.ts` | 0 | 0 | +0 |
| `src/bootstrap/ApplicationBootstrap.ts` | 2 | 3 | +1 |
| `src/bootstrap/builtinContributions.ts` | 0 | 42 | +42 |
| `src/bootstrap/codeAssembly.ts` | 0 | 1 | +1 |
| `src/bootstrap/main.ts` | 0 | 1 | +1 |
| `src/bootstrap/PluginHost.ts` | 0 | 46 | +46 |
| `src/bootstrap/PluginLoader.ts` | 0 | 59 | +59 |
| `src/cli/CliApplication.ts` | 6 | 6 | +0 |
| `src/domain/factory/ShapeFactory.ts` | 31 | 0 | -31 |
| `src/domain/shapes/CircleShape.ts` | 4 | 8 | +4 |
| `src/domain/shapes/EllipseShape.ts` | 4 | 8 | +4 |
| `src/domain/shapes/GroupShape.ts` | 16 | 20 | +4 |
| `src/domain/shapes/LineShape.ts` | 5 | 9 | +4 |
| `src/domain/shapes/RectShape.ts` | 5 | 9 | +4 |
| `src/domain/shapes/Shape.ts` | 52 | 53 | +1 |
| `src/domain/shapes/ShapeCreationContext.ts` | 0 | 0 | +0 |
| `src/domain/shapes/ShapeProvider.ts` | 0 | 5 | +5 |
| `src/domain/shapes/ShapeRegistration.ts` | 0 | 0 | +0 |
| `src/domain/shapes/ShapeSvgReadback.ts` | 0 | 19 | +19 |
| `src/domain/shapes/TextShape.ts` | 13 | 20 | +7 |
| `src/domain/tree/DocumentView.ts` | 0 | 0 | +0 |
| `src/domain/tree/ShapeTopology.ts` | 0 | 0 | +0 |
| `src/domain/tree/ShapeTree.ts` | 42 | 50 | +8 |
| `src/extension-api/index.ts` | 0 | 0 | +0 |
| `src/infrastructure/svg/SvgXmlCodec.ts` | 53 | 52 | -1 |
| `src/infrastructure/svg/XmlParser.ts` | 0 | 3 | +3 |

## 内核（Kernel）

### 文件清单与职责

| 文件 | 职责 | 新增行 | 删除行 | final 行数 | HEAD 行数 |
|---|---|---:|---:|---:|---:|
| `src/application/attributes/AttributeHandler.ts` | 属性语义扩展点 | 15 | 0 | 0 | 15 |
| `src/application/attributes/AttributeOutcome.ts` | 属性扩展点与事务 | 4 | 0 | 0 | 4 |
| `src/application/attributes/AttributeService.ts` | 零/一/多命中分派、默认白名单、事务回滚 | 119 | 0 | 0 | 119 |
| `src/application/attributes/AttributeTransaction.ts` | 属性扩展点与事务 | 4 | 0 | 0 | 4 |
| `src/application/attributes/ReadonlyShape.ts` | 属性扩展点与事务 | 9 | 0 | 0 | 9 |
| `src/application/commands/base/BarrierCommand.ts` | 具体命令实现 | 3 | 2 | 2 | 3 |
| `src/application/commands/base/HistoryControlCommand.ts` | 具体命令实现 | 3 | 2 | 5 | 6 |
| `src/application/commands/base/PluginCommand.ts` | 具体命令实现 | 4 | 0 | 0 | 4 |
| `src/application/commands/base/QueryCommand.ts` | 具体命令实现 | 3 | 2 | 2 | 3 |
| `src/application/commands/base/UndoableCommand.ts` | 具体命令实现 | 2 | 2 | 22 | 22 |
| `src/application/commands/editing/SetAttributeCommand.ts` | 具体命令实现 | 6 | 6 | 11 | 11 |
| `src/application/contracts/AttributeEditParameters.ts` | 命令/文档/属性公开契约 | 19 | 1 | 1 | 19 |
| `src/application/contracts/CommandRegistration.ts` | 命令/文档/属性公开契约 | 14 | 0 | 0 | 14 |
| `src/application/contracts/CommandResult.ts` | 命令/文档/属性公开契约 | 7 | 1 | 1 | 7 |
| `src/application/contracts/CommandServices.ts` | 命令/文档/属性公开契约 | 6 | 0 | 0 | 6 |
| `src/application/contracts/DocumentEvent.ts` | 命令/文档/属性公开契约 | 33 | 0 | 0 | 33 |
| `src/application/contracts/DocumentView.ts` | 命令/文档/属性公开契约 | 1 | 0 | 0 | 1 |
| `src/application/execution/CommandExecutor.ts` | 历史双栈与 edited/history/barrier 事件通知 | 40 | 3 | 45 | 82 |
| `src/application/execution/DocumentSnapshot.ts` | 不可变前后文档快照 | 33 | 0 | 0 | 33 |
| `src/application/factory/CommandFactory.ts` | 内核源码 | 0 | 103 | 103 | 0 |
| `src/application/receivers/DocumentReceiver.ts` | 命令 receiver | 20 | 4 | 26 | 42 |
| `src/application/receivers/QueryReceiver.ts` | 命令 receiver | 10 | 22 | 31 | 19 |
| `src/application/receivers/ShapeEditorReceiver.ts` | 命令 receiver | 59 | 18 | 108 | 149 |
| `src/application/registries/AttributeHandlerRegistry.ts` | 属性处理器注册表 | 29 | 0 | 0 | 29 |
| `src/application/registries/CommandRegistry.ts` | 命令注册表与 unknown command 文案 | 29 | 0 | 0 | 29 |
| `src/application/registries/ShapeProviderRegistry.ts` | 图形类对象注册表与 data-kind 读回选择 | 60 | 0 | 0 | 60 |
| `src/application/registries/TreeDecoratorRegistry.ts` | 树标签注册表、Observer 转发与异常隔离 | 55 | 0 | 0 | 55 |
| `src/application/tree/TreeDecorator.ts` | 树标签扩展点 | 10 | 0 | 0 | 10 |
| `src/application/tree/TreeRenderer.ts` | Phase 1 基础树行与标签拼接 | 57 | 0 | 0 | 57 |
| `src/application/tree/TreeRow.ts` | 树标签与渲染 | 6 | 0 | 0 | 6 |
| `src/cli/CliApplication.ts` | CLI 输入输出 | 15 | 5 | 24 | 34 |
| `src/domain/factory/ShapeFactory.ts` | 内核源码 | 0 | 51 | 51 | 0 |
| `src/domain/shapes/CircleShape.ts` | 内置图形具体类：静态创建/读回与多态几何 | 23 | 6 | 7 | 24 |
| `src/domain/shapes/EllipseShape.ts` | 内置图形具体类：静态创建/读回与多态几何 | 25 | 6 | 7 | 26 |
| `src/domain/shapes/GroupShape.ts` | 内置图形具体类：静态创建/读回与多态几何 | 17 | 2 | 17 | 32 |
| `src/domain/shapes/LineShape.ts` | 内置图形具体类：静态创建/读回与多态几何 | 28 | 7 | 8 | 29 |
| `src/domain/shapes/RectShape.ts` | 内置图形具体类：静态创建/读回与多态几何 | 28 | 7 | 8 | 29 |
| `src/domain/shapes/Shape.ts` | 图形基类：kind/label/heading、几何与样式、SVG 编码 | 3 | 2 | 82 | 83 |
| `src/domain/shapes/ShapeCreationContext.ts` | 复合图形递归创建上下文 | 16 | 0 | 0 | 16 |
| `src/domain/shapes/ShapeProvider.ts` | 图形扩展点：容器能力、canUngroup、结构校验、data-kind | 22 | 0 | 0 | 22 |
| `src/domain/shapes/ShapeRegistration.ts` | 图形注册项静态契约 | 19 | 0 | 0 | 19 |
| `src/domain/shapes/ShapeSvgReadback.ts` | 内置图形共用的参数与 SVG 读回规则 | 57 | 0 | 0 | 57 |
| `src/domain/shapes/TextShape.ts` | 内置图形具体类：静态创建/读回与多态几何 | 21 | 3 | 16 | 34 |
| `src/domain/tree/DocumentView.ts` | 文档只读视图契约（root/findShape/requireInitialized） | 9 | 0 | 0 | 9 |
| `src/domain/tree/ShapeTopology.ts` | 结构校验的不可变最终拓扑视图 | 12 | 0 | 0 | 12 |
| `src/domain/tree/ShapeTree.ts` | 共享文档、id 索引、最终拓扑校验与结构提交 | 61 | 17 | 60 | 104 |
| `src/extension-api/index.ts` | 插件唯一公开导入入口（只做 re-export） | 42 | 0 | 0 | 42 |
| `src/infrastructure/svg/SvgXmlCodec.ts` | 基础设施适配器 | 6 | 5 | 97 | 98 |
| `src/infrastructure/svg/XmlParser.ts` | 基础设施适配器 | 12 | 0 | 0 | 12 |

## 装配（Assembly）

### 文件清单与职责

| 文件 | 职责 | 新增行 | 删除行 | final 行数 | HEAD 行数 |
|---|---|---:|---:|---:|---:|
| `src/bootstrap/ApplicationBootstrap.ts` | 一次性装配四个 Registry 并启动 CLI | 44 | 10 | 28 | 62 |
| `src/bootstrap/builtinContributions.ts` | 内置 19 命令与六种图形的装配字典 | 177 | 0 | 0 | 177 |
| `src/bootstrap/codeAssembly.ts` | 方式 A 顶层代码装配入口（加载 stats/dir/box/tree-star） | 17 | 0 | 0 | 17 |
| `src/bootstrap/main.ts` | 进程入口与 --config 选择 | 4 | 1 | 3 | 6 |
| `src/bootstrap/PluginHost.ts` | 插件暂存、manifest 校验、重名与整包回滚 | 169 | 0 | 0 | 169 |
| `src/bootstrap/PluginLoader.ts` | 配置读取、模块解析与委托 Host 加载 | 151 | 0 | 0 | 151 |

## 插件（Plugin）

### 文件清单与职责

| 文件 | 职责 | 新增行 | 删除行 | final 行数 | HEAD 行数 |
|---|---|---:|---:|---:|---:|
| `plugins/box/package.json` | 插件包 | 12 | 0 | 0 | 12 |
| `plugins/box/src/BoxAttributeHandler.ts` | box fill/label 领域语义 | 50 | 0 | 0 | 50 |
| `plugins/box/src/BoxShape.ts` | box 复合图形：模板、容器能力与结构校验 | 113 | 0 | 0 | 113 |
| `plugins/box/src/BoxTypeDecorator.ts` | box 树标签 (box) | 11 | 0 | 0 | 11 |
| `plugins/box/src/index.ts` | box 插件注册入口 | 23 | 0 | 0 | 23 |
| `plugins/dir/package.json` | 插件包 | 9 | 0 | 0 | 9 |
| `plugins/dir/src/DirCommand.ts` | dir 插件：目录排序与两空格格式化 | 32 | 0 | 0 | 32 |
| `plugins/dir/src/DirectoryReader.ts` | dir 目录访问 Target 接口 | 11 | 0 | 0 | 11 |
| `plugins/dir/src/index.ts` | dir 插件注册入口 | 25 | 0 | 0 | 25 |
| `plugins/dir/src/NodeDirectoryAdapter.ts` | Node 文件系统 Adapter | 25 | 0 | 0 | 25 |
| `plugins/stats/package.json` | 插件包 | 9 | 0 | 0 | 9 |
| `plugins/stats/src/index.ts` | stats 插件注册入口 | 24 | 0 | 0 | 24 |
| `plugins/stats/src/StatsCommand.ts` | stats 插件：只读容器/叶子统计 | 41 | 0 | 0 | 41 |
| `plugins/tree-star/package.json` | 插件包 | 12 | 0 | 0 | 12 |
| `plugins/tree-star/src/index.ts` | tree-star 插件注册入口 | 19 | 0 | 0 | 19 |
| `plugins/tree-star/src/ModifiedStarDecorator.ts` | modified-star 标签状态机 | 112 | 0 | 0 | 112 |

## 工具与配置（Tooling）

### 文件清单与职责

| 文件 | 职责 | 新增行 | 删除行 | final 行数 | HEAD 行数 |
|---|---|---:|---:|---:|---:|
| `package.json` | 测试、metrics、构建脚本 | 16 | 2 | 23 | 37 |
| `plugins.config.json` | 方式 B 插件配置（stats/dir/box/tree-star） | 8 | 0 | 0 | 8 |
| `scripts/metrics.mjs` | 从 Git 历史生成 docs/metrics 报告 | 345 | 0 | 0 | 345 |
| `scripts/record-transcripts.mjs` | 仓库脚本 | 33 | 0 | 0 | 33 |
| `scripts/test-vscode.mjs` | 仓库脚本 | 38 | 0 | 0 | 38 |
| `tsconfig.build.json` | TypeScript 发布构建范围（排除测试） | 3 | 3 | 9 | 9 |
| `tsconfig.json` | TypeScript 编译范围 | 1 | 1 | 13 | 13 |

## VSCode 扩展（单列，不计入 CLI 增量）

| 文件 | 职责 | 新增行 | 删除行 | final 行数 | HEAD 行数 |
|---|---|---:|---:|---:|---:|
| `extensions/vscode-svg/build.mjs` | VSCode 扩展与独立构建/测试配置 | 15 | 0 | 0 | 15 |
| `extensions/vscode-svg/package.json` | VSCode 扩展与独立构建/测试配置 | 13 | 0 | 0 | 13 |
| `extensions/vscode-svg/README.md` | VSCode 扩展与独立构建/测试配置 | 59 | 0 | 0 | 59 |
| `extensions/vscode-svg/src/extension.ts` | VSCode 扩展与独立构建/测试配置 | 14 | 0 | 0 | 14 |
| `extensions/vscode-svg/src/SourceRangeIndex.ts` | VSCode 扩展与独立构建/测试配置 | 48 | 0 | 0 | 48 |
| `extensions/vscode-svg/src/SvgDocumentSymbolProvider.ts` | VSCode 扩展与独立构建/测试配置 | 12 | 0 | 0 | 12 |
| `extensions/vscode-svg/src/SvgFileDecorationProvider.ts` | VSCode 扩展与独立构建/测试配置 | 12 | 0 | 0 | 12 |
| `extensions/vscode-svg/src/SvgOutlineAdapter.ts` | VSCode 扩展与独立构建/测试配置 | 38 | 0 | 0 | 38 |
| `extensions/vscode-svg/tests/suite.ts` | VSCode 扩展与独立构建/测试配置 | 195 | 0 | 0 | 195 |
| `extensions/vscode-svg/tsconfig.json` | VSCode 扩展与独立构建/测试配置 | 9 | 0 | 0 | 9 |

## Git 历史

区间 `final..HEAD` 的提交标题（最新在前）：

- fix: restore sequential CLI prompts and record actual replay baselines
- fix: derive historical metrics from git blobs and TypeScript AST
- fix: preserve atomic edits and observe root shape reordering
- fix: isolate config assembly and validate plugin loading inputs
- test: cover phase 2 acceptance regressions and real transcript baselines
- Merge branch 'codex/vscode-svg' into master
- docs: add final phase 2 metrics with complexity delta
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
- Merge pull request #1 from Xulichenpro/codex/vscode-svg
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

本文件由脚本生成；源码、文件清单、行数、复杂度及提交历史均来自上方明确记录的两个 Git 提交，不接受手工填写。
