# Phase 2 执行计划与验证

本文件把 [extension-contracts.md](extension-contracts.md) 与 ADR 落实为 5 个过程节点。
每个节点先由测试 agent 写测试并提交，再由执行 agent 写实现并提交；测试失败补 fix commit。

## 通用规则

- 测试先红：测试必须能在当前实现上失败（缺文件/缺行为），不得为现状写“永远通过”的测试。
- 测试断言公开行为，不照实现复写；IO 用替身，临时目录用后清理。
- 每阶段完成前运行：`npm run test:phase1`、相关插件测试、`npm run typecheck`、
  `npm run build`。未运行不得宣称通过。
- 插件阶段（2-4）完成后额外运行零内核差异检查；装配层变化不计入判据。
- 每个测试提交、代码提交分开；fix commit 只修当前阶段。

## 节点 0：接口文档与 ADR 标准（本文件所在提交）

交付：`doc/phase2/extension-contracts.md`、`doc/phase2/adr/*`。
验收：接口签名、错误文案、输出样例、A/B 与零差异判据可执行；后续测试/实现按此为准。

## 节点 1：框架可扩展

### 目标

四个扩展点就位；内核不按名字枚举；Phase 1 全部命令回归；`metrics` 首次产出。

### 测试范围（先写）

- `tests/domain/shapes.test.ts`：六种内置类 `type`/`kind`/`tag`/`label`/heading；
  `asContainer`/`canUngroup`/`validateStructure` 默认行为。
- `tests/domain/ShapeTree.test.ts`：`asContainer` 容器判断、最终拓扑、结构校验失败无突变、
  id 索引含子节点。
- `tests/application/registries/*.test.ts`：四个 Registry 的 get/values/install once/
  未命中错误/不暴露可变 Map。
- `tests/application/attributes/AttributeService.test.ts`：0/1/多命中、默认白名单、
  一次 set 一份记录、正反 patch、部分失败回滚、未知属性/数值/引号文案。
- `tests/application/tree/TreeRenderer.test.ts`：基础行、无标签基线、标签顺序/空格、
  `tree <id>`、根行。
- `tests/application/execution/CommandExecutor.test.ts`：四类命令、历史双栈、observer
  事件、失败不通知、查询不采集快照、observer 异常隔离。
- `tests/cli/CliApplication.test.ts`：Registry 查表、unknown command、注册项实例化、
  `CommandServices`。
- `tests/infrastructure/svg.test.ts`：Registry 读回、data-kind 选择、重复 id、Phase 1
  编码/解码回归。
- `tests/acceptance/bootstrap.test.ts` / `phase1-compatibility.test.ts`：Phase 1 会话
  逐字节回归；内置装配；失败历史语义。
- `tests/plugin/PluginHost.test.ts` / `PluginLoader.test.ts`：见节点 1 的 Host/Loader
  最小契约（四条失败可先用 fixture 覆盖，完整失败矩阵在节点 2 前补）。
- `tests/metrics/metrics.test.ts`：metrics 脚本可执行、输出分类/标记格式。

### 实现范围

- 新增 `ShapeProvider`、`ShapeRegistration`、`ShapeCreationContext`、`ShapeTopology`；
  六种内置类改静态创建/读回；`Shape` 增加 `kind`/`label`/heading 分离。
- 新增四 Registry；删除 `CommandFactory`、`ShapeFactory`；新增 `PluginCommand` 层级、
  `CommandRegistration`、`CommandServices`。
- 新增 `AttributeHandler`/`AttributeService`/`AttributeTransaction`/`AttributeOutcome`/
  `ReadonlyShape`；`SetAttributeCommand`/`ShapeEditorReceiver` 接入。
- 新增 `DocumentEvent`/`DocumentObserver`/`TreeDecorator`/`TreeDecoratorRegistry`/
  `TreeRenderer`；`QueryReceiver` 接入；`CommandExecutor` 采集/通知。
- `SvgXmlCodec` 查 `ShapeProviderRegistry`；`ShapeTree` 用 `asContainer`/topology。
- 新增 `PluginHost`/`PluginLoader`/`PluginContext`/`CommandServices`；
  `ApplicationBootstrap` 装配；`codeAssembly.ts` 空实现；`plugins.config.json` 空配置；
  `main.ts` 支持 `--config`。
- `src/extension-api/index.ts` 公开入口；tsconfig include `plugins/**/*.ts`。
- `scripts/metrics.mjs` + `doc/metrics/` 首次产出；`package.json` 增加
  `test:plugin`/`test:all`/`metrics` 等脚本（不改变 Phase 1 语义）。

### 完成判据

- `npm run test:phase1` 通过；`npm run typecheck`、`npm run build` 通过。
- `npm test`（Phase 1 + plugin unit）通过；VSCode host 测试不在每阶段强制，收尾前运行。
- `metrics` 首次产出；脚本从 git 历史生成，非手填。
- `rg -n "switch|CommandFactory|ShapeFactory|instanceof GroupShape" src` 无内核按名字
  枚举/旧工厂残留（加载器/命令注册项内部参数规则除外）。

## 节点 2：stats 与 dir 命令插件

### 目标

stats、dir 以独立插件包接入；目录访问适配器与独立测试完成；A/B 均可装入。

### 测试范围（先写）

- `plugins/stats/tests/*`：空文档、叶子顺序、容器计数、box 容器（用 g 替身或节点 3
  后补 box 用例）、未 init 错误、help、只读/历史不变。
