import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CommandExecutor } from '../../../src/application/execution/CommandExecutor.js';
import { MoveCommand } from '../../../src/application/commands/editing/MoveCommand.js';
import { CreateCommand } from '../../../src/application/commands/editing/CreateCommand.js';
import { DeleteCommand } from '../../../src/application/commands/editing/DeleteCommand.js';
import { SetAttributeCommand } from '../../../src/application/commands/editing/SetAttributeCommand.js';
import { ScaleCommand } from '../../../src/application/commands/editing/ScaleCommand.js';
import { AddToCommand } from '../../../src/application/commands/editing/AddToCommand.js';
import { InitCommand } from '../../../src/application/commands/document/InitCommand.js';
import { ReadCommand } from '../../../src/application/commands/document/ReadCommand.js';
import { SaveCommand } from '../../../src/application/commands/document/SaveCommand.js';
import { ResizeCanvasCommand } from '../../../src/application/commands/document/ResizeCanvasCommand.js';
import { TreeCommand } from '../../../src/application/commands/query/TreeCommand.js';
import { HelpCommand } from '../../../src/application/commands/query/HelpCommand.js';
import { ShowCanvasCommand } from '../../../src/application/commands/query/ShowCanvasCommand.js';
import { UndoCommand } from '../../../src/application/commands/history/UndoCommand.js';
import { RedoCommand } from '../../../src/application/commands/history/RedoCommand.js';
import { HistoryControlCommand } from '../../../src/application/commands/base/HistoryControlCommand.js';
import type { UndoableCommand } from '../../../src/application/commands/base/UndoableCommand.js';
import type { CommandResult } from '../../../src/application/contracts/CommandResult.js';
import type { DocumentEvent, DocumentObserver } from '../../../src/application/contracts/DocumentEvent.js';
import type { FileGateway } from '../../../src/application/contracts/FileGateway.js';
import { ShapeProvider } from '../../../src/domain/shapes/ShapeProvider.js';
import { ChildCollection } from '../../../src/domain/tree/ChildCollection.js';
import type { ShapeContainer } from '../../../src/domain/tree/ShapeContainer.js';
import { AttributeHandler } from '../../../src/application/attributes/AttributeHandler.js';
import type { AttributeOutcome } from '../../../src/application/attributes/AttributeOutcome.js';
import type { AttributeEditRequest } from '../../../src/application/contracts/AttributeEditParameters.js';
import type { AttributeTransaction } from '../../../src/application/attributes/AttributeTransaction.js';
import type { ReadonlyShape } from '../../../src/application/attributes/ReadonlyShape.js';
import { createHelpCommands, createReceiverEnvironment, MemoryFiles, type ReceiverEnvironment } from '../../helpers/builtins.js';

class RecordingObserver implements DocumentObserver {
  readonly events: DocumentEvent[] = [];
  onCommitted(event: DocumentEvent): void { this.events.push(event); }
}

interface Fixture extends ReceiverEnvironment {
  readonly executor: CommandExecutor;
  readonly observer: RecordingObserver;
}

function setup(
  initialized = true,
  files: FileGateway = new MemoryFiles(),
  observer = new RecordingObserver(),
  handlers: readonly (readonly [string, AttributeHandler])[] = [],
): Fixture {
  const env = createReceiverEnvironment({ initialized, files, commands: createHelpCommands(), handlers });
  return { ...env, executor: new CommandExecutor(observer), observer };
}

const undo = () => new UndoCommand();
const redo = () => new RedoCommand();

test('history controls require a document and failed initial edit does not establish one', async () => {
  const f = setup(false);
  await assert.rejects(f.executor.execute(undo()), /no document\. use 'init' or 'read' first/);
  await assert.rejects(f.executor.execute(redo()), /no document\. use 'init' or 'read' first/);
  await assert.rejects(f.executor.execute(new MoveCommand(f.editor, { id: 'missing', dx: 1, dy: 2 })), /no document/);
  await assert.rejects(f.executor.execute(undo()), /no document\. use 'init' or 'read' first/);
  assert.match((await f.executor.execute(new HelpCommand(f.query))).lines.join('\n'), /create/);
});

