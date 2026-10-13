import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CommandExecutor } from '../../../src/application/execution/CommandExecutor.js';
import { ShapeTree } from '../../../src/domain/tree/ShapeTree.js';
import { ShapeFactory } from '../../../src/domain/factory/ShapeFactory.js';
import { ShapeEditorReceiver } from '../../../src/application/receivers/ShapeEditorReceiver.js';
import { DocumentReceiver } from '../../../src/application/receivers/DocumentReceiver.js';
import { QueryReceiver } from '../../../src/application/receivers/QueryReceiver.js';
import { SvgXmlCodec } from '../../../src/infrastructure/svg/SvgXmlCodec.js';
import { MoveCommand } from '../../../src/application/commands/editing/MoveCommand.js';
import { CreateCommand } from '../../../src/application/commands/editing/CreateCommand.js';
import { SetAttributeCommand } from '../../../src/application/commands/editing/SetAttributeCommand.js';
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
import type { FileGateway } from '../../../src/application/contracts/FileGateway.js';

class MemoryFiles implements FileGateway {
  files = new Map([['in.svg', '<svg width="50" height="60"><rect id="r" x="1" y="2" width="3" height="4"/></svg>']]);
  failWrite = false;
  async read(path: string) { const text = this.files.get(path); if (text === undefined) throw new Error('missing'); return text; }
  async write(path: string, content: string) { if (this.failWrite) throw new Error('write failed'); this.files.set(path, content); }
}
function setup(initialized = true, files: FileGateway = new MemoryFiles()) {
  const tree = new ShapeTree(); const editor = new ShapeEditorReceiver(tree, new ShapeFactory());
  const document = new DocumentReceiver(tree, new SvgXmlCodec(new ShapeFactory()), files); const query = new QueryReceiver(tree);
  if (initialized) { document.initialize(); editor.create('rect','r',['1','2','3','4']); }
  return { tree, editor, document, query, executor: new CommandExecutor(), files };
}
const undo = () => new UndoCommand(); const redo = () => new RedoCommand();

test('empty history reports direction and failed initial edit leaves both stacks empty', async () => {
  const f = setup(false);
  await assert.rejects(f.executor.execute(undo()), /nothing to undo/);
  await assert.rejects(f.executor.execute(redo()), /nothing to redo/);
  await assert.rejects(f.executor.execute(new MoveCommand(f.editor, {id:'missing',dx:1,dy:2})), /no document/);
  await assert.rejects(f.executor.execute(undo()), /nothing to undo/);
  assert.match((await f.executor.execute(new HelpCommand(f.query))).lines.join('\n'), /create/);
});

test('editing commands use internal LIFO stacks and controls never enter history', async () => {
  const f = setup();
  await f.executor.execute(new MoveCommand(f.editor, { id:'r', dx:3, dy:4 }));
  await f.executor.execute(new SetAttributeCommand(f.editor, { id:'r', name:'fill', value:'red' }));
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
  await f.executor.execute(new MoveCommand(f.editor, {id:'r',dx:3,dy:4})); await f.executor.execute(undo());
  await f.executor.execute(new TreeCommand(f.query)); await f.executor.execute(new ShowCanvasCommand(f.query));
  await f.executor.execute(new HelpCommand(f.query)); await f.executor.execute(redo());
  assert.equal(f.tree.findShape('r').getAttribute('x'), '4'); await f.executor.execute(undo());
  await assert.rejects(f.executor.execute(undo()), /nothing to undo/);
});

test('successful new edit clears redo while failed new edit preserves redo', async () => {
  const f = setup();
  await f.executor.execute(new MoveCommand(f.editor, {id:'r',dx:3,dy:4})); await f.executor.execute(undo());
  await assert.rejects(f.executor.execute(new SetAttributeCommand(f.editor, {id:'r',name:'width',value:'-1'})), /non-negative/);
  await f.executor.execute(redo()); assert.equal(f.tree.findShape('r').getAttribute('x'), '4'); await f.executor.execute(undo());
  await f.executor.execute(new SetAttributeCommand(f.editor, {id:'r',name:'fill',value:'blue'}));
  await assert.rejects(f.executor.execute(redo()), /nothing to redo/); await f.executor.execute(undo());
  assert.equal(f.tree.findShape('r').getAttribute('fill'), undefined);
  await assert.rejects(f.executor.execute(undo()), /nothing to undo/);
});

