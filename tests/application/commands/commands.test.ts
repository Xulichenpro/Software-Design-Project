import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ShapeTree } from '../../../src/domain/tree/ShapeTree.js';
import { ShapeFactory } from '../../../src/domain/factory/ShapeFactory.js';
import { ShapeEditorReceiver } from '../../../src/application/receivers/ShapeEditorReceiver.js';
import { DocumentReceiver } from '../../../src/application/receivers/DocumentReceiver.js';
import { QueryReceiver } from '../../../src/application/receivers/QueryReceiver.js';
import { SvgXmlCodec } from '../../../src/infrastructure/svg/SvgXmlCodec.js';
import { Command } from '../../../src/application/commands/base/Command.js';
import { UndoableCommand } from '../../../src/application/commands/base/UndoableCommand.js';
import { BarrierCommand } from '../../../src/application/commands/base/BarrierCommand.js';
import { QueryCommand } from '../../../src/application/commands/base/QueryCommand.js';
import { HistoryControlCommand } from '../../../src/application/commands/base/HistoryControlCommand.js';
import { CreateCommand } from '../../../src/application/commands/editing/CreateCommand.js';
import { DeleteCommand } from '../../../src/application/commands/editing/DeleteCommand.js';
import { MoveCommand } from '../../../src/application/commands/editing/MoveCommand.js';
import { ScaleCommand } from '../../../src/application/commands/editing/ScaleCommand.js';
import { SetAttributeCommand } from '../../../src/application/commands/editing/SetAttributeCommand.js';
import { GroupCommand } from '../../../src/application/commands/editing/GroupCommand.js';
import { UngroupCommand } from '../../../src/application/commands/editing/UngroupCommand.js';
import { AddToCommand } from '../../../src/application/commands/editing/AddToCommand.js';
import { FrontCommand } from '../../../src/application/commands/editing/FrontCommand.js';
import { BackCommand } from '../../../src/application/commands/editing/BackCommand.js';
import { InitCommand } from '../../../src/application/commands/document/InitCommand.js';
import { ReadCommand } from '../../../src/application/commands/document/ReadCommand.js';
import { SaveCommand } from '../../../src/application/commands/document/SaveCommand.js';
import { ResizeCanvasCommand } from '../../../src/application/commands/document/ResizeCanvasCommand.js';
import { TreeCommand } from '../../../src/application/commands/query/TreeCommand.js';
import { ShowCommand } from '../../../src/application/commands/query/ShowCommand.js';
import { HelpCommand } from '../../../src/application/commands/query/HelpCommand.js';
import { ShowCanvasCommand } from '../../../src/application/commands/query/ShowCanvasCommand.js';
import { UndoCommand } from '../../../src/application/commands/history/UndoCommand.js';
import { RedoCommand } from '../../../src/application/commands/history/RedoCommand.js';
import type { FileGateway } from '../../../src/application/contracts/FileGateway.js';

