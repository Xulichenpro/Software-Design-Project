import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryCommand } from '../../../src/extension-api/index.js';
import type { DocumentEvent, DocumentObserver } from '../../../src/extension-api/index.js';
import { CommandExecutor } from '../../../src/application/execution/CommandExecutor.js';
import { UndoCommand } from '../../../src/application/commands/history/UndoCommand.js';
import { RedoCommand } from '../../../src/application/commands/history/RedoCommand.js';
import { DirCommand } from '../../../plugins/dir/src/DirCommand.js';
import {
  ExistingDocument, FakeDirectoryReader, ProbeEditCommand, entries,
} from './fixtures.js';

class RecordingObserver implements DocumentObserver {
  readonly events: DocumentEvent[] = [];
  onCommitted(event: DocumentEvent): void { this.events.push(event); }
}

test('dir prints directories first and files second with two spaces after each marker', async () => {
  const reader = new FakeDirectoryReader('C:\\work', entries(
    ['zeta.svg', 'file'],
    ['docs', 'directory'],
    ['.hidden', 'file'],
    ['assets', 'directory'],
    ['demo.svg', 'file'],
    ['Plugins', 'directory'],
  ));
  const command = new DirCommand(reader);
  assert.ok(command instanceof QueryCommand);
  const result = await command.execute();
  assert.deepEqual(result.lines, [
    '[DIR]  Plugins',
    '[DIR]  assets',
    '[DIR]  docs',
    '[FILE]  .hidden',
    '[FILE]  demo.svg',
    '[FILE]  zeta.svg',
  ]);
  assert.deepEqual(reader.requested, ['C:\\work']);
});

test('dir reports an empty directory with the fixed placeholder', async () => {
  const result = await new DirCommand(new FakeDirectoryReader('C:\\empty', entries())).execute();
  assert.deepEqual(result.lines, ['(empty directory)']);
});

test('dir maps a reader failure to cannot read directory with the requested path', async () => {
  const reader = new FakeDirectoryReader('C:\\missing', new Error('ENOENT'));
  await assert.rejects(async () => { await new DirCommand(reader).execute(); }, {
    message: 'cannot read directory: C:\\missing',
  });
});

test('dir output is stable for the same set of entries regardless of readdir order', async () => {
  const first = new FakeDirectoryReader('C:\\same', entries(
    ['b.svg', 'file'], ['alpha', 'directory'], ['a.svg', 'file'], ['beta', 'directory'],
  ));
  const second = new FakeDirectoryReader('C:\\same', entries(
    ['beta', 'directory'], ['a.svg', 'file'], ['b.svg', 'file'], ['alpha', 'directory'],
  ));
  const expected = await new DirCommand(first).execute();
  const reordered = await new DirCommand(second).execute();
  assert.deepEqual(reordered.lines, expected.lines);
  assert.deepEqual((await new DirCommand(first).execute()).lines, expected.lines);
  assert.deepEqual(expected.lines, [
    '[DIR]  alpha', '[DIR]  beta', '[FILE]  a.svg', '[FILE]  b.svg',
  ]);
});

test('symbolic links and special entries reported as files use the FILE marker', async () => {
  const reader = new FakeDirectoryReader('/work', entries(
    ['docs-link', 'file'], ['docs', 'directory'], ['fifo', 'file'],
  ));
  const result = await new DirCommand(reader).execute();
  assert.deepEqual(result.lines, [
    '[DIR]  docs', '[FILE]  docs-link', '[FILE]  fifo',
  ]);
});

test('dir works without a document because it is a query command', async () => {
  const executor = new CommandExecutor();
  const result = await executor.execute(new DirCommand(new FakeDirectoryReader('.', entries(['demo.svg', 'file']))));
  assert.deepEqual(result.lines, ['[FILE]  demo.svg']);
});

test('a successful dir leaves an initialized document, both history stacks and observers untouched', async () => {
  const document = new ExistingDocument();
  const observer = new RecordingObserver();
  const executor = new CommandExecutor(observer, document);
  const replayLog: string[] = [];
  const rootChildrenBefore = [...document.root.children.items];
  await executor.execute(new ProbeEditCommand(replayLog));
  assert.equal(observer.events.length, 1);

  const result = await executor.execute(new DirCommand(new FakeDirectoryReader('C:\\work', entries(
    ['docs', 'directory'], ['demo.svg', 'file'],
  ))));
  assert.deepEqual(result.lines, ['[DIR]  docs', '[FILE]  demo.svg']);
  assert.equal(observer.events.length, 1);
  assert.deepEqual(document.root.children.items, rootChildrenBefore);
  assert.deepEqual(replayLog, []);

  await executor.execute(new UndoCommand());
  assert.deepEqual(replayLog, ['undo']);
  await executor.execute(new RedoCommand());
  assert.deepEqual(replayLog, ['undo', 'redo']);
});

test('a failing dir leaves an initialized document, both history stacks and observers untouched', async () => {
  const document = new ExistingDocument();
  const observer = new RecordingObserver();
  const executor = new CommandExecutor(observer, document);
  const replayLog: string[] = [];
  await executor.execute(new ProbeEditCommand(replayLog));
  assert.equal(observer.events.length, 1);

  await assert.rejects(
    executor.execute(new DirCommand(new FakeDirectoryReader('C:\\missing', new Error('ENOENT')))),
    { message: 'cannot read directory: C:\\missing' },
  );
  assert.equal(observer.events.length, 1);
  assert.deepEqual(replayLog, []);

  await executor.execute(new UndoCommand());
  assert.deepEqual(replayLog, ['undo']);
  await executor.execute(new RedoCommand());
  assert.deepEqual(replayLog, ['undo', 'redo']);
});