for (const barrier of ['init','read','save','resize'] as const) test(`successful ${barrier} clears histories and blocks controls until successful editing`, async () => {
  const f = setup();
  await f.executor.execute(new MoveCommand(f.editor, {id:'r',dx:3,dy:4})); await f.executor.execute(undo());
  const command = {
    init: new InitCommand(f.document), read: new ReadCommand(f.document,'in.svg'),
    save: new SaveCommand(f.document,'out.svg'), resize: new ResizeCanvasCommand(f.document,100,200),
  }[barrier];
  await f.executor.execute(command);
  await assert.rejects(f.executor.execute(undo()), {message:'undo not allowed after io command'});
  await assert.rejects(f.executor.execute(redo()), {message:'redo not allowed after io command'});
  await assert.rejects(f.executor.execute(new MoveCommand(f.editor,{id:'missing',dx:1,dy:2})));
  await f.executor.execute(new ShowCanvasCommand(f.query));
  await assert.rejects(f.executor.execute(undo()), /not allowed after io command/);
  await f.executor.execute(new CreateCommand(f.editor,'g','new',[])); await f.executor.execute(undo());
  assert.throws(() => f.tree.findShape('new'));
  await assert.rejects(f.executor.execute(undo()), /nothing to undo/);
  await f.executor.execute(redo()); assert.equal(f.tree.findShape('new').tag,'g');
});

test('failed document commands preserve association and both histories', async () => {
  const files = new MemoryFiles(); const f = setup(true,files); await f.document.save('original.svg');
  await f.executor.execute(new MoveCommand(f.editor,{id:'r',dx:3,dy:4}));
  await assert.rejects(f.executor.execute(new ReadCommand(f.document,'missing.svg')), /cannot read file/);
  files.failWrite = true; await assert.rejects(f.executor.execute(new SaveCommand(f.document,'bad.svg')), /cannot write file/);
  await assert.rejects(f.executor.execute(new ResizeCanvasCommand(f.document,0,1)));
  await assert.rejects(f.executor.execute(new InitCommand(f.document,0,1)));
  assert.equal(f.document.associatedPath,'original.svg'); await f.executor.execute(undo());
  assert.equal(f.tree.findShape('r').getAttribute('x'),'1');
  await assert.rejects(f.executor.execute(new SaveCommand(f.document,'other.svg')));
  await assert.rejects(f.executor.execute(new ReadCommand(f.document,'missing.svg')));
  await f.executor.execute(redo()); assert.equal(f.tree.findShape('r').getAttribute('x'),'4');
  files.failWrite = false; await f.executor.execute(new SaveCommand(f.document,'saved.svg'));
  assert.equal(f.document.associatedPath,'saved.svg'); await assert.rejects(f.executor.execute(undo()), /not allowed/);
});

class FallibleMove extends MoveCommand {
  failUndo = true; failRedo = true;
  override undo() { if(this.failUndo) throw new Error('undo failed'); return super.undo(); }
  override redo() { if(this.failRedo) throw new Error('redo failed'); return super.redo(); }
}
test('failed target undo/redo remains on its original stack and can be retried', async () => {
  const f = setup(); const command = new FallibleMove(f.editor,{id:'r',dx:3,dy:4});
  await f.executor.execute(command); await assert.rejects(f.executor.execute(undo()), /undo failed/);
  assert.equal(f.tree.findShape('r').getAttribute('x'),'4'); command.failUndo=false; await f.executor.execute(undo());
  assert.equal(f.tree.findShape('r').getAttribute('x'),'1'); await assert.rejects(f.executor.execute(redo()), /redo failed/);
  assert.equal(f.tree.findShape('r').getAttribute('x'),'1'); command.failRedo=false; await f.executor.execute(redo());
  assert.equal(f.tree.findShape('r').getAttribute('x'),'4'); await assert.rejects(f.executor.execute(redo()), /nothing to redo/);
});

test('executor waits for asynchronous document completion before returning and establishing barrier', async () => {
  let finish: (() => void) | undefined;
  const files: FileGateway = { async read() { return ''; }, async write() { await new Promise<void>(resolve => {finish=resolve;}); } };
  const f=setup(true,files); await f.executor.execute(new MoveCommand(f.editor,{id:'r',dx:3,dy:4}));
  let completed=false; const pending=f.executor.execute(new SaveCommand(f.document,'out.svg')).then(() => {completed=true;});
  await Promise.resolve(); assert.equal(completed,false); assert.equal(f.document.associatedPath,undefined);
  assert.ok(finish); finish(); await pending; assert.equal(completed,true); assert.equal(f.document.associatedPath,'out.svg');
  await assert.rejects(f.executor.execute(undo()), /not allowed after io command/);
});

class AsyncUndo extends HistoryControlCommand {
  getDirection(): 'undo' { return 'undo'; }
  async execute(target: UndoableCommand) { await Promise.resolve(); return target.undo(); }
}
test('executor passes the current target through abstract controls and awaits their results', async () => {
  const f=setup(); await f.executor.execute(new MoveCommand(f.editor,{id:'r',dx:3,dy:4}));
  const result=await f.executor.execute(new AsyncUndo()); assert.deepEqual(result.lines,['rect#r moved back to (1,2)']);
  await f.executor.execute(redo()); assert.equal(f.tree.findShape('r').getAttribute('x'),'4');
});