class MemoryFiles implements FileGateway {
  files = new Map<string, string>();
  fail = false;
  async read(path: string) { const text = this.files.get(path); if (text === undefined) throw new Error('missing'); return text; }
  async write(path: string, content: string) { if (this.fail) throw new Error('write failed'); this.files.set(path, content); }
}
function setup(initialize = true) {
  const tree = new ShapeTree(); const editor = new ShapeEditorReceiver(tree, new ShapeFactory());
  const query = new QueryReceiver(tree); const files = new MemoryFiles();
  const document = new DocumentReceiver(tree, new SvgXmlCodec(new ShapeFactory()), files);
  if (initialize) {
    document.initialize(); editor.create('g', 'p', []); editor.create('g', 'g', [], 'p');
    editor.create('rect', 'a', ['1', '2', '3', '4'], 'g'); editor.create('circle', 'b', ['5', '6', '7'], 'g');
    editor.create('g', 'sibling', [], 'p'); editor.create('g', 'tail', []);
  }
  return { tree, editor, query, files, document };
}
type Fixture = ReturnType<typeof setup>;
const editing: readonly [string, (f: Fixture) => UndoableCommand][] = [
  ['CreateCommand', f => new CreateCommand(f.editor, 'text', 'title', ['10', '20', 'hello'], 'g')],
  ['DeleteCommand', f => new DeleteCommand(f.editor, 'g')],
  ['MoveCommand', f => new MoveCommand(f.editor, { id: 'g', dx: 3, dy: 4 })],
  ['ScaleCommand', f => new ScaleCommand(f.editor, { id: 'g', factor: 2 })],
  ['SetAttributeCommand', f => new SetAttributeCommand(f.editor, { id: 'a', name: 'fill', value: 'red' })],
  ['GroupCommand', f => new GroupCommand(f.editor, 'joined', ['tail', 'a', 'b'])],
  ['UngroupCommand', f => new UngroupCommand(f.editor, 'g')],
  ['AddToCommand', f => new AddToCommand(f.editor, 'g', 'tail')],
  ['FrontCommand', f => new FrontCommand(f.editor, 'p')],
  ['BackCommand', f => new BackCommand(f.editor, 'tail')],
];
for (const [name, make] of editing) test(`${name} executes and repeats inverse/forward without losing identities`, async () => {
  const f = setup(); const before = f.query.tree().lines; const original = f.tree.findShape('a');
  const command = make(f); assert.ok(command instanceof Command); assert.ok(command instanceof UndoableCommand);
  assert.throws(() => command.undo(), /not.*executed|no.*record/);
  assert.throws(() => command.redo(), /not.*executed|no.*record/);
  const result = await command.execute(); assert.ok(result.lines.length);
  const after = f.query.tree().lines; assert.notDeepEqual(after, before);
  await command.undo(); assert.deepEqual(f.query.tree().lines, before); assert.equal(f.tree.findShape('a'), original);
  await command.redo(); assert.deepEqual(f.query.tree().lines, after);
  await command.undo(); assert.deepEqual(f.query.tree().lines, before);
  await command.execute(); assert.deepEqual(f.query.tree().lines, after);
  await command.undo(); assert.deepEqual(f.query.tree().lines, before);
});

test('set retains original absent style across redo and repeat execute', async () => {
  const f = setup(); const command = new SetAttributeCommand(f.editor, { id: 'a', name: 'fill', value: 'red' });
  await command.execute(); await command.undo(); f.tree.findShape('a').setAttribute('fill', 'blue');
  await command.redo(); await command.undo(); assert.equal(f.tree.findShape('a').getAttribute('fill'), undefined);
  f.tree.findShape('a').setAttribute('fill', 'green'); await command.execute(); await command.undo();
  assert.equal(f.tree.findShape('a').getAttribute('fill'), undefined);
});

test('failed first execute can retry; failed undo or redo keeps its original record', async () => {
  const f = setup(); const command = new CreateCommand(f.editor, 'g', 'tail', []);
  assert.throws(() => command.execute(), /id already exists/); f.editor.delete('tail');
  await command.execute(); const shape = f.tree.findShape('tail'); await command.undo(); await command.redo();
  assert.equal(f.tree.findShape('tail'), shape);
  const set = new SetAttributeCommand(f.editor, { id: 'a', name: 'fill', value: 'red' }); await set.execute();
  const deleted = f.editor.delete('a'); assert.throws(() => set.undo(), /no such shape/);
  f.editor.editStructure(deleted.record.inverse); await set.undo(); assert.equal(f.tree.findShape('a').getAttribute('fill'), undefined);
  const again = f.editor.delete('a'); assert.throws(() => set.redo(), /no such shape/);
  f.editor.editStructure(again.record.inverse); await set.redo(); await set.undo();
  assert.equal(f.tree.findShape('a').getAttribute('fill'), undefined);
});

