import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ModifiedStarDecorator } from '../../../plugins/tree-star/src/ModifiedStarDecorator.js';
import { CommandExecutor } from '../../../src/application/execution/CommandExecutor.js';
import { InitCommand } from '../../../src/application/commands/document/InitCommand.js';
import { ReadCommand } from '../../../src/application/commands/document/ReadCommand.js';
import { ResizeCanvasCommand } from '../../../src/application/commands/document/ResizeCanvasCommand.js';
import { SaveCommand } from '../../../src/application/commands/document/SaveCommand.js';
import { CreateCommand } from '../../../src/application/commands/editing/CreateCommand.js';
import { AddToCommand } from '../../../src/application/commands/editing/AddToCommand.js';
import { DeleteCommand } from '../../../src/application/commands/editing/DeleteCommand.js';
import { GroupCommand } from '../../../src/application/commands/editing/GroupCommand.js';
import { MoveCommand } from '../../../src/application/commands/editing/MoveCommand.js';
import { SetAttributeCommand } from '../../../src/application/commands/editing/SetAttributeCommand.js';
import { RedoCommand } from '../../../src/application/commands/history/RedoCommand.js';
import { UndoCommand } from '../../../src/application/commands/history/UndoCommand.js';
import type { TreeRow } from '../../../src/application/tree/TreeRow.js';
import { MemoryFiles, createReceiverEnvironment } from '../../helpers/builtins.js';
import type { ReceiverEnvironment } from '../../helpers/builtins.js';

interface Harness {
  readonly environment: ReceiverEnvironment;
  readonly decorator: ModifiedStarDecorator;
  readonly executor: CommandExecutor;
  readonly files: MemoryFiles;
}

function createHarness(options: { readonly files?: MemoryFiles } = {}): Harness {
  const decorator = new ModifiedStarDecorator();
  const files = options.files ?? new MemoryFiles();
  const environment = createReceiverEnvironment({
    initialized: false,
    files,
    decorators: [['modified-star', decorator]],
  });
  return {
    environment,
    decorator,
    executor: new CommandExecutor(environment.decorators, environment.tree),
    files,
  };
}

function lines(harness: Harness): readonly string[] {
  return harness.environment.query.tree().lines;
}

const rootRow: TreeRow = { id: undefined, kind: undefined, isRoot: true, base: 'svg (800x600)' };

function row(id: string, kind: string): TreeRow {
  return { id, kind, isRoot: false, base: `${kind}#${id}` };
}

const cleanRectA = '    ├── rect#a  x=1 y=2 w=3 h=4';
const rectB = '    └── rect#b  x=5 y=6 w=7 h=8';

const readDocument =
  '<?xml version="1.0"?>' +
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
  '<rect id="r2" x="1" y="2" width="3" height="4"/>' +
  '</svg>';

test('init marks the root; a new node marks itself, its ancestors and the root but not an existing sibling', async () => {
  const harness = createHarness();
  const { environment, decorator, executor } = harness;

  await executor.execute(new InitCommand(environment.document));
  assert.deepEqual(lines(harness), ['svg (800x600) *']);
  assert.equal(decorator.decorate(rootRow, environment.tree), '*');

  await executor.execute(new CreateCommand(environment.editor, 'g', 'parent', []));
  assert.deepEqual(lines(harness), [
    'svg (800x600) *',
    '└── g#parent *',
  ]);

  await executor.execute(new CreateCommand(environment.editor, 'rect', 'a', ['1', '2', '3', '4'], 'parent'));
  assert.deepEqual(lines(harness), [
    'svg (800x600) *',
    '└── g#parent *',
    '    └── rect#a  x=1 y=2 w=3 h=4 *',
  ]);
  assert.equal(decorator.decorate(row('a', 'rect'), environment.tree), '*');

  await executor.execute(new SaveCommand(environment.document, 'drawing.svg'));
  assert.deepEqual(lines(harness), [
    'svg (800x600)',
    '└── g#parent',
    '    └── rect#a  x=1 y=2 w=3 h=4',
  ]);

  await executor.execute(new CreateCommand(environment.editor, 'rect', 'b', ['5', '6', '7', '8'], 'parent'));
  assert.deepEqual(lines(harness), [
    'svg (800x600) *',
    '└── g#parent *',
    cleanRectA,
    `${rectB} *`,
  ]);
  assert.equal(decorator.decorate(row('a', 'rect'), environment.tree), undefined);
  assert.equal(decorator.decorate(row('b', 'rect'), environment.tree), '*');
  assert.equal(decorator.decorate(row('parent', 'g'), environment.tree), '*');
  assert.equal(decorator.decorate(rootRow, environment.tree), '*');
});