- `plugins/dir/tests/*`：混合文件/目录、空目录、隐藏项、排序稳定性、读取失败、
  符号链接/特殊项、无文档可用、有文档成功/失败不改历史。
- `tests/plugin/fixtures/*`：用于 loader 成功/失败/重复/回滚/disabled/options 的
  测试插件；或复用 stats/dir 包。
- `tests/acceptance/commands-plugins.test.ts`：stats/dir 在 CLI 中的输出；禁用时
  `unknown command`；help 出现。
- `tests/acceptance/ab-consistency.test.ts`：同一会话 A/B 输出一致（stats/dir）。
- 零内核差异脚本/检查：`scripts/verify-zero-diff.mjs` 或文档命令 + 测试。

### 实现范围

- `plugins/stats`：`StatsCommand`、`package.json`（contributes.commands=["stats"]）、
  `activate`。`StatsCommand` 通过 `CommandServices.document` 只读 DFS。
- `plugins/dir`：`DirectoryReader`、`NodeDirectoryAdapter`、`DirCommand`、`package.json`
  （contributes.commands=["dir"]）、`activate`。输出按 ADR-009 两个空格。
- 装配：`codeAssembly.ts` 加载 stats/dir；`plugins.config.json` 同步；A/B 输出一致。
- 插件独立测试脚本：`package.json` 的 `test:plugin` 纳入 `plugins/*/tests`。

### 完成判据

- stats/dir 独立测试全绿；CLI 验收/AB 一致；禁用时 unknown command。
- 排除新插件包后 `src/` 与既有 `plugins/` diff 为空。
- `dir` 输出按“标记后两个空格”；`stats` 计数含 box（节点 3 后补 box 用例）。

## 节点 3：box 接入

### 目标

box 插件接入；A/B 两种装配各演示一次；box 会话完整复现。

### 测试范围（先写）

- `plugins/box/tests/create.test.ts`：模板坐标/默认 fill/子部件 id/消息/`in`/嵌套。
- `plugins/box/tests/operations.test.ts`：move/scale（含嵌套）、delete、group、ungroup
  拒绝、set fill/label、undo/redo、多部件一个记录。
- `plugins/box/tests/structure.test.ts`：必要部件删除/移走拒绝、整体删除允许、额外
  子节点允许、嵌套 box、重排。
- `plugins/box/tests/readback.test.ts`：data-kind 往返、未装插件降级、缺件/类型错误
  拒绝整个 read、重复 id 拒绝、g style 往返。
- `plugins/box/tests/messages.test.ts`：create/move/set/undo 文案。
- `tests/acceptance/box.test.ts`：Phase 1 §6.1 版本 B 会话逐字节复现。
- `tests/acceptance/ab-consistency.test.ts` 扩展 box 会话。
- 零内核差异检查。

### 实现范围

- `plugins/box`：`BoxShape`（ShapeProvider + ShapeContainer + ChildCollection）、
  `BoxAttributeHandler`、`BoxTypeDecorator`、`package.json`、`activate`。
- `codeAssembly.ts`/`plugins.config.json` 增加 box；A/B 顺序一致。
- 如框架缺少 hook，只允许在节点 1 的通用接口内补，不允许 box 专用内核分支。

### 完成判据

- box 独立测试全绿；Phase 1 §6.1 box 会话逐字节；A/B 一致；零内核差异。
- `create box`/`set` 文案与 ADR-010 一致；读回降级/拒绝与 ADR-004 一致。

## 节点 4：标签完成

### 目标

`modified-star` 与 `(box)` 并存；两个标签互不感知；内核/渲染器零差异。

### 测试范围（先写）

- `plugins/tree-star/tests/state.test.ts`：编辑→保存→再编辑→undo 各分支、新建、删除、
  祖先/根、save/read 失败保留、init/resize。
- `plugins/box/tests/decorator.test.ts`：`(box)` 只按 kind；与 `*` 并存两种顺序。
- `tests/application/tree/TreeRenderer.test.ts`：无标签基线、两个标签顺序/空格。
- `tests/acceptance/tags.test.ts`：CLI 中两标签并存；禁用时基线不变。
- A/B 一致性与零内核差异。

### 实现范围

- `plugins/tree-star`：`ModifiedStarDecorator`、`package.json`、`activate`。
- box 插件已含 `BoxTypeDecorator`；确认注册顺序与 A/B 一致。
- 装配增加 tree-star；A/B 同步。

### 完成判据

- 两标签并存测试全绿；Phase 1 `tree` 基线在禁用标签时逐字节不变；A/B 一致；
  零内核差异。

## 节点 5：收尾

### 目标

迭代报告、Phase 1 → Phase 2 架构对比图、最终 metrics、tag `p2`。

### 交付

- `doc/README.md` 更新：扩展点清单（接口名/职责/内核调用位置/现有实现/禁用行为/
  违反契约报错）、A/B 说明、PlantUML 模块依赖图、ADR 链接、dir 适配器说明、
  VSCode A.3（已有）。
- `doc/metrics/`：文件清单/职责、按内核/装配/插件三类行数、圈复杂度增量（final→p2）；
  脚本随仓库提交，数字由脚本生成。
- 架构对比图（Phase 1 → Phase 2）；迭代报告。
- 最终全量测试：Phase 1、插件单元、VSCode host、typecheck、build、A/B/基线/零差异。
- 打 tag `p2`；不移动已有 tag。

### 完成判据

- 所有验收清单项有对应证据；metrics 由脚本生成；tag `p2` 在最终提交处。
- 工作区干净；无未验证的“通过”声明。
