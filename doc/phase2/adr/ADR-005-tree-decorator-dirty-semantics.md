# ADR-005：TreeDecorator、dirty 语义与标签顺序

- Status: Accepted
- Date: 2026-11-09

## Context

Phase 2 要求 `modified-star` 与 `(box)` 两个标签并存且互不感知；标签状态封装在标签
实例内；新增标签不得修改内核/渲染器。需求允许 dirty 两种语义，本阶段必须选定并记录
祖先传播与拼接顺序。

## Decision

1. `TreeDecorator` 抽象类：
   ```ts
   abstract class TreeDecorator {
     abstract readonly name: string;
     onCommitted(_event: DocumentEvent): void {}
     abstract decorate(row: TreeRow, document: DocumentView): string | undefined;
   }
   ```
   `TreeDecoratorRegistry` 实现 `DocumentObserver`，按注册顺序转发；单个 decorator
   抛错被隔离，不破坏已提交状态。
2. dirty 语义采用“自上次保存以来发生过编辑命令”：
   - 新建节点立即标星，并向旧/新祖先及根传播；
   - 修改子节点，节点及全部祖先、根标星；
   - undo/redo 不消星；
   - save/read 成功清空；失败保留；
   - init 清空旧 ids 并标根；resize 标根；
   - 删除只显示存活行的标签，删除的 id 可保留在集合中。
3. 状态是 `ModifiedStarDecorator` 实例私有字段 `dirtyIds`、`rootDirty`；不进入
   `ShapeTree`、`DocumentReceiver` 或 `EditRecord`。
4. `DocumentEvent` 携带不可变前后快照（自身内容、父节点、有序孩子）；编辑命令由执行器
   采集前后快照，查询不采集。save/read/init/resize 由结果显式携带事件种类。
5. 标签按加载/注册顺序拼接；每个非空后缀前加一个空格；无标签时不追加任何字符。
   `TreeRow.base` 是**完整的基础输出行**（含树连接前缀，不含标签），渲染器在它后面追加
   标签。`BoxTypeDecorator` 只按 `kind === "box"` 返回 `(box)`，不感知星号。
6. 同一行两个标签的顺序由插件加载顺序决定，A/B 配置必须一致。

## Consequences

- 不需要为每条命令备份 dirty ids；undo 回到保存点仍保留星号。
- 若未来改为“内容与保存点不一致”，需要 baseline/内容比较与浮点容差，属于新 ADR。
- 容器整体 move/scale 时，子节点内容变化会按快照 diff 标星；是否只标容器由后续 ADR
  决定，本阶段按快照 diff 执行。
- 观察者异常被吞掉/隔离，命令结果不受影响。

## Alternatives

- dirty 放 ShapeTree/DocumentReceiver：把 UI 标签策略扩散到领域与所有命令，拒绝。
- 内容差异语义：需求允许，但需要 baseline 与浮点容差，本阶段不选。
- 模块级 dirty 变量：无法多实例/独立测试，拒绝。

## Verification

- `tests/plugins/tree-star/*`：编辑→保存→再编辑→undo 各分支、祖先/根、新建、删除、
  save/read 失败保留。
- `tests/application/tree/TreeRenderer.test.ts`：无标签基线逐字节不变、顺序拼接。
- `tests/acceptance/*`：Phase 1 `tree` 输出在禁用标签时逐字节不变。
