import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TreeDecorator } from '../../../src/application/tree/TreeDecorator.js';
import type { TreeRow } from '../../../src/application/tree/TreeRow.js';
import { TreeDecoratorRegistry } from '../../../src/application/registries/TreeDecoratorRegistry.js';
import type { DocumentEvent, DocumentObserver } from '../../../src/application/contracts/DocumentEvent.js';
import type { DocumentView } from '../../../src/application/contracts/DocumentView.js';

class ProbeDecorator extends TreeDecorator {
  readonly name: string;
  readonly suffix: string | undefined;
  readonly seen: TreeRow[] = [];
  committed: DocumentEvent[] = [];
  failCommit = false;
  constructor(name: string, suffix: string | undefined) { super(); this.name = name; this.suffix = suffix; }
  override onCommitted(event: DocumentEvent) {
    this.committed.push(event);
    if (this.failCommit) throw new Error(`commit failed: ${this.name}`);
  }
  decorate(row: TreeRow, _document: DocumentView): string | undefined {
    this.seen.push(row);
    return this.suffix;
  }
}

const row: TreeRow = { id: 'r', kind: 'rect', isRoot: false, base: 'rect#r' };
const view = {} as DocumentView;
const event: DocumentEvent = {
  kind: 'edited',
  before: new Map(),
  after: new Map(),
};

function registryWith(entries: readonly (readonly [string, TreeDecorator])[]): TreeDecoratorRegistry {
  const registry = new TreeDecoratorRegistry();
  registry.install(new Map(), new Map(entries));
  return registry;
}

test('TreeDecoratorRegistry exposes decorators in registration order and filters empty suffixes', () => {
  const first = new ProbeDecorator('first', '*');
  const empty = new ProbeDecorator('empty', '');
  const absent = new ProbeDecorator('absent', undefined);
  const last = new ProbeDecorator('last', '(box)');
  const registry = registryWith([['first', first], ['empty', empty], ['absent', absent], ['last', last]]);
  assert.deepEqual(registry.values(), [first, empty, absent, last]);
  assert.equal(registry.get('last'), last);
  assert.deepEqual(registry.decorate(row, view), ['*', '(box)']);
  for (const decorator of [first, empty, absent, last]) {
    assert.equal(decorator.seen.length, 1);
    assert.equal(decorator.seen[0], row);
  }
});

test('TreeDecoratorRegistry installs once and rejects unknown decorator names', () => {
  const registry = registryWith([['one', new ProbeDecorator('one', '*')]]);
  assert.throws(() => registry.install(new Map(), new Map()));
  assert.throws(() => registry.get('unknown'));
});

test('TreeDecoratorRegistry is a DocumentObserver that forwards committed events in order', () => {
  const first = new ProbeDecorator('first', '*');
  const second = new ProbeDecorator('second', '(box)');
  const registry = registryWith([['first', first], ['second', second]]);
  const observer: DocumentObserver = registry;
  observer.onCommitted(event);
  assert.deepEqual(first.committed, [event]);
  assert.deepEqual(second.committed, [event]);
  assert.equal(first.committed[0], second.committed[0]);
});

test('a throwing decorator is isolated and does not block later decorators', () => {
  const broken = new ProbeDecorator('broken', '*');
  broken.failCommit = true;
  const healthy = new ProbeDecorator('healthy', '(box)');
  const registry = registryWith([['broken', broken], ['healthy', healthy]]);
  assert.doesNotThrow(() => registry.onCommitted(event));
  assert.deepEqual(healthy.committed, [event]);
});
