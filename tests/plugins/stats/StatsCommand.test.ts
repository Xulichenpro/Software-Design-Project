import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryCommand } from '../../../src/extension-api/index.js';
import type { DocumentObserver, DocumentEvent } from '../../../src/extension-api/index.js';
import { CommandExecutor } from '../../../src/application/execution/CommandExecutor.js';
import { UndoCommand } from '../../../src/application/commands/history/UndoCommand.js';
import { RedoCommand } from '../../../src/application/commands/history/RedoCommand.js';
import { StatsCommand } from '../../../plugins/stats/src/StatsCommand.js';
import {
  ProbeEditCommand, TestContainer, TestDocument, TestRoot, container, documentWith, leaf,
} from './fixtures.js';

class RecordingObserver implements DocumentObserver {
  readonly events: DocumentEvent[] = [];
  onCommitted(event: DocumentEvent): void { this.events.push(event); }
}

test('stats is a query command and empty documents report zero totals', async () => {
  const command = new StatsCommand(new TestDocument());
  assert.ok(command instanceof QueryCommand);
  const result = await command.execute();
  assert.deepEqual(result.lines, ['(total 0, containers 0)']);
});

test('stats counts leaves of every kind, counts containers separately and never the root', async () => {
  // root
  // ├── rect r1
  // ├── g g1 { rect r2, circle c1, text t1 }
  // └── g g2 { text t2, rect r3 }
  // DFS leaf-kind first occurrence order: rect, circle, text.
  const document = documentWith(
    leaf('rect', 'r1'),
    container('g1', leaf('rect', 'r2'), leaf('circle', 'c1'), leaf('text', 't1')),
    container('g2', leaf('text', 't2'), leaf('rect', 'r3')),
  );
  const result = await new StatsCommand(document).execute();
  assert.deepEqual(result.lines, ['rect: 3  circle: 1  text: 2  (total 6, containers 2)']);
});

test('stats follows depth-first child order and keeps the first occurrence order of kinds', async () => {
  // root: text t1, rect r1, g g1 { circle c1, text t2 }, rect r2
  const document = documentWith(
    leaf('text', 't1'),
    leaf('rect', 'r1'),
    container('g1', leaf('circle', 'c1'), leaf('text', 't2')),
    leaf('rect', 'r2'),
  );
  const result = await new StatsCommand(document).execute();
  assert.deepEqual(result.lines, ['text: 2  rect: 2  circle: 1  (total 5, containers 1)']);
});

test('empty groups count as containers but contribute no leaves', async () => {
  const document = documentWith(container('empty'));
  const result = await new StatsCommand(document).execute();
  assert.deepEqual(result.lines, ['(total 0, containers 1)']);
});

test('nested containers are counted once each while their leaves are counted recursively', async () => {
  // root -> g outer -> g inner -> rect, then text; plus circle at root.
  const document = documentWith(
    container('outer', container('inner', leaf('rect', 'deep')), leaf('text', 'sibling')),
    leaf('circle', 'top'),
  );
  const result = await new StatsCommand(document).execute();
  assert.deepEqual(result.lines, ['rect: 1  text: 1  circle: 1  (total 3, containers 2)']);
});

test('stats requires an initialized document', async () => {
  const document = documentWith(leaf('rect', 'r'));
  document.initialized = false;
  const command = new StatsCommand(document);
  await assert.rejects(async () => { await command.execute(); }, {
    message: "no document. use 'init' or 'read' first",
  });
});

test('stats neither changes the document nor the undo/redo history and emits no event', async () => {
  const document = documentWith(
    leaf('rect', 'r'),
    container('g', leaf('circle', 'c'), leaf('text', 't')),
  );
  const observer = new RecordingObserver();
  const executor = new CommandExecutor(observer, document);
  const replayLog: string[] = [];
  await executor.execute(new ProbeEditCommand(replayLog));
  assert.equal(observer.events.length, 1);

  const beforeKinds = document.root.children.items.map(shape => `${shape.kind}#${shape.id}`);
  const result = await executor.execute(new StatsCommand(document));
  assert.deepEqual(result.lines, ['rect: 1  circle: 1  text: 1  (total 3, containers 1)']);
  assert.equal(observer.events.length, 1);
  assert.deepEqual(document.root.children.items.map(shape => `${shape.kind}#${shape.id}`), beforeKinds);
  assert.deepEqual(replayLog, []);

  await executor.execute(new UndoCommand());
  assert.deepEqual(replayLog, ['undo']);
  await executor.execute(new RedoCommand());
  assert.deepEqual(replayLog, ['undo', 'redo']);
  await executor.execute(new UndoCommand());
  assert.deepEqual(replayLog, ['undo', 'redo', 'undo']);
  await assert.rejects(executor.execute(new UndoCommand()), /nothing to undo/);
});

test('a container with a non-g kind is still counted as a container through asContainer', async () => {
  const box = new TestContainer('n1', 'box').add(leaf('rect', 'n1-rect'), leaf('text', 'n1-label'));
  const document = new TestDocument(new TestRoot().add(leaf('rect', 'top'), box));
  const result = await new StatsCommand(document).execute();
  assert.deepEqual(result.lines, ['rect: 2  text: 1  (total 3, containers 1)']);
});
