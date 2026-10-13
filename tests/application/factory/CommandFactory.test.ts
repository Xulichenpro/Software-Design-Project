import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CommandFactory } from '../../../src/application/factory/CommandFactory.js';
import type { ArgumentToken } from '../../../src/application/contracts/ArgumentToken.js';
import type { ParsedCommandLine } from '../../../src/application/contracts/ParsedCommandLine.js';
import { UndoableCommand } from '../../../src/application/commands/base/UndoableCommand.js';
import { BarrierCommand } from '../../../src/application/commands/base/BarrierCommand.js';
import { QueryCommand } from '../../../src/application/commands/base/QueryCommand.js';
import { HistoryControlCommand } from '../../../src/application/commands/base/HistoryControlCommand.js';
import { ShapeTree } from '../../../src/domain/tree/ShapeTree.js';
import { ShapeFactory } from '../../../src/domain/factory/ShapeFactory.js';
import { ShapeEditorReceiver } from '../../../src/application/receivers/ShapeEditorReceiver.js';
import { DocumentReceiver } from '../../../src/application/receivers/DocumentReceiver.js';
import { QueryReceiver } from '../../../src/application/receivers/QueryReceiver.js';
import { SvgXmlCodec } from '../../../src/infrastructure/svg/SvgXmlCodec.js';
import type { FileGateway } from '../../../src/application/contracts/FileGateway.js';

const token = (value: string, quoted = false): ArgumentToken => Object.freeze({ value, quoted });
const line = (name: string, ...args: (string | ArgumentToken)[]): ParsedCommandLine => Object.freeze({
  name, args: Object.freeze(args.map(arg => typeof arg === 'string' ? token(arg) : arg)),
});
function setup(initialized = true) {
  const tree = new ShapeTree(); const editor = new ShapeEditorReceiver(tree, new ShapeFactory()); const query = new QueryReceiver(tree);
  const files: FileGateway = { async read() { return '<svg width="10" height="20"/>'; }, async write() {} };
  const document = new DocumentReceiver(tree, new SvgXmlCodec(new ShapeFactory()), files);
  const factory = new CommandFactory(editor, document, query);
  if (initialized) { document.initialize(); editor.create('g', 'p', []); editor.create('rect', 'r', ['1','2','3','4']); }
  return { tree, editor, document, query, factory };
}
const cases: readonly [ParsedCommandLine, typeof UndoableCommand | typeof BarrierCommand | typeof QueryCommand | typeof HistoryControlCommand][] = [
  [line('create', 'g', 'new'), UndoableCommand], [line('delete', 'r'), UndoableCommand],
  [line('move', 'r', '1', '2'), UndoableCommand], [line('scale', 'r', '2'), UndoableCommand],
  [line('set', 'r', 'fill', 'red'), UndoableCommand], [line('group', 'new', 'r'), UndoableCommand],
  [line('ungroup', 'p'), UndoableCommand], [line('addto', 'p', 'r'), UndoableCommand],
  [line('front', 'r'), UndoableCommand], [line('back', 'r'), UndoableCommand],
  [line('init'), BarrierCommand], [line('read', 'in.svg'), BarrierCommand],
  [line('save'), BarrierCommand], [line('canvas', '100', '200'), BarrierCommand],
  [line('tree'), QueryCommand], [line('show', 'r'), QueryCommand],
  [line('help'), QueryCommand], [line('canvas'), QueryCommand],
  [line('undo'), HistoryControlCommand], [line('redo'), HistoryControlCommand],
];
for (const [input, category] of cases) test(`factory classifies ${input.name} ${input.args.map(a => a.value).join(' ')}`, () => {
  const f = setup(); const before = f.query.tree().lines;
  assert.ok(f.factory.create(input) instanceof category);
  assert.deepEqual(f.query.tree().lines, before);
});

test('init accepts zero, one or two dimensions; canvas accepts zero or two', async () => {
  const f = setup(false);
  await f.factory.create(line('init')).execute(); assert.deepEqual(f.tree.canvasSize, { width: 800, height: 600 });
  await f.factory.create(line('init', '100')).execute(); assert.deepEqual(f.tree.canvasSize, { width: 100, height: 600 });
  await f.factory.create(line('init', '200', '300')).execute(); assert.deepEqual(f.tree.canvasSize, { width: 200, height: 300 });
  await f.factory.create(line('canvas', '400', '500')).execute(); assert.deepEqual(f.tree.canvasSize, { width: 400, height: 500 });
  assert.deepEqual(await f.factory.create(line('canvas')).execute(), f.query.showCanvas());
});

