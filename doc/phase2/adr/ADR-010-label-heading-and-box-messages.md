# ADR-010：命令 label 与树 heading 分离、box 文案

- Status: Accepted
- Date: 2026-11-09

## Context

Phase 1 的 `Shape.label` 同时用于命令反馈和结构树标题（`tag#id`）。Box 需求同时要求
命令名 `box#n1` 和基础树标题 `g#n1`；`create box`、`set box fill/label` 的文案也由
Phase 1 §6.1 固定。若继续用一个 `label`，必然有一侧不匹配。

## Decision

1. `Shape.label` 是命令显示名：`${kind}#${id}`；`Shape.describe().heading` 是树标题：
   `${tag}#${id}`。内置图形 `kind === tag`，输出不变；box 为 `box#n1` / `g#n1`。
2. 命令反馈、`show` 的标题、`parent=...` 使用 `label`；`tree` 的基础行使用
   `describe().heading`，`(box)` 由 `BoxTypeDecorator` 追加。
3. `create` 的通用消息在存在子节点时追加：
   ```text
   box#n1 created (g#n1 + rect#n1-rect + text#n1-label)
   ```
   第一项是 `describe().heading`，其余是子节点 `label`；空容器/叶子不追加。
4. `set` 的默认路径文案保持 Phase 1：`<label> updated: <attributeSummary>`；box handler
   固定输出：
   - `box#n2 fill propagated to n2-rect`
   - `box#n2 label updated: "处理数据 v2"`
   - undo label：`box#n2 label restored: "处理数据"`
5. `show <box>` 使用 `box#n1` 作为标题；`tree <box>` 使用 `g#n1` + `(box)`。
6. 任何新增文案必须由具体 handler/多态方法提供，不得在 receiver 中增加 box 分支。

## Consequences

- Phase 1 的 `tree`/`show`/命令反馈逐字节不变（内置 kind == tag）。
- box 的命令反馈与树标题可以同时正确。
- `create` 的通用子节点摘要对嵌套 box 会列出直接子节点；不追求固定深度。

## Alternatives

- 保留单一 `label`：box 命令名或树标题必有一处错误，拒绝。
- 在 receiver 中判断 box：违反新增插件不改 receiver，拒绝。
- 用 `data-kind` 决定命令名：命令反馈不应依赖序列化细节，拒绝。

## Verification

- `tests/acceptance/phase1-compatibility.test.ts`：Phase 1 输出不变。
- `plugins/box/tests/messages.test.ts`：create/move/set fill/label/undo 文案。
- `tests/application/tree/TreeRenderer.test.ts`：heading 与 `(box)` 拼接。
