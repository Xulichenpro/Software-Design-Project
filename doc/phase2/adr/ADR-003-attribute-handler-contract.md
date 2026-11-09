# ADR-003：AttributeHandler 事务、选择规则与输出契约

- Status: Accepted
- Date: 2026-11-09

## Context

Phase 1 的 `set` 在 `CommandFactory` 中预校验数值/引号，`ShapeEditorReceiver.setAttribute`
直接读写单个属性。Phase 2 要求 `AttributeHandler` 扩展属性语义（box 的 fill/label），
新增 handler 不改 command/receiver；一次 set 必须是一个 undo 单元；部分失败必须回滚。

## Decision

1. 处理器接口：
   ```ts
   abstract class AttributeHandler {
     abstract readonly name: string;
     abstract handles(target: ReadonlyShape, attr: string): boolean;
     abstract apply(
       target: ReadonlyShape,
       request: AttributeEditRequest,
       transaction: AttributeTransaction,
     ): AttributeOutcome;
   }
   interface AttributeOutcome {
     readonly forwardLines: readonly string[];
     readonly inverseLines: readonly string[];
   }
   interface AttributeTransaction {
     setAttribute(shapeId: string, name: string, value: string | undefined): void;
   }
   ```
2. 选择规则：0 命中走 Phase 1 默认白名单；1 命中执行 handler；多个命中抛冲突错误，
   不执行任何写入。handler 抛错时反序回滚事务，不 fallback 到默认处理。
3. 事务每次写入前读取旧值，底层单属性 setter 必须原子；成功后生成一份
   `AttributeEditRecord`，forward/inverse 都是 `AttributePatch`：
   ```ts
   interface AttributeWrite { shapeId: string; name: string; value?: string; }
   interface AttributePatch { writes: readonly AttributeWrite[]; lines: readonly string[]; }
   ```
4. 首次请求执行返回 `EditOutcome<AttributeEditRecord>`；undo/redo 通过原 receiver 重放
   patch，返回 patch 的 `lines`，不重新选择/执行 handler。
5. 默认路径生成 Phase 1 文案：`<label> updated: <attributeSummary>`。默认路径的
   数值、非负、`text` 引号校验由 `AttributeService` 执行，`set` 注册项不再预校验。
6. box handler 的固定文案：
   - `box#<id> fill propagated to <id>-rect`
   - `box#<id> label updated: "<value>"`
   - `box#<id> label restored: "<before>"`

## Consequences

- `SetAttributeCommand`、`ShapeEditorReceiver` 在框架阶段只改一次，之后新增 handler
  不再改它们。
- `AttributeEditParameters` 分成首次请求与 patch 重放两种形态；命令泛型仍用 patch。
- 默认路径与 handler 路径共享事务/记录结构，但选择逻辑只在 `AttributeService` 一处。
- 多个 handler 命中是显式错误，不做优先级/组合，避免未定义覆盖。

## Alternatives

- handler 直接 `shape.setAttribute`：无法统一回滚/记录，拒绝。
- 多命中按优先级：需求允许但引入顺序契约，本阶段选择拒绝，ADR 记录。
- handler 返回 void，receiver 拼消息：无法产生 box 的 `propagated`/`restored` 文案，拒绝。

## Verification

- `tests/application/attributes/AttributeService.test.ts`：0/1/多命中、默认路径、回滚、
  单记录、正反重放。
- `tests/application/commands/commands.test.ts`：`set` 的 Phase 1 文案与 undo/redo。
- box 插件测试：fill/label 正反文案、部分失败回滚。
