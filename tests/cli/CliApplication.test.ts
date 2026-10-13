import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CliApplication } from '../../src/cli/CliApplication.js';
import { CommandLineParser } from '../../src/cli/CommandLineParser.js';
import { CliResultRenderer } from '../../src/cli/CliResultRenderer.js';
import { CommandFactory } from '../../src/application/factory/CommandFactory.js';
import { CommandExecutor } from '../../src/application/execution/CommandExecutor.js';
import { ShapeTree } from '../../src/domain/tree/ShapeTree.js';
import { ShapeFactory } from '../../src/domain/factory/ShapeFactory.js';
import { ShapeEditorReceiver } from '../../src/application/receivers/ShapeEditorReceiver.js';
import { DocumentReceiver } from '../../src/application/receivers/DocumentReceiver.js';
import { QueryReceiver } from '../../src/application/receivers/QueryReceiver.js';
import { SvgXmlCodec } from '../../src/infrastructure/svg/SvgXmlCodec.js';
import type { Terminal } from '../../src/application/contracts/Terminal.js';
import type { FileGateway } from '../../src/application/contracts/FileGateway.js';

class ScriptTerminal implements Terminal {
  output: string[]=[]; prompts: string[]=[]; closed=false;
  constructor(private readonly lines: readonly string[]) {}
  async readLine(prompt: string) { this.prompts.push(prompt); return this.lines[this.prompts.length-1]; }
  writeLine(text: string) { this.output.push(text); }
  close() { this.closed=true; }
}
function setup(lines: readonly string[], files: FileGateway = {
  async read() { return '<svg width="10" height="20"><rect width="3" height="4"/></svg>'; },
  async write() {},
}) {
  const tree=new ShapeTree(); const editor=new ShapeEditorReceiver(tree,new ShapeFactory());
  const document=new DocumentReceiver(tree,new SvgXmlCodec(new ShapeFactory()),files); const query=new QueryReceiver(tree);
  const terminal=new ScriptTerminal(lines);
  const app=new CliApplication(terminal,new CommandLineParser(),new CommandFactory(editor,document,query),new CommandExecutor(),new CliResultRenderer(terminal));
  return {tree,terminal,app};
}
test('application displays banner/prompts, skips blank/comments and exits cleanly at EOF', async () => {
  const f=setup(['','# comment','  ','help']); await f.app.run();
  assert.equal(f.terminal.output[0],"svg-editor 0.1 — type 'help' for commands");
  assert.ok(f.terminal.output.includes('undo')); assert.equal(f.terminal.prompts.length,5);
  assert.ok(f.terminal.prompts.every(prompt => prompt==='svg> ')); assert.equal(f.terminal.closed,true);
});
test('application recovers from parser/factory/receiver/history failures and renders each once', async () => {
  const f=setup(['undo','redo','create text bad 1 2 "unfinished','unknown','init','create rect r 1 2 3 4 #abc',
    'move r 2 3','undo','redo','set r width -1','set r fill blue','show r','save','tree']);
  await f.app.run();
  const errors=f.terminal.output.filter(line => line.startsWith('error:'));
  assert.equal(errors.length,6);
  assert.ok(errors[0]!.includes('no document')); assert.ok(errors[1]!.includes('no document'));
  assert.ok(errors.every(line => !/[\r\n]/.test(line)));
  assert.equal(f.tree.findShape('r').getAttribute('x'),'3'); assert.equal(f.tree.findShape('r').getAttribute('width'),'3');
  assert.equal(f.tree.findShape('r').getAttribute('fill'),'blue'); assert.ok(f.terminal.output.includes('rect#r moved to (3,5)'));
  assert.ok(f.terminal.output.some(line => line.includes('rect#r moved back to (1,2)')));
  assert.ok(f.terminal.output.some(line => line.includes('svg (800x600)')));
});
test('application renders read warnings, quoted in text and supported escapes end to end', async () => {
  const f=setup(['read in.svg','create g parent','create text t 1 2 "in" in parent',String.raw`set t text "say \"hi\" and \\ path"`,'show t']);
  await f.app.run(); assert.ok(f.terminal.output.includes('warning: assigned id rect1 to unnamed <rect>'));
  assert.equal(f.tree.findShape('t').getAttribute('text'),'say "hi" and \\ path');
  assert.equal(f.tree.findShape('t').parent,f.tree.findShape('parent'));
  assert.ok(!f.terminal.output.some(line => line.startsWith('error:')));
});
test('application awaits each file operation before reading the next input line', async () => {
  let finish: (() => void) | undefined; let signal: (() => void) | undefined;
  const started=new Promise<void>(resolve => {signal=resolve;});
  const files: FileGateway={async read(){return '';},async write(){signal!();await new Promise<void>(resolve => {finish=resolve;});}};
  const f=setup(['init','create g first','save out.svg','create g after','tree'],files); const running=f.app.run();
  await started; assert.equal(f.terminal.prompts.length,3); assert.throws(() => f.tree.findShape('after'));
  assert.ok(finish); finish(); await running; assert.equal(f.tree.findShape('after').tag,'g');
  assert.ok(f.terminal.output.indexOf('saved to out.svg (1 elements)') < f.terminal.output.indexOf('g#after created'));
  assert.equal(f.terminal.closed,true);
});
test('IO errors with line breaks are rendered once and the next command still runs', async () => {
  const files: FileGateway={async read(){throw new Error('bad\r\nsource');},async write(){throw new Error('bad\nwrite');}};
  const f=setup(['read "bad file.svg"','help','init','save out.svg','create g alive'],files); await f.app.run();
  assert.deepEqual(f.terminal.output.filter(line => line.startsWith('error:')),['error: cannot read file: bad file.svg','error: cannot write file: out.svg']);
  assert.equal(f.tree.findShape('alive').tag,'g');
});
