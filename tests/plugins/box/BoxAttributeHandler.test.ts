import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AttributeHandler } from '../../../src/application/attributes/AttributeHandler.js';
import type { AttributeOutcome } from '../../../src/application/attributes/AttributeOutcome.js';
import type { AttributeTransaction } from '../../../src/application/attributes/AttributeTransaction.js';
import type { ReadonlyShape } from '../../../src/application/attributes/ReadonlyShape.js';
import type { AttributeEditRequest } from '../../../src/application/contracts/AttributeEditParameters.js';
import { AttributeEditRecord } from '../../../src/application/records/AttributeEditRecord.js';
import { SetAttributeCommand } from '../../../src/application/commands/editing/SetAttributeCommand.js';
import { UndoCommand } from '../../../src/application/commands/history/UndoCommand.js';
import { RedoCommand } from '../../../src/application/commands/history/RedoCommand.js';
import { BoxAttributeHandler } from '../../../plugins/box/src/BoxAttributeHandler.js';
import {
  RecordingObserver, addBox, createBoxEnvironment, createExecutor,
} from './fixtures.js';

class SpyBoxHandler extends BoxAttributeHandler {
  handlesCalls = 0;
  failSelection = false;
  override handles(target: ReadonlyShape, attr: string): boolean {
    this.handlesCalls += 1;
    if (this.failSelection) throw new Error('handles must not run during patch replay');
    return super.handles(target, attr);
  }
}

class ExplodingBoxHandler extends AttributeHandler {
  readonly name = 'exploding-box';
  handles(_target: ReadonlyShape, attr: string): boolean { return attr === 'stroke-width'; }
  apply(target: ReadonlyShape, _request: AttributeEditRequest, transaction: AttributeTransaction): AttributeOutcome {
    transaction.setAttribute(`${target.id}-rect`, 'fill', '#ff0000');
    transaction.setAttribute(`${target.id}-label`, 'text', 'broken');
    throw new Error('box handler exploded after partial writes');
  }
}

test('box-attributes handles fill and label only for kind box', () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  environment.editor.create('g', 'g1', []);
  const box = environment.tree.findShape('n1');
  const rect = environment.tree.findShape('n1-rect');
  const group = environment.tree.findShape('g1');
  const handler = environment.handler as BoxAttributeHandler;

  assert.equal(handler.name, 'box-attributes');
  assert.equal(handler.handles(box, 'fill'), true);
  assert.equal(handler.handles(box, 'label'), true);
  for (const attr of ['stroke', 'stroke-width', 'text', 'x', 'width', 'unknown']) {
    assert.equal(handler.handles(box, attr), false, `box must not handle ${attr}`);
  }
  for (const attr of ['fill', 'label']) {
    assert.equal(handler.handles(rect, attr), false, `rect must not match ${attr}`);
    assert.equal(handler.handles(group, attr), false, `g must not match ${attr}`);
  }
});

test('set fill propagates to the internal rect and one record restores and replays it', () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  const box = environment.tree.findShape('n1');
  const rect = environment.tree.findShape('n1-rect');

  const outcome = environment.editor.setAttribute({ id: 'n1', name: 'fill', value: '#f5a623', quoted: false });
  assert.ok(outcome.record instanceof AttributeEditRecord);
  assert.deepEqual(outcome.result.lines, ['box#n1 fill propagated to n1-rect']);
  assert.equal(rect.getAttribute('fill'), '#f5a623');
  assert.equal(box.getAttribute('fill'), undefined, 'fill propagation must not write the g style');
  assert.deepEqual(outcome.record.forward.writes, [{ shapeId: 'n1-rect', name: 'fill', value: '#f5a623' }]);
  assert.deepEqual(outcome.record.forward.lines, ['box#n1 fill propagated to n1-rect']);
  assert.deepEqual(outcome.record.inverse.writes, [{ shapeId: 'n1-rect', name: 'fill', value: '#4a90d9' }]);

  // The inverse line for fill is not fixed by the contract; the restored value is.
  environment.editor.setAttribute(outcome.record.inverse);
  assert.equal(rect.getAttribute('fill'), '#4a90d9');
  environment.editor.setAttribute(outcome.record.forward);
  assert.equal(rect.getAttribute('fill'), '#f5a623');
});

