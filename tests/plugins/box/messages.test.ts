import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MoveCommand } from '../../../src/application/commands/editing/MoveCommand.js';
import { SetAttributeCommand } from '../../../src/application/commands/editing/SetAttributeCommand.js';
import { UndoCommand } from '../../../src/application/commands/history/UndoCommand.js';
import { addBox, boxArguments, boxQuoted, createBoxEnvironment, createExecutor } from './fixtures.js';

test('create box reports the heading and both derived child labels exactly', () => {
  const environment = createBoxEnvironment();
  const outcome = environment.editor.create(
    'box', 'n1', boxArguments(120, 100, 160, 60, '开始'), undefined, [...boxQuoted],
  );
  assert.deepEqual(outcome.result.lines, [
    'box#n1 created (g#n1 + rect#n1-rect + text#n1-label)',
  ]);
});

test('create box in a container keeps the Phase 1 in-clause suffix', () => {
  const environment = createBoxEnvironment();
  environment.editor.create('g', 'flow', []);
  const outcome = environment.editor.create(
    'box', 'n3', boxArguments(20, 20, 100, 50, 'inner'), 'flow', [...boxQuoted],
  );
  assert.deepEqual(outcome.result.lines, [
    'box#n3 created (g#n3 + rect#n3-rect + text#n3-label) in g#flow',
  ]);
});

test('move and undo use the container by-delta wording for box', async () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  const executor = createExecutor(environment);

  const moved = await executor.execute(new MoveCommand(environment.editor, { id: 'n1', dx: 0, dy: 100 }));
  assert.deepEqual(moved.lines, ['box#n1 moved by (0,100)']);

  const undone = await executor.execute(new UndoCommand());
  assert.deepEqual(undone.lines, ['box#n1 moved back by (0,-100)']);
});

test('set fill and set label report the plugin-defined forward lines and label undo line', async () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1', 120, 100, 160, 60, '处理数据');
  const executor = createExecutor(environment);

  const filled = await executor.execute(new SetAttributeCommand(environment.editor, {
    id: 'n1', name: 'fill', value: '#f5a623', quoted: false,
  }));
  assert.deepEqual(filled.lines, ['box#n1 fill propagated to n1-rect']);

  const labelled = await executor.execute(new SetAttributeCommand(environment.editor, {
    id: 'n1', name: 'label', value: '处理数据 v2', quoted: true,
  }));
  assert.deepEqual(labelled.lines, ['box#n1 label updated: "处理数据 v2"']);

  const undone = await executor.execute(new UndoCommand());
  assert.deepEqual(undone.lines, ['box#n1 label restored: "处理数据"']);
});

test('label undo restores the prior text and keeps the earlier fill edit intact', async () => {
  const environment = createBoxEnvironment();
  const box = addBox(environment, 'n1', 120, 100, 160, 60, '处理数据');
  const executor = createExecutor(environment);

  await executor.execute(new SetAttributeCommand(environment.editor, {
    id: 'n1', name: 'fill', value: '#f5a623', quoted: false,
  }));
  await executor.execute(new SetAttributeCommand(environment.editor, {
    id: 'n1', name: 'label', value: '处理数据 v2', quoted: true,
  }));
  await executor.execute(new UndoCommand());

  assert.equal(environment.tree.findShape('n1-label').getAttribute('text'), '处理数据');
  assert.equal(environment.tree.findShape('n1-rect').getAttribute('fill'), '#f5a623');
  assert.equal(box.label, 'box#n1');
});
