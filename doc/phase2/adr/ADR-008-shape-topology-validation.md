# ADR-008：ShapeTopology 与结构校验时机

- Status: Accepted
- Date: 2026-11-09

## Context

Box 的 `validateStructure()` 必须拒绝“单独删除/移走必要子部件”，但允许整体删除 box。
`ShapeTree.editStructure()` 当前在真正 remove/insert 前只构造虚拟孩子表，shape 的
`children` 仍是旧值；直接查旧值无法判断最终结构。

## Decision

1. 增加拓扑只读接口：
   ```ts
   interface ShapeTopology {
     parentOf(shape: Shape): ShapeContainer | undefined;
     childrenOf(container: ShapeContainer): readonly Shape[];
     contains(shape: Shape): boolean;
   }
   ```
2. `ShapeTree.editStructure()` 在构建最终虚拟孩子表、完成 id/容器检查之后，构造不可变
   topology，对每个可达 shape 调用 `validateStructure(topology)`；全部通过后才真正
   remove/insert。校验失败不产生任何突变，命令失败、历史不变。
3. `validateStructure` 不递归：Box 只检查自己的直接 `${id}-rect`/`${id}-label`；
   嵌套 box 自己校验自己。整体删除 box 时 box 不可达，跳过。
4. Box 允许额外子节点；必要部件缺失、类型错误、被移到其他容器时拒绝；`front`/`back`
   重排不额外禁止。
5. `ShapeTree` 的容器判断统一用 `asContainer()`，包括虚拟遍历、目标容器检查和
   `getContainer()`。

## Consequences

- 结构编辑是原子的；失败不会留下半套树。
- Box 插件只依赖 `ShapeTopology`，不需要访问 `ShapeTree` 内部。
- `editStructure()` 需要额外构造 parent/children/reachable 映射；成本 O(n)，可接受。

## Alternatives

- 先 mutation 再校验/回滚：失败路径复杂且容易留下副作用，拒绝。
- 让 box 直接访问 `ShapeTree`：插件依赖内核实现，拒绝。
- 只查 `this.children`：无法识别子部件被移走，拒绝。

## Verification

- `tests/domain/ShapeTree.test.ts`：最终拓扑、整体删除、移走/删除必要部件、目标容器、
  失败无突变。
- `tests/plugins/box/structure.test.ts`：必要部件保护、嵌套、额外子节点。
- `tests/acceptance/*`：结构命令失败后历史与树不变。