test('editing commands use internal LIFO stacks and controls never enter history', async () => {
  const f = setup();
  await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 }));
  await f.executor.execute(new SetAttributeCommand(f.editor, { id: 'r', name: 'fill', value: 'red', quoted: false }));
  await f.executor.execute(undo()); assert.equal(f.tree.findShape('r').getAttribute('fill'), undefined);
  await f.executor.execute(undo()); assert.equal(f.tree.findShape('r').getAttribute('x'), '1');
  await assert.rejects(f.executor.execute(undo()), /nothing to undo/);
  await f.executor.execute(redo()); assert.equal(f.tree.findShape('r').getAttribute('x'), '4');
  await f.executor.execute(redo()); assert.equal(f.tree.findShape('r').getAttribute('fill'), 'red');
  await assert.rejects(f.executor.execute(redo()), /nothing to redo/);
  await f.executor.execute(undo()); await f.executor.execute(undo());
  await assert.rejects(f.executor.execute(undo()), /nothing to undo/);
});

test('queries leave both undo and redo histories intact, including canvas display', async () => {
  const f = setup();
  await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 })); await f.executor.execute(undo());
  await f.executor.execute(new TreeCommand(f.query)); await f.executor.execute(new ShowCanvasCommand(f.query));
  await f.executor.execute(new HelpCommand(f.query)); await f.executor.execute(redo());
  assert.equal(f.tree.findShape('r').getAttribute('x'), '4'); await f.executor.execute(undo());
  await assert.rejects(f.executor.execute(undo()), /nothing to undo/);
});

test('successful new edit clears redo while failed new edit preserves redo', async () => {
  const f = setup();
  await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 })); await f.executor.execute(undo());
  await assert.rejects(f.executor.execute(new SetAttributeCommand(f.editor, { id: 'r', name: 'width', value: '-1', quoted: false })), /non-negative/);
  await f.executor.execute(redo()); assert.equal(f.tree.findShape('r').getAttribute('x'), '4'); await f.executor.execute(undo());
  await f.executor.execute(new SetAttributeCommand(f.editor, { id: 'r', name: 'fill', value: 'blue', quoted: false }));
  await assert.rejects(f.executor.execute(redo()), /nothing to redo/); await f.executor.execute(undo());
  assert.equal(f.tree.findShape('r').getAttribute('fill'), undefined);
  await assert.rejects(f.executor.execute(undo()), /nothing to undo/);
});

for (const barrier of ['init', 'read', 'save', 'resize'] as const) test(`successful ${barrier} clears histories and blocks controls until successful editing`, async () => {
  const files = new MemoryFiles(new Map([['in.svg', '<svg width="50" height="60"><rect id="imported" x="1" y="2" width="3" height="4"/></svg>']]));
  const f = setup(true, files);
  await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 }));
  await f.executor.execute(undo());
  const command = {
    init: new InitCommand(f.document), read: new ReadCommand(f.document, 'in.svg'),
    save: new SaveCommand(f.document, 'out.svg'), resize: new ResizeCanvasCommand(f.document, 100, 200),
  }[barrier];
  await f.executor.execute(command);
  await assert.rejects(f.executor.execute(undo()), { message: 'undo not allowed after io command' });
  await assert.rejects(f.executor.execute(redo()), { message: 'redo not allowed after io command' });
  await assert.rejects(f.executor.execute(new MoveCommand(f.editor, { id: 'missing', dx: 1, dy: 2 })));
  await f.executor.execute(new ShowCanvasCommand(f.query));
  await assert.rejects(f.executor.execute(undo()), /not allowed after io command/);
  await f.executor.execute(new CreateCommand(f.editor, 'g', 'new', [])); await f.executor.execute(undo());
  assert.throws(() => f.tree.findShape('new'));
  await assert.rejects(f.executor.execute(undo()), /nothing to undo/);
  await f.executor.execute(redo()); assert.equal(f.tree.findShape('new').tag, 'g');
});