test('move and set mark only the target, all ancestors and the root', async () => {
  const harness = createHarness();
  const { environment, executor } = harness;

  await executor.execute(new InitCommand(environment.document));
  await executor.execute(new CreateCommand(environment.editor, 'g', 'parent', []));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'a', ['1', '2', '3', '4'], 'parent'));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'b', ['5', '6', '7', '8'], 'parent'));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'top', ['9', '10', '11', '12']));
  await executor.execute(new SaveCommand(environment.document, 'drawing.svg'));
  assert.deepEqual(lines(harness), [
    'svg (800x600)',
    '├── g#parent',
    '│   ├── rect#a  x=1 y=2 w=3 h=4',
    '│   └── rect#b  x=5 y=6 w=7 h=8',
    '└── rect#top  x=9 y=10 w=11 h=12',
  ]);

  await executor.execute(new MoveCommand(environment.editor, { id: 'a', dx: 10, dy: 20 }));
  assert.deepEqual(lines(harness), [
    'svg (800x600) *',
    '├── g#parent *',
    '│   ├── rect#a  x=11 y=22 w=3 h=4 *',
    '│   └── rect#b  x=5 y=6 w=7 h=8',
    '└── rect#top  x=9 y=10 w=11 h=12',
  ]);

  await executor.execute(new SaveCommand(environment.document, 'drawing.svg'));
  await executor.execute(new SetAttributeCommand(environment.editor, {
    id: 'a', name: 'width', value: '30', quoted: false,
  }));
  assert.deepEqual(lines(harness), [
    'svg (800x600) *',
    '├── g#parent *',
    '│   ├── rect#a  x=11 y=22 w=30 h=4 *',
    '│   └── rect#b  x=5 y=6 w=7 h=8',
    '└── rect#top  x=9 y=10 w=11 h=12',
  ]);
});

test('delete hides the removed row and marks only its surviving parent, ancestors and the root', async () => {
  const harness = createHarness();
  const { environment, decorator, executor } = harness;

  await executor.execute(new InitCommand(environment.document));
  await executor.execute(new CreateCommand(environment.editor, 'g', 'parent', []));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'a', ['1', '2', '3', '4'], 'parent'));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'b', ['5', '6', '7', '8'], 'parent'));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'top', ['9', '10', '11', '12']));
  await executor.execute(new SaveCommand(environment.document, 'drawing.svg'));

  await executor.execute(new DeleteCommand(environment.editor, 'b'));
  assert.deepEqual(lines(harness), [
    'svg (800x600) *',
    '├── g#parent *',
    '│   └── rect#a  x=1 y=2 w=3 h=4',
    '└── rect#top  x=9 y=10 w=11 h=12',
  ]);
  assert.equal(decorator.decorate(row('parent', 'g'), environment.tree), '*');
  assert.equal(decorator.decorate(row('a', 'rect'), environment.tree), undefined);
});

test('group marks the new group, every moved child and the root', async () => {
  const harness = createHarness();
  const { environment, executor } = harness;

  await executor.execute(new InitCommand(environment.document));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'a', ['1', '2', '3', '4']));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'b', ['5', '6', '7', '8']));
  await executor.execute(new SaveCommand(environment.document, 'drawing.svg'));

  await executor.execute(new GroupCommand(environment.editor, 'g2', ['a', 'b']));
  assert.deepEqual(lines(harness), [
    'svg (800x600) *',
    '└── g#g2 *',
    '    ├── rect#a  x=1 y=2 w=3 h=4 *',
    `    └── rect#b  x=5 y=6 w=7 h=8 *`,
  ]);
});