test('commands capture immutable request values rather than mutable caller arrays/objects', async () => {
  const f = setup(); const args = ['1', '2', '3', '4'];
  const create = new CreateCommand(f.editor, 'rect', 'new', args); args[0] = '99'; await create.execute();
  assert.equal(f.tree.findShape('new').getAttribute('x'), '1');
  const params = { id: 'new', dx: 2, dy: 3 }; const move = new MoveCommand(f.editor, params); params.dx = 99;
  await move.execute(); assert.equal(f.tree.findShape('new').getAttribute('x'), '3');
  const members = ['a', 'b']; const group = new GroupCommand(f.editor, 'joined', members); members.push('tail');
  await group.execute(); assert.equal(f.tree.getContainer('joined').children.items.length, 2);
});

test('InitCommand and ResizeCanvasCommand forward default and explicit dimensions as barriers', async () => {
  const f = setup(false); const init = new InitCommand(f.document);
  assert.ok(init instanceof BarrierCommand); await init.execute(); assert.deepEqual(f.tree.canvasSize, { width: 800, height: 600 });
  await new InitCommand(f.document, 50, 60).execute(); assert.deepEqual(f.tree.canvasSize, { width: 50, height: 60 });
  const resize = new ResizeCanvasCommand(f.document, 70, 80); assert.ok(resize instanceof BarrierCommand); await resize.execute();
  assert.deepEqual(f.tree.canvasSize, { width: 70, height: 80 }); assert.throws(() => new ResizeCanvasCommand(f.document, 0, 1).execute());
});

test('ReadCommand and SaveCommand await document IO, association and failures', async () => {
  const f = setup(); f.files.files.set('in.svg', '<svg width="10" height="20"><g id="imported"/></svg>');
  const read = new ReadCommand(f.document, 'in.svg'); assert.ok(read instanceof BarrierCommand);
  await read.execute(); assert.equal(f.tree.findShape('imported').tag, 'g');
  const save = new SaveCommand(f.document, 'out.svg'); assert.ok(save instanceof BarrierCommand);
  await save.execute(); assert.equal(f.document.associatedPath, 'out.svg'); assert.match(f.files.files.get('out.svg')!, /id="imported"/);
  await new SaveCommand(f.document).execute(); f.files.fail = true;
  await assert.rejects(new SaveCommand(f.document, 'bad.svg').execute(), /cannot write file/);
  assert.equal(f.document.associatedPath, 'out.svg'); await assert.rejects(new ReadCommand(f.document, 'missing.svg').execute(), /cannot read file/);
});

test('TreeCommand, ShowCommand, HelpCommand and ShowCanvasCommand forward queries without mutation', async () => {
  const f = setup(); const before = f.query.tree().lines;
  for (const [command, expected] of [
    [new TreeCommand(f.query), f.query.tree()], [new TreeCommand(f.query, 'g'), f.query.tree('g')],
    [new ShowCommand(f.query, 'a'), f.query.show('a')], [new HelpCommand(f.query), f.query.help()],
    [new ShowCanvasCommand(f.query), f.query.showCanvas()],
  ] as const) {
    assert.ok(command instanceof QueryCommand); assert.deepEqual(await command.execute(), expected);
  }
  assert.deepEqual(f.query.tree().lines, before);
  await new HelpCommand(setup(false).query).execute();
});

test('UndoCommand and RedoCommand receive each target at execute time', async () => {
  const f = setup(); const undo = new UndoCommand(); const redo = new RedoCommand();
  assert.ok(undo instanceof HistoryControlCommand); assert.ok(redo instanceof HistoryControlCommand);
  assert.equal(undo.getDirection(), 'undo'); assert.equal(redo.getDirection(), 'redo');
  const first = new MoveCommand(f.editor, { id: 'a', dx: 1, dy: 2 });
  const second = new SetAttributeCommand(f.editor, { id: 'b', name: 'fill', value: 'blue' });
  await first.execute(); await second.execute(); await undo.execute(second); await undo.execute(first);
  assert.equal(f.tree.findShape('a').getAttribute('x'), '1'); assert.equal(f.tree.findShape('b').getAttribute('fill'), undefined);
  await redo.execute(first); await redo.execute(second);
  assert.equal(f.tree.findShape('a').getAttribute('x'), '2'); assert.equal(f.tree.findShape('b').getAttribute('fill'), 'blue');
});