test('failed document commands preserve association and both histories', async () => {
  const files = new MemoryFiles(); const f = setup(true, files); await f.document.save('original.svg');
  await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 }));
  await assert.rejects(f.executor.execute(new ReadCommand(f.document, 'missing.svg')), /cannot read file/);
  files.failWrite = true; await assert.rejects(f.executor.execute(new SaveCommand(f.document, 'bad.svg')), /cannot write file/);
  await assert.rejects(f.executor.execute(new ResizeCanvasCommand(f.document, 100, 0)));
  await assert.rejects(f.executor.execute(new InitCommand(f.document, 0, 1)));
  assert.equal(f.document.associatedPath, 'original.svg'); await f.executor.execute(undo());
  assert.equal(f.tree.findShape('r').getAttribute('x'), '1');
  await assert.rejects(f.executor.execute(new SaveCommand(f.document, 'other.svg')));
  await assert.rejects(f.executor.execute(new ReadCommand(f.document, 'missing.svg')));
  await f.executor.execute(redo()); assert.equal(f.tree.findShape('r').getAttribute('x'), '4');
  files.failWrite = false; await f.executor.execute(new SaveCommand(f.document, 'saved.svg'));
  assert.equal(f.document.associatedPath, 'saved.svg'); await assert.rejects(f.executor.execute(undo()), /not allowed/);
});

class FallibleMove extends MoveCommand {
  failUndo = true; failRedo = true;
  override undo() { if (this.failUndo) throw new Error('undo failed'); return super.undo(); }
  override redo() { if (this.failRedo) throw new Error('redo failed'); return super.redo(); }
}
test('failed target undo/redo remains on its original stack and can be retried', async () => {
  const f = setup(); const command = new FallibleMove(f.editor, { id: 'r', dx: 3, dy: 4 });
  await f.executor.execute(command); await assert.rejects(f.executor.execute(undo()), /undo failed/);
  assert.equal(f.tree.findShape('r').getAttribute('x'), '4'); command.failUndo = false; await f.executor.execute(undo());
  assert.equal(f.tree.findShape('r').getAttribute('x'), '1'); await assert.rejects(f.executor.execute(redo()), /redo failed/);
  assert.equal(f.tree.findShape('r').getAttribute('x'), '1'); command.failRedo = false; await f.executor.execute(redo());
  assert.equal(f.tree.findShape('r').getAttribute('x'), '4'); await assert.rejects(f.executor.execute(redo()), /nothing to redo/);
});

test('executor waits for asynchronous document completion before returning and establishing barrier', async () => {
  let finish: (() => void) | undefined;
  const files: FileGateway = { async read() { return ''; }, async write() { await new Promise<void>(resolve => { finish = resolve; }); } };
  const f = setup(true, files); await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 }));
  let completed = false; const pending = f.executor.execute(new SaveCommand(f.document, 'out.svg')).then(() => { completed = true; });
  await Promise.resolve(); assert.equal(completed, false); assert.equal(f.document.associatedPath, undefined);
  assert.ok(finish); finish(); await pending; assert.equal(completed, true); assert.equal(f.document.associatedPath, 'out.svg');
  await assert.rejects(f.executor.execute(undo()), /not allowed after io command/);
});

class AsyncUndo extends HistoryControlCommand {
  getDirection(): 'undo' { return 'undo'; }
  async execute(target: UndoableCommand): Promise<CommandResult> { await Promise.resolve(); return target.undo(); }
}
test('executor passes the current target through abstract controls and awaits their results', async () => {
  const f = setup(); await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 }));
  const result = await f.executor.execute(new AsyncUndo()); assert.deepEqual(result.lines, ['rect#r moved back to (1,2)']);
  await f.executor.execute(redo()); assert.equal(f.tree.findShape('r').getAttribute('x'), '4');
});

test('nonreversible finite numeric edits fail without changing document or undo/redo history', async () => {
  const f = setup(); f.editor.create('circle', 'tiny', ['0', '0', '1e-300']);
  await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 }));
  await assert.rejects(f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 1e20, dy: 0 })), /reversible|precision/);
  await assert.rejects(f.executor.execute(new ScaleCommand(f.editor, { id: 'tiny', factor: 1e-100 })), /reversible|precision/);
  assert.equal(f.tree.findShape('r').getAttribute('x'), '4'); assert.equal(f.tree.findShape('tiny').getAttribute('r'), '1e-300');
  await f.executor.execute(undo()); assert.equal(f.tree.findShape('r').getAttribute('x'), '1');
  await assert.rejects(f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 1e20, dy: 0 })), /reversible|precision/);
  await f.executor.execute(redo()); assert.equal(f.tree.findShape('r').getAttribute('x'), '4');
});

