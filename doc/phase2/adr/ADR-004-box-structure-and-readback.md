# ADR-004：Box 结构、模板、序列化与读回降级

- Status: Accepted
- Date: 2026-11-09

## Context

`box` 是 Phase 2 的复合图形插件：内部含一个矩形与一个文本，整体又是容器；支持 `in`、
整体 `move`、再嵌套；`ungroup` 拒绝；`set fill` 传播到内部 rect，`set label` 改写内部
text。Phase 1 §4.4/§6.1 定义语义；`data-kind="box"` 用于读回，未安装插件时降级为 `g`。

## Decision

1. `BoxShape extends ShapeProvider implements ShapeContainer`，组合 `ChildCollection`；
   `kind="box"`、`tag="g"`、`canUngroup()=false`、`asContainer()` 返回自身。
2. 必要部件 id 为 `<id>-rect`、`<id>-label`；`createFromArguments` 只创建这两个，
   `createFromSvgElement` 恢复全部子节点后检查这两个；`validateStructure` 只检查这两个，
   允许额外子节点（嵌套 box、`in`/`addto` 加入的图形）。
3. `move`/`scale` 遍历**所有**直接子节点并调用子节点的 `move`/`scale`；嵌套 box 通过
   多态递归；不得只处理 rect/text。
4. 模板固定：rect `x,y,w,h` 且默认 `fill=#4a90d9`；text 坐标 `(x+20, y+35)`，内容为
   标题；不设置 text 的 fill。`create box` 输出：
   ```text
   box#<id> created (g#<id> + rect#<id>-rect + text#<id>-label)
   ```
5. 序列化为 `<g id="<id>" data-kind="box">` + 实际子节点；g 上允许 `fill`/`stroke`/
   `stroke-width`，保证 `set <box> stroke` 的输出可读回。g 上的 `fill` 是 box 自身样式，
   不是 `set fill` 的 rect 传播语义。
6. 读回：先查 `data-kind`，无对应注册项才按 tag 降级；已选中 box 类但必要部件缺失/
   类型错误时拒绝整个 read；重复 id 一律拒绝整个 read；失败保持原文档。
7. `delete box` 允许整体删除；单独删除/移走必要部件由 `validateStructure` 拒绝；
   `ungroup box` 报 `cannot ungroup composite shape: <id>`。
8. `front`/`back` 允许重排必要部件，不额外禁止；box 仍保持两个必要部件在场。

## Consequences

- box 插件可独立测试；创建只依赖 `ShapeCreationContext`，不导入 rect/text 类。
- 读回降级为普通 `g` 后失去 `(box)` 与 `set label` 语义，但结构/图形保留。
- 序列化/读回必须保留 g 上的 style 属性，否则自身输出无法读回。
- `validateStructure` 无需递归；嵌套 box 各自校验。

## Alternatives

- 只移动 rect/text：嵌套 box 不会随外层移动，违反 §4.4，拒绝。
- 读回失败降级/警告：需求允许，但本阶段选择拒绝整个 read，避免生成不完整 box。
- 在 g 上禁止所有 style：`set <box> stroke` 的输出无法读回，拒绝。

## Verification

- `plugins/box/tests/*`：创建、tree、move、set fill/label、undo/redo、delete、嵌套、
  读回、降级、重复 id、结构拒绝。
- `tests/acceptance/*`：Phase 1 §6.1 box 会话完整复现。
- `tests/infrastructure/svg.test.ts`：data-kind 与 g style 往返。