test('moving a node between containers marks it plus its old and new ancestors and the root', async () => {
  const harness = createHarness();
  const { environment, executor } = harness;

  await executor.execute(new InitCommand(environment.document));
  await executor.execute(new CreateCommand(environment.editor, 'g', 'left', []));
  await executor.execute(new CreateCommand(environment.editor, 'g', 'right', []));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'r', ['1', '2', '3', '4'], 'left'));
  await executor.execute(new SaveCommand(environment.document, 'drawing.svg'));
  assert.deepEqual(lines(harness), [
    'svg (800x600)',
    '├── g#left',
    '│   └── rect#r  x=1 y=2 w=3 h=4',
    '└── g#right',
  ]);

  await executor.execute(new AddToCommand(environment.editor, 'right', 'r'));
  assert.deepEqual(lines(harness), [
    'svg (800x600) *',
    '├── g#left *',
    '└── g#right *',
    '    └── rect#r  x=1 y=2 w=3 h=4 *',
  ]);
});

test('a successful save clears every star; a failed save keeps them', async () => {
  const harness = createHarness();
  const { environment, decorator, executor, files } = harness;

  await executor.execute(new InitCommand(environment.document));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'a', ['1', '2', '3', '4']));
  assert.equal(decorator.decorate(row('a', 'rect'), environment.tree), '*');

  await executor.execute(new SaveCommand(environment.document, 'drawing.svg'));
  assert.deepEqual(lines(harness), [
    'svg (800x600)',
    '└── rect#a  x=1 y=2 w=3 h=4',
  ]);
  assert.equal(decorator.decorate(row('a', 'rect'), environment.tree), undefined);
  assert.equal(decorator.decorate(rootRow, environment.tree), undefined);

  await executor.execute(new MoveCommand(environment.editor, { id: 'a', dx: 5, dy: 5 }));
  assert.deepEqual(lines(harness), [
    'svg (800x600) *',
    '└── rect#a  x=6 y=7 w=3 h=4 *',
  ]);

  files.failWrite = true;
  await assert.rejects(
    executor.execute(new SaveCommand(environment.document, 'drawing.svg')),
    /cannot write file: drawing\.svg/,
  );
  assert.deepEqual(lines(harness), [
    'svg (800x600) *',
    '└── rect#a  x=6 y=7 w=3 h=4 *',
  ]);
  assert.equal(decorator.decorate(row('a', 'rect'), environment.tree), '*');
});

test('after a save, a new edit gets a star and undo/redo back to the save point keep it', async () => {
  const harness = createHarness();
  const { environment, decorator, executor } = harness;

  await executor.execute(new InitCommand(environment.document));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'a', ['1', '2', '3', '4']));
  await executor.execute(new SaveCommand(environment.document, 'drawing.svg'));

  await executor.execute(new MoveCommand(environment.editor, { id: 'a', dx: 10, dy: 10 }));
  assert.deepEqual(lines(harness), [
    'svg (800x600) *',
    '└── rect#a  x=11 y=12 w=3 h=4 *',
  ]);

  await executor.execute(new UndoCommand());
  assert.deepEqual(lines(harness), [
    'svg (800x600) *',
    '└── rect#a  x=1 y=2 w=3 h=4 *',
  ]);
  assert.equal(decorator.decorate(row('a', 'rect'), environment.tree), '*', 'undo does not clear the star');

  await executor.execute(new RedoCommand());
  assert.deepEqual(lines(harness), [
    'svg (800x600) *',
    '└── rect#a  x=11 y=12 w=3 h=4 *',
  ]);
  assert.equal(decorator.decorate(row('a', 'rect'), environment.tree), '*', 'redo does not clear the star');
});