test('a successful undoable command notifies edited with before/after snapshots', async () => {
  const f = setup();
  await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 }));
  assert.equal(f.observer.events.length, 1);
  const event = f.observer.events[0]!;
  assert.equal(event.kind, 'edited');
  const before = event.before.get('r'); const after = event.after.get('r');
  assert.ok(before); assert.ok(after);
  assert.equal(before.tag, 'rect'); assert.equal(after.tag, 'rect');
  assert.equal(before.parentId, undefined); assert.equal(after.parentId, undefined);
  assert.deepEqual(before.childrenIds, []); assert.deepEqual(after.childrenIds, []);
  assert.notEqual(before.content, after.content);
  assert.match(after.content, /4/);
  assert.match(before.content, /1/);
});

test('create and delete snapshots describe the structural change', async () => {
  const created = setup();
  await created.executor.execute(new CreateCommand(created.editor, 'g', 'g', []));
  const createEvent = created.observer.events.at(-1)!;
  assert.equal(createEvent.kind, 'edited');
  assert.equal(createEvent.before.has('g'), false);
  assert.equal(createEvent.after.get('g')?.tag, 'g');
  assert.equal(createEvent.after.get('g')?.parentId, undefined);

  const deleted = setup();
  await deleted.executor.execute(new DeleteCommand(deleted.editor, 'r'));
  const deleteEvent = deleted.observer.events.at(-1)!;
  assert.equal(deleteEvent.before.has('r'), true);
  assert.equal(deleteEvent.after.has('r'), false);
});

test('failed undoable commands and all queries do not notify observers', async () => {
  const f = setup();
  await assert.rejects(f.executor.execute(new MoveCommand(f.editor, { id: 'missing', dx: 1, dy: 2 })));
  assert.equal(f.observer.events.length, 0);
  await f.executor.execute(new TreeCommand(f.query));
  await f.executor.execute(new HelpCommand(f.query));
  await f.executor.execute(new ShowCanvasCommand(f.query));
  assert.equal(f.observer.events.length, 0);
});

test('queries do not collect snapshots through the public shape rendering surface', async () => {
  class UnsnapshotableShape extends ShapeProvider {
    constructor(id: string) { super(id, {}); }
    get tag() { return 'unsnapshotable'; }
    override describe(): never { throw new Error('query must not describe shapes for a snapshot'); }
    override toSvgElement(): never { throw new Error('query must not serialize shapes for a snapshot'); }
    override getAttribute(): never { throw new Error('query must not read shape attributes for a snapshot'); }
    protected get xKeys() { return []; }
    protected get yKeys() { return []; }
  }
  const f = setup();
  f.tree.editStructure({ placements: [{ shape: new UnsnapshotableShape('probe'), parent: f.tree.root, index: 1 }] });
  const result = await f.executor.execute(new ShowCanvasCommand(f.query));
  assert.deepEqual(result.lines, ['canvas 800x600']);
  assert.equal(f.observer.events.length, 0);
});

test('successful undo/redo notify history with the same before/after snapshot contract', async () => {
  const f = setup();
  await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 }));
  assert.equal(f.observer.events.length, 1);
  await f.executor.execute(undo());
  assert.equal(f.observer.events.length, 2);
  const undoEvent = f.observer.events[1]!;
  assert.equal(undoEvent.kind, 'history');
  assert.match(undoEvent.before.get('r')!.content, /4/);
  assert.match(undoEvent.after.get('r')!.content, /1/);
  await f.executor.execute(redo());
  assert.equal(f.observer.events.length, 3);
  assert.equal(f.observer.events[2]!.kind, 'history');
  assert.match(f.observer.events[2]!.before.get('r')!.content, /1/);
  assert.match(f.observer.events[2]!.after.get('r')!.content, /4/);
});

test('failed history controls notify nothing', async () => {
  const f = setup();
  await assert.rejects(f.executor.execute(undo()), /nothing to undo/);
  await assert.rejects(f.executor.execute(redo()), /nothing to redo/);
  assert.equal(f.observer.events.length, 0);
});

