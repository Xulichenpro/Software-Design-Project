# ADR-002：ShapeProvider 继承 Shape、类对象注册与静态创建

- Status: Accepted
- Date: 2026-11-09

## Context

Phase 1 的六种图形直接继承 `Shape`；`ShapeFactory` 按类型名创建和读回。Phase 2 要求
`ShapeProvider` 成为图形类型扩展点，且不新增 `PluginShape`/`BoxShapeProvider` 等独立
Provider 类。需求要求插件以类或类的实例实现扩展点，内核只依赖接口。

## Decision

1. `ShapeProvider extends Shape`；六种内置图形与 `BoxShape` 都继承 `ShapeProvider`。
2. Registry 保存**具体类对象**（如 `RectShape`、`BoxShape`），不产生 Provider 实例。
3. 创建/读回是具体类上的静态方法：
   ```ts
   interface ShapeRegistration {
     readonly type: string;
     readonly prototype: ShapeProvider;
     createFromArguments(id, args, quoted, context): ShapeProvider;
     createFromSvgElement(element, context): ShapeProvider;
   }
   ```
   `ShapeRegistration` 只约束静态侧；不使用 `abstract static`。
4. `Shape` 增加通用身份/能力：
   - `kind` 默认等于 `tag`；`BoxShape.kind="box"`、`tag="g"`。
   - `label` 为命令显示名 `${kind}#${id}`；`describe().heading` 为树标题 `${tag}#${id}`。
   - `asContainer()` 默认 `undefined`；`canUngroup()` 默认 `true`；
     `validateStructure(topology)` 默认空实现。
5. 复合图形通过 `ShapeCreationContext` 创建/恢复子部件，不导入其他插件实现；分组通过
   Registry 的 `g` 创建，receiver 不直接 `new GroupShape()`。
6. 所有容器判断从 `instanceof GroupShape` 改为 `asContainer()`。

## Consequences

- 新增图形只新增一个具体类 + 一条 Registry 项，内核无需知道类型名。
- `Shape` 同时是领域对象和扩展点载体，避免“图形对象/Provider 对象”两套模型。
- `Shape.label` 与 `describe().heading` 必须分离；树/命令消息使用不同名字。
- `BoxShape` 不继承 `GroupShape`；它组合 `ChildCollection` 并自己实现容器遍历。
- `toSvgElement()` 在 `kind !== tag` 时追加 `data-kind`，读回由 Registry 统一选择。

## Alternatives

- 独立 `ShapeProvider` 对象再创建 `Shape`：两套模型、实例生命周期和注册表更复杂，拒绝。
- `PluginShape` 中间层：与需求命名不符，且不能替代静态创建入口，拒绝。
- 在 `ShapeFactory` 中查 Registry：保留工厂和类型名字分派，拒绝。

## Verification

- `tests/domain/shapes.test.ts`：六种内置图形、`kind`/`tag`/`label`、容器能力。
- `tests/infrastructure/svg.test.ts`：静态读回、data-kind、重复 id。
- `tests/acceptance/phase1-compatibility.test.ts`：Phase 1 树输出逐字节不变。
- 插件包独立测试：`BoxShape` 的静态创建/读回。