test('set label rewrites the internal text and uses the fixed forward/undo lines', () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1', 120, 100, 160, 60, '处理数据');
  const label = environment.tree.findShape('n1-label');

  const outcome = environment.editor.setAttribute({ id: 'n1', name: 'label', value: '处理数据 v2', quoted: true });
  assert.deepEqual(outcome.result.lines, ['box#n1 label updated: "处理数据 v2"']);
  assert.equal(label.getAttribute('text'), '处理数据 v2');
  assert.deepEqual(outcome.record.forward.writes, [
    { shapeId: 'n1-label', name: 'text', value: '处理数据 v2' },
  ]);
  assert.deepEqual(outcome.record.inverse.writes, [
    { shapeId: 'n1-label', name: 'text', value: '处理数据' },
  ]);
  assert.deepEqual(outcome.record.inverse.lines, ['box#n1 label restored: "处理数据"']);

  const undone = environment.editor.setAttribute(outcome.record.inverse);
  assert.deepEqual(undone.lines, ['box#n1 label restored: "处理数据"']);
  assert.equal(label.getAttribute('text'), '处理数据');
  environment.editor.setAttribute(outcome.record.forward);
  assert.equal(label.getAttribute('text'), '处理数据 v2');
});

test('one set is one undo unit and undo/redo replay the patch without selecting handlers again', async () => {
  const handler = new SpyBoxHandler();
  const environment = createBoxEnvironment({ handlers: [handler] });
  addBox(environment, 'n1');
  const rect = environment.tree.findShape('n1-rect');
  const observer = new RecordingObserver();
  const executor = createExecutor(environment, observer);

  const command = new SetAttributeCommand(environment.editor, {
    id: 'n1', name: 'fill', value: '#f5a623', quoted: false,
  });
  const executed = await executor.execute(command);
  assert.deepEqual(executed.lines, ['box#n1 fill propagated to n1-rect']);
  assert.equal(rect.getAttribute('fill'), '#f5a623');
  assert.equal(handler.handlesCalls, 1);
  assert.equal(observer.events.length, 1);

  handler.failSelection = true;
  const undone = await executor.execute(new UndoCommand());
  assert.equal(undone.lines.length > 0, true);
  assert.equal(rect.getAttribute('fill'), '#4a90d9');
  assert.equal(handler.handlesCalls, 1, 'undo must not re-run handler selection');
  await assert.rejects(executor.execute(new UndoCommand()), /nothing to undo/);

  const redone = await executor.execute(new RedoCommand());
  assert.deepEqual(redone.lines, ['box#n1 fill propagated to n1-rect']);
  assert.equal(rect.getAttribute('fill'), '#f5a623');
  assert.equal(handler.handlesCalls, 1, 'redo must not re-run handler selection');
  await assert.rejects(executor.execute(new RedoCommand()), /nothing to redo/);
  assert.equal(observer.events.length, 3);
});

test('a handler that fails after partial writes rolls back, never falls back, and leaves no record or history', async () => {
  const environment = createBoxEnvironment({
    handlers: [new BoxAttributeHandler(), new ExplodingBoxHandler()],
  });
  addBox(environment, 'n1');
  const box = environment.tree.findShape('n1');
  const rect = environment.tree.findShape('n1-rect');
  const label = environment.tree.findShape('n1-label');
  const observer = new RecordingObserver();
  const executor = createExecutor(environment, observer);

  const command = new SetAttributeCommand(environment.editor, {
    id: 'n1', name: 'stroke-width', value: '3', quoted: false,
  });
  await assert.rejects(executor.execute(command), /box handler exploded/);

  assert.equal(rect.getAttribute('fill'), '#4a90d9');
  assert.equal(label.getAttribute('text'), '开始');
  assert.equal(box.getAttribute('stroke-width'), undefined, 'the default path must not run after a handler failure');
  assert.equal(observer.events.length, 0);
  assert.throws(() => command.undo(), /has not been executed/);
  await assert.rejects(executor.execute(new UndoCommand()), /nothing to undo/);
});

test('the default path still writes the box g style while unknown and geometry attributes fail', () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  const box = environment.tree.findShape('n1');
  const rect = environment.tree.findShape('n1-rect');

  const outcome = environment.editor.setAttribute({ id: 'n1', name: 'stroke', value: 'red', quoted: false });
  assert.deepEqual(outcome.result.lines, ['box#n1 updated: stroke=red']);
  assert.equal(box.getAttribute('stroke'), 'red');
  assert.equal(rect.getAttribute('fill'), '#4a90d9');
  assert.deepEqual(outcome.record.forward.writes, [{ shapeId: 'n1', name: 'stroke', value: 'red' }]);

  assert.throws(
    () => environment.editor.setAttribute({ id: 'n1', name: 'unknown-attr', value: 'x', quoted: false }),
    /unknown attribute: unknown-attr/,
  );
  assert.throws(
    () => environment.editor.setAttribute({ id: 'n1', name: 'x', value: '10', quoted: false }),
    /unknown attribute: x/,
  );
  const labelled = environment.editor.setAttribute({ id: 'n1', name: 'label', value: 'still handled', quoted: true });
  assert.deepEqual(labelled.result.lines, ['box#n1 label updated: "still handled"']);
  assert.equal(environment.tree.findShape('n1-label').getAttribute('text'), 'still handled');
});