test('barrier commands notify their explicit document event kind', async () => {
  const files = new MemoryFiles(new Map([['in.svg', '<svg width="50" height="60"><rect id="imported" width="1" height="1"/></svg>']]));
  const f = setup(true, files);
  await f.executor.execute(new ReadCommand(f.document, 'in.svg'));
  assert.equal(f.observer.events.at(-1)?.kind, 'replaced');
  await f.executor.execute(new SaveCommand(f.document, 'out.svg'));
  assert.equal(f.observer.events.at(-1)?.kind, 'saved');
  await f.executor.execute(new ResizeCanvasCommand(f.document, 100, 200));
  assert.equal(f.observer.events.at(-1)?.kind, 'resized');

  const init = setup(false);
  await init.executor.execute(new InitCommand(init.document));
  assert.equal(init.observer.events.at(-1)?.kind, 'initialized');
});

test('failed barrier commands notify nothing and preserve history', async () => {
  const files = new MemoryFiles(); files.failWrite = true;
  const f = setup(true, files);
  await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 }));
  const before = f.observer.events.length;
  await assert.rejects(f.executor.execute(new SaveCommand(f.document, 'bad.svg')), /cannot write file/);
  assert.equal(f.observer.events.length, before);
  await f.executor.execute(undo());
  assert.equal(f.tree.findShape('r').getAttribute('x'), '1');
});

test('observer exceptions never change command results, history movement or barrier semantics', async () => {
  const throwing: DocumentObserver = { onCommitted() { throw new Error('observer failed'); } };
  const f = setup(true, new MemoryFiles(), throwing);
  const result = await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 }));
  assert.deepEqual(result.lines, ['rect#r moved to (4,6)']);
  await f.executor.execute(undo());
  assert.equal(f.tree.findShape('r').getAttribute('x'), '1');
  await f.executor.execute(redo());
  assert.equal(f.tree.findShape('r').getAttribute('x'), '4');
  await f.executor.execute(new SaveCommand(f.document, 'out.svg'));
  await assert.rejects(f.executor.execute(undo()), /not allowed after io command/);
});

test('an attribute handler failure keeps the document, history and observer state unchanged', async () => {
  class ExplodingAttributeHandler extends AttributeHandler {
    readonly name = 'exploding-attribute';
    handles(target: ReadonlyShape, attr: string): boolean { return target.id === 'r' && attr === 'fill'; }
    apply(_target: ReadonlyShape, _request: AttributeEditRequest, transaction: AttributeTransaction): AttributeOutcome {
      transaction.setAttribute('r', 'fill', 'broken');
      throw new Error('attribute exploded');
    }
  }
  const f = setup(true, new MemoryFiles(), new RecordingObserver(), [
    ['exploding-attribute', new ExplodingAttributeHandler()],
  ]);
  await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 }));
  const notifications = f.observer.events.length;
  await assert.rejects(
    f.executor.execute(new SetAttributeCommand(f.editor, { id: 'r', name: 'fill', value: 'red', quoted: false })),
    /attribute exploded/,
  );
  assert.equal(f.observer.events.length, notifications);
  assert.equal(f.tree.findShape('r').getAttribute('fill'), undefined);
  await f.executor.execute(undo());
  assert.equal(f.tree.findShape('r').getAttribute('x'), '1');
  await f.executor.execute(redo());
  assert.equal(f.tree.findShape('r').getAttribute('x'), '4');
});

test('structure validation failure leaves the tree and undo/redo history unchanged', async () => {
  const f = setup();
  class Guarded extends ShapeProvider implements ShapeContainer {
    fail = false;
    readonly #children = new ChildCollection(this);
    constructor(id: string) { super(id, {}); }
    get tag() { return 'guarded'; }
    get children() { return this.#children; }
    override asContainer() { return this; }
    override validateStructure() { if (this.fail) throw new Error('structure rejected'); }
    protected get xKeys() { return []; }
    protected get yKeys() { return []; }
  }
  const guard = new Guarded('guard');
  f.tree.editStructure({ placements: [{ shape: guard, parent: f.tree.root, index: 1 }] });
  await f.executor.execute(new MoveCommand(f.editor, { id: 'r', dx: 3, dy: 4 }));
  guard.fail = true;
  await assert.rejects(f.executor.execute(new AddToCommand(f.editor, 'guard', 'r')), /structure rejected/);
  assert.equal(f.tree.findShape('guard').parent, f.tree.root);
  assert.equal(f.tree.findShape('r').parent, f.tree.root);
  await f.executor.execute(undo());
  assert.equal(f.tree.findShape('r').getAttribute('x'), '1');
  await f.executor.execute(redo());
  assert.equal(f.tree.findShape('r').getAttribute('x'), '4');
});