test('a successful read clears every star; a failed read keeps them', async () => {
  const files = new MemoryFiles(new Map([['doc.svg', readDocument]]));
  const harness = createHarness({ files });
  const { environment, decorator, executor } = harness;

  await executor.execute(new InitCommand(environment.document));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'a', ['1', '2', '3', '4']));
  assert.equal(decorator.decorate(rootRow, environment.tree), '*');

  await executor.execute(new ReadCommand(environment.document, 'doc.svg'));
  assert.deepEqual(lines(harness), [
    'svg (100x100)',
    '└── rect#r2  x=1 y=2 w=3 h=4',
  ]);
  assert.equal(decorator.decorate(rootRow, environment.tree), undefined);

  await executor.execute(new MoveCommand(environment.editor, { id: 'r2', dx: 5, dy: 5 }));
  assert.deepEqual(lines(harness), [
    'svg (100x100) *',
    '└── rect#r2  x=6 y=7 w=3 h=4 *',
  ]);

  files.failRead = true;
  await assert.rejects(
    executor.execute(new ReadCommand(environment.document, 'missing.svg')),
    /cannot read file: missing\.svg/,
  );
  assert.deepEqual(lines(harness), [
    'svg (100x100) *',
    '└── rect#r2  x=6 y=7 w=3 h=4 *',
  ]);
});

test('init clears the old ids and marks the root; resize marks the root and keeps existing dirty ids', async () => {
  const harness = createHarness();
  const { environment, decorator, executor } = harness;

  await executor.execute(new InitCommand(environment.document));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'a', ['1', '2', '3', '4']));
  assert.equal(decorator.decorate(row('a', 'rect'), environment.tree), '*');

  await executor.execute(new InitCommand(environment.document));
  assert.deepEqual(lines(harness), ['svg (800x600) *']);
  assert.equal(decorator.decorate(row('a', 'rect'), environment.tree), undefined, 'init clears old ids');

  await executor.execute(new SaveCommand(environment.document, 'empty.svg'));
  assert.deepEqual(lines(harness), ['svg (800x600)']);

  await executor.execute(new ResizeCanvasCommand(environment.document, 100, 200));
  assert.deepEqual(lines(harness), ['svg (100x200) *']);

  await executor.execute(new CreateCommand(environment.editor, 'rect', 'b', ['1', '2', '3', '4']));
  assert.deepEqual(lines(harness), [
    'svg (100x200) *',
    '└── rect#b  x=1 y=2 w=3 h=4 *',
  ]);

  await executor.execute(new ResizeCanvasCommand(environment.document, 400, 300));
  assert.deepEqual(lines(harness), [
    'svg (400x300) *',
    '└── rect#b  x=1 y=2 w=3 h=4 *',
  ]);
});

test('commands that change nothing and commands that fail do not add stars', async () => {
  const harness = createHarness();
  const { environment, decorator, executor } = harness;

  await executor.execute(new InitCommand(environment.document));
  await executor.execute(new CreateCommand(environment.editor, 'rect', 'a', ['1', '2', '3', '4']));
  await executor.execute(new SaveCommand(environment.document, 'drawing.svg'));
  const clean = ['svg (800x600)', '└── rect#a  x=1 y=2 w=3 h=4'];
  assert.deepEqual(lines(harness), clean);

  await executor.execute(new MoveCommand(environment.editor, { id: 'a', dx: 0, dy: 0 }));
  assert.deepEqual(lines(harness), clean, 'a zero move changes no snapshot');
  assert.equal(decorator.decorate(rootRow, environment.tree), undefined);

  await assert.rejects(
    executor.execute(new MoveCommand(environment.editor, { id: 'ghost', dx: 1, dy: 1 })),
    /no such shape: ghost/,
  );
  assert.deepEqual(lines(harness), clean);

  await assert.rejects(
    executor.execute(new SetAttributeCommand(environment.editor, {
      id: 'a', name: 'width', value: '-1', quoted: false,
    })),
    /width must be non-negative/,
  );
  assert.deepEqual(lines(harness), clean);

  await assert.rejects(
    executor.execute(new CreateCommand(environment.editor, 'rect', 'a', ['9', '9', '9', '9'])),
    /id already exists: a/,
  );
  assert.deepEqual(lines(harness), clean);
  assert.equal(decorator.decorate(row('a', 'rect'), environment.tree), undefined);
});