test('factory binds receivers and converts finite move/scale parameters', async () => {
  const f = setup();
  await f.factory.create(line('move', 'r', '-0.5', '2e1')).execute(); assert.equal(f.tree.findShape('r').getAttribute('x'), '0.5');
  await f.factory.create(line('scale', 'r', '2')).execute(); assert.equal(f.tree.findShape('r').getAttribute('height'), '8');
  await f.factory.create(line('set', 'r', 'width', '9')).execute(); assert.equal(f.tree.findShape('r').getAttribute('width'), '9');
  await f.factory.create(line('addto', 'p', 'r')).execute(); assert.equal(f.tree.findShape('r').parent, f.tree.findShape('p'));
  assert.deepEqual(await f.factory.create(line('show', 'r')).execute(), f.query.show('r'));
  await f.factory.create(line('save', 'out.svg')).execute(); assert.equal(f.document.associatedPath, 'out.svg');
});

for (const [type, args] of [
  ['rect', ['1','2','3','4','red']], ['circle', ['1','2','3']], ['ellipse', ['1','2','3','4']],
  ['line', ['1','2','3','4','black']], ['text', ['1','2',token('in', true)]], ['g', []],
] as const) test(`tail in creates ${type} in selected container`, async () => {
  const f = setup(); await f.factory.create(line('create', type, 'new', ...args, 'in', 'p')).execute();
  assert.equal(f.tree.findShape('new').parent, f.tree.findShape('p'));
  if (type === 'text') assert.equal(f.tree.findShape('new').getAttribute('text'), 'in');
});

test('quoted in and text ending in remain text content, while quoted directive is not parsed', async () => {
  const f = setup();
  await f.factory.create(line('create', 'text', 'a', '1', '2', token('in', true))).execute();
  await f.factory.create(line('create', 'text', 'b', '1', '2', token('ends in', true))).execute();
  assert.equal(f.tree.findShape('a').getAttribute('text'), 'in'); assert.equal(f.tree.findShape('a').parent, f.tree.root);
  assert.equal(f.tree.findShape('b').getAttribute('text'), 'ends in');
  assert.throws(() => f.factory.create(line('create', 'g', 'new', token('in', true), 'p')).execute(), /parameters/);
});

test('quoted metadata reaches domain shape validation and set text requires quotes', async () => {
  const f = setup();
  assert.throws(() => f.factory.create(line('create', 'text', 'bad', '1', '2', 'unquoted')).execute(), /quoted/);
  await f.factory.create(line('create', 'text', 'good', '1', '2', token('', true))).execute();
  assert.throws(() => f.factory.create(line('set', 'good', 'text', 'unquoted')), /quoted/);
  await f.factory.create(line('set', 'good', 'text', token('new text', true))).execute();
  assert.equal(f.tree.findShape('good').getAttribute('text'), 'new text');
});

test('shape-specific validation stays in domain factory and failures leave tree intact', () => {
  const f = setup(); const before = f.query.tree().lines;
  for (const input of [line('create', 'box', 'new'), line('create', 'rect', 'new', '1', '2'),
    line('create', 'circle', 'new', '0', '0', '-1'), line('create', 'rect', 'new', 'Infinity','0','1','1')]) {
    const command = f.factory.create(input); assert.ok(command instanceof UndoableCommand); assert.throws(() => command.execute());
  }
  assert.throws(() => f.factory.create(line('create', 'box', 'new')).execute(), /unknown shape type: box/);
  assert.deepEqual(f.query.tree().lines, before);
});

for (const input of [
  line('unknown'), line('INIT'), line('init','1','2','3'), line('canvas','1'), line('canvas','1','2','3'),
  line('read'), line('read','a','b'), line('save','a','b'), line('create'), line('create','g'),
  line('create','g','new','in'), line('delete'), line('delete','a','b'), line('move','r','1'),
  line('move','r','1','2','3'), line('scale','r'), line('set','r','fill'), line('group','new'),
  line('ungroup'), line('addto','p'), line('front'), line('back','r','extra'), line('tree','a','b'),
  line('show'), line('help','extra'), line('undo','extra'), line('redo','extra'),
]) test(`factory rejects invalid command syntax ${input.name} ${input.args.map(a => a.value).join(' ')}`, () => {
  assert.throws(() => setup(false).factory.create(input));
});

for (const input of [
  line('init','0'), line('init','NaN'), line('canvas','1','-1'), line('move','r','Infinity','1'),
  line('move','r','','1'), line('scale','r','0'), line('scale','r','-1'), line('scale','r','NaN'),
  line('set','r','width','Infinity'), line('set','r','stroke-width','-1'),
]) test(`factory rejects invalid numeric parameters ${input.name}`, () => {
  assert.throws(() => setup(false).factory.create(input));
});

test('factory accepts immutable token input without mutating it and can construct before initialization', async () => {
  const f = setup(false); const input = line('help'); const command = f.factory.create(input);
  assert.ok(command instanceof QueryCommand); assert.deepEqual(await command.execute(), f.query.help());
  assert.deepEqual(input, { name: 'help', args: [] });
  assert.ok(f.factory.create(line('move','missing','1','2')) instanceof UndoableCommand);
});
