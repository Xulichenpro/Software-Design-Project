import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AddToCommand } from '../../../src/application/commands/editing/AddToCommand.js';
import { BackCommand } from '../../../src/application/commands/editing/BackCommand.js';
import { CreateCommand } from '../../../src/application/commands/editing/CreateCommand.js';
import { DeleteCommand } from '../../../src/application/commands/editing/DeleteCommand.js';
import { FrontCommand } from '../../../src/application/commands/editing/FrontCommand.js';
import { GroupCommand } from '../../../src/application/commands/editing/GroupCommand.js';
import { MoveCommand } from '../../../src/application/commands/editing/MoveCommand.js';
import { UngroupCommand } from '../../../src/application/commands/editing/UngroupCommand.js';
import { UndoCommand } from '../../../src/application/commands/history/UndoCommand.js';
import {
  RecordingObserver, addBox, allShapeIds, boxArguments, boxQuoted, childIds,
  createBoxEnvironment, createExecutor, topologyFor,
} from './fixtures.js';

test('deleting the whole box is allowed as one undo unit and undo restores every part', async () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  const observer = new RecordingObserver();
  const executor = createExecutor(environment, observer);

  const deleted = await executor.execute(new DeleteCommand(environment.editor, 'n1'));
  assert.deepEqual(deleted.lines, ['box#n1 deleted']);
  assert.throws(() => environment.tree.findShape('n1'));
  assert.throws(() => environment.tree.findShape('n1-rect'));
  assert.throws(() => environment.tree.findShape('n1-label'));
  assert.equal(observer.events.length, 1);

  const undone = await executor.execute(new UndoCommand());
  assert.match(undone.lines[0]!, /^box#n1 restored/);
  const restored = environment.tree.findShape('n1');
  assert.deepEqual(childIds(restored), ['n1-rect', 'n1-label']);
  assert.equal(environment.tree.findShape('n1-rect').getAttribute('fill'), '#4a90d9');
  assert.equal(environment.tree.findShape('n1-label').getAttribute('text'), '开始');
  assert.equal(observer.events.length, 2);
  await assert.rejects(executor.execute(new UndoCommand()), /nothing to undo/);
});

test('deleting a required part is rejected with no mutation, no history change and no event', async () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  const observer = new RecordingObserver();
  const executor = createExecutor(environment, observer);
  await executor.execute(new MoveCommand(environment.editor, { id: 'n1', dx: 5, dy: 5 }));

  const before = allShapeIds(environment.tree);
  const rectX = environment.tree.findShape('n1-rect').getAttribute('x');
  const events = observer.events.length;
  await assert.rejects(executor.execute(new DeleteCommand(environment.editor, 'n1-rect')));

  assert.deepEqual(allShapeIds(environment.tree), before);
  assert.equal(environment.tree.findShape('n1-rect').getAttribute('x'), rectX);
  assert.equal(observer.events.length, events);

  const undone = await executor.execute(new UndoCommand());
  assert.deepEqual(undone.lines, ['box#n1 moved back by (-5,-5)']);
  assert.equal(environment.tree.findShape('n1-rect').getAttribute('x'), '120');
});

test('moving a required part into another container via addto or group is rejected atomically', async () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  environment.editor.create('g', 'other', []);
  const observer = new RecordingObserver();
  const executor = createExecutor(environment, observer);
  const before = allShapeIds(environment.tree);
  const box = environment.tree.findShape('n1');

  await assert.rejects(executor.execute(new AddToCommand(environment.editor, 'other', 'n1-rect')));
  assert.deepEqual(allShapeIds(environment.tree), before);
  assert.equal(environment.tree.findShape('n1-rect').parent, box);
  assert.deepEqual(childIds(environment.tree.findShape('other')), []);

  await assert.rejects(executor.execute(new GroupCommand(environment.editor, 'cluster', ['n1-rect'])));
  assert.deepEqual(allShapeIds(environment.tree), before);
  assert.equal(environment.tree.findShape('n1-rect').parent, box);
  assert.throws(() => environment.tree.findShape('cluster'));
  assert.equal(observer.events.length, 0);
  await assert.rejects(executor.execute(new UndoCommand()), /nothing to undo/);
});

test('create box in a box is allowed and moving the outer box carries the nested box parts', async () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  const executor = createExecutor(environment);
  const created = await executor.execute(new CreateCommand(
    environment.editor, 'box', 'n3', boxArguments(200, 150, 100, 50, 'inner'), 'n1', [...boxQuoted],
  ));
  assert.deepEqual(created.lines, [
    'box#n3 created (g#n3 + rect#n3-rect + text#n3-label) in box#n1',
  ]);
  const outer = environment.tree.findShape('n1');
  const inner = environment.tree.findShape('n3');
  assert.equal(inner.parent, outer);
  assert.deepEqual(childIds(outer), ['n1-rect', 'n1-label', 'n3']);

  await executor.execute(new MoveCommand(environment.editor, { id: 'n1', dx: 0, dy: 100 }));
  assert.equal(environment.tree.findShape('n1-rect').getAttribute('y'), '200');
  assert.equal(environment.tree.findShape('n3-rect').getAttribute('y'), '250');
  assert.equal(environment.tree.findShape('n3-label').getAttribute('y'), '285');

  await executor.execute(new UndoCommand());
  assert.equal(environment.tree.findShape('n1-rect').getAttribute('y'), '100');
  assert.equal(environment.tree.findShape('n3-rect').getAttribute('y'), '150');
  assert.equal(environment.tree.findShape('n3-label').getAttribute('y'), '185');
});

test('boxes can be grouped and ungrouping one reports the fixed composite error', async () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  addBox(environment, 'n2', 520, 100, 160, 60, '处理数据');
  const observer = new RecordingObserver();
  const executor = createExecutor(environment, observer);

  await assert.rejects(executor.execute(new UngroupCommand(environment.editor, 'n1')), {
    message: 'cannot ungroup composite shape: n1',
  });
  assert.equal(observer.events.length, 0);

  const grouped = await executor.execute(new GroupCommand(environment.editor, 'cluster', ['n1', 'n2']));
  assert.deepEqual(grouped.lines, ['g#cluster created with 2 children']);
  assert.deepEqual(childIds(environment.tree.findShape('cluster')), ['n1', 'n2']);
  assert.equal(observer.events.length, 1);
});

test('front and back may reorder required parts and preserve the required pair', async () => {
  const environment = createBoxEnvironment();
  const box = addBox(environment, 'n1');
  const executor = createExecutor(environment);

  const fronted = await executor.execute(new FrontCommand(environment.editor, 'n1-rect'));
  assert.deepEqual(fronted.lines, ['rect#n1-rect moved to front']);
  assert.deepEqual(childIds(box), ['n1-label', 'n1-rect']);
  assert.doesNotThrow(() => box.validateStructure(topologyFor(box)));

  const backed = await executor.execute(new BackCommand(environment.editor, 'n1-rect'));
  assert.deepEqual(backed.lines, ['rect#n1-rect moved to back']);
  assert.deepEqual(childIds(box), ['n1-rect', 'n1-label']);
  assert.doesNotThrow(() => box.validateStructure(topologyFor(box)));
});
