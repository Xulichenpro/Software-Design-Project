import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CreateCommand } from '../../../src/application/commands/editing/CreateCommand.js';
import { MoveCommand } from '../../../src/application/commands/editing/MoveCommand.js';
import { ScaleCommand } from '../../../src/application/commands/editing/ScaleCommand.js';
import { SetAttributeCommand } from '../../../src/application/commands/editing/SetAttributeCommand.js';
import { UndoCommand } from '../../../src/application/commands/history/UndoCommand.js';
import { RedoCommand } from '../../../src/application/commands/history/RedoCommand.js';
import {
  RecordingObserver, addBox, allShapeIds, boxArguments, boxQuoted, childIds,
  createBoxEnvironment, createExecutor,
} from './fixtures.js';

test('move and scale through the receiver traverse all direct children including a nested box', async () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  addBox(environment, 'n3', 200, 150, 100, 50, 'inner', 'n1');
  const observer = new RecordingObserver();
  const executor = createExecutor(environment, observer);

  const moved = await executor.execute(new MoveCommand(environment.editor, { id: 'n1', dx: 0, dy: 100 }));
  assert.deepEqual(moved.lines, ['box#n1 moved by (0,100)']);
  assert.equal(environment.tree.findShape('n1-rect').getAttribute('y'), '200');
  assert.equal(environment.tree.findShape('n3-rect').getAttribute('y'), '250');

  const scaled = await executor.execute(new ScaleCommand(environment.editor, { id: 'n1', factor: 2 }));
  assert.deepEqual(scaled.lines, ['box#n1 scaled by 2']);
  assert.equal(environment.tree.findShape('n1-rect').getAttribute('width'), '320');
  assert.equal(environment.tree.findShape('n1-rect').getAttribute('height'), '120');
  assert.equal(environment.tree.findShape('n3-rect').getAttribute('width'), '200');
  assert.equal(environment.tree.findShape('n3-rect').getAttribute('height'), '100');

  await executor.execute(new UndoCommand());
  assert.equal(environment.tree.findShape('n3-rect').getAttribute('width'), '100');
  await executor.execute(new UndoCommand());
  assert.equal(environment.tree.findShape('n3-rect').getAttribute('y'), '150');
  assert.equal(observer.events.length, 4);
  await assert.rejects(executor.execute(new UndoCommand()), /nothing to undo/);
});

test('each set on a box is its own undo unit and redo replays the same patch', async () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1', 120, 100, 160, 60, '处理数据');
  const executor = createExecutor(environment);

  await executor.execute(new SetAttributeCommand(environment.editor, {
    id: 'n1', name: 'fill', value: '#f5a623', quoted: false,
  }));
  await executor.execute(new SetAttributeCommand(environment.editor, {
    id: 'n1', name: 'label', value: '处理数据 v2', quoted: true,
  }));

  const undoLabel = await executor.execute(new UndoCommand());
  assert.deepEqual(undoLabel.lines, ['box#n1 label restored: "处理数据"']);
  assert.equal(environment.tree.findShape('n1-label').getAttribute('text'), '处理数据');
  assert.equal(environment.tree.findShape('n1-rect').getAttribute('fill'), '#f5a623');

  const undoFill = await executor.execute(new UndoCommand());
  assert.equal(undoFill.lines.length > 0, true);
  assert.equal(environment.tree.findShape('n1-rect').getAttribute('fill'), '#4a90d9');

  await executor.execute(new RedoCommand());
  assert.equal(environment.tree.findShape('n1-rect').getAttribute('fill'), '#f5a623');
  const redoLabel = await executor.execute(new RedoCommand());
  assert.deepEqual(redoLabel.lines, ['box#n1 label updated: "处理数据 v2"']);
  assert.equal(environment.tree.findShape('n1-label').getAttribute('text'), '处理数据 v2');
  await assert.rejects(executor.execute(new RedoCommand()), /nothing to redo/);
});

test('extra shapes can join a box and participate in move while the required pair stays present', async () => {
  const environment = createBoxEnvironment();
  const box = addBox(environment, 'n1');
  environment.editor.create('circle', 'dot', ['10', '20', '5'], 'n1');
  assert.deepEqual(childIds(box), ['n1-rect', 'n1-label', 'dot']);

  const executor = createExecutor(environment);
  await executor.execute(new MoveCommand(environment.editor, { id: 'n1', dx: 10, dy: 20 }));
  assert.equal(environment.tree.findShape('dot').getAttribute('cx'), '20');
  assert.equal(environment.tree.findShape('dot').getAttribute('cy'), '40');
  assert.equal(environment.tree.findShape('n1-rect').getAttribute('x'), '130');
  assert.equal(environment.tree.findShape('n1-label').getAttribute('x'), '150');
});

test('create box rejects a colliding derived part id before creating anything', async () => {
  const environment = createBoxEnvironment();
  environment.editor.create('rect', 'n1-rect', ['0', '0', '10', '10']);
  const before = allShapeIds(environment.tree);
  const observer = new RecordingObserver();
  const executor = createExecutor(environment, observer);

  await assert.rejects(
    executor.execute(new CreateCommand(
      environment.editor, 'box', 'n1', boxArguments(120, 100, 160, 60, '开始'), undefined, [...boxQuoted],
    )),
    /id already exists: n1-rect/,
  );
  assert.deepEqual(allShapeIds(environment.tree), before);
  assert.throws(() => environment.tree.findShape('n1'));
  assert.throws(() => environment.tree.findShape('n1-label'));
  assert.equal(observer.events.length, 0);
  await assert.rejects(executor.execute(new UndoCommand()), /nothing to undo/);
});
