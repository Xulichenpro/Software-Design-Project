import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SvgXmlCodec } from '../../../src/infrastructure/svg/SvgXmlCodec.js';
import { TreeDecorator } from '../../../src/application/tree/TreeDecorator.js';
import type { TreeRow } from '../../../src/application/tree/TreeRow.js';
import { TreeRenderer } from '../../../src/application/tree/TreeRenderer.js';
import { TreeDecoratorRegistry } from '../../../src/application/registries/TreeDecoratorRegistry.js';
import type { DocumentView } from '../../../src/application/contracts/DocumentView.js';
import { createDecoratorRegistry, createShapeRegistry } from '../../helpers/builtins.js';

const expectedTree = [
  'svg (320x200)',
  '└── g#flow',
  '    ├── rect#start  x=1 y=2 w=30 h=40  fill=blue',
  '    └── g#nested',
  '        ├── text#text1  (7,8) "开始"',
  '        └── circle#dot  cx=10 cy=20 r=3',
];

async function importedTree() {
  const text = await readFile(new URL('../../assets/phase1-nested.svg', import.meta.url), 'utf8');
  return new SvgXmlCodec(createShapeRegistry()).decode(text).tree;
}

class SuffixDecorator extends TreeDecorator {
  readonly name: string;
  readonly rows: TreeRow[] = [];
  readonly documents: DocumentView[] = [];
  constructor(name: string, private readonly suffix: (row: TreeRow) => string | undefined) { super(); this.name = name; }
  decorate(row: TreeRow, document: DocumentView): string | undefined {
    this.rows.push(row);
    this.documents.push(document);
    return this.suffix(row);
  }
}

test('TreeRenderer emits the Phase 1 base rows byte-for-byte when no decorator returns a label', async () => {
  const tree = await importedTree();
  const empty = new SuffixDecorator('empty', () => undefined);
  const renderer = new TreeRenderer(createDecoratorRegistry([['empty', empty]]));
  const result = renderer.render(tree);
  assert.deepEqual(result.lines, expectedTree);
  assert.equal(empty.rows.length, expectedTree.length);
  assert.ok(empty.documents.every(document => document.root === tree.root
    && document.findShape('flow') === tree.findShape('flow')));
});

test('TreeRenderer renders tree <id> without a canvas root row', async () => {
  const tree = await importedTree();
  const renderer = new TreeRenderer(createDecoratorRegistry());
  const result = renderer.render(tree, 'flow');
  assert.deepEqual(result.lines, [
    'g#flow',
    '├── rect#start  x=1 y=2 w=30 h=40  fill=blue',
    '└── g#nested',
    '    ├── text#text1  (7,8) "开始"',
    '    └── circle#dot  cx=10 cy=20 r=3',
  ]);
});

test('the root row carries no id/kind, isRoot and the Phase 1 canvas base line', async () => {
  const tree = await importedTree();
  const probe = new SuffixDecorator('probe', () => undefined);
  new TreeRenderer(createDecoratorRegistry([['probe', probe]])).render(tree);
  const root = probe.rows[0]!;
  assert.equal(root.id, undefined);
  assert.equal(root.kind, undefined);
  assert.equal(root.isRoot, true);
  assert.equal(root.base, 'svg (320x200)');
  const groupRow = probe.rows[1]!;
  assert.equal(groupRow.id, 'flow');
  assert.equal(groupRow.kind, 'g');
  assert.equal(groupRow.isRoot, false);
  assert.equal(groupRow.base, 'g#flow');
});

test('labels concatenate in registration order with exactly one leading space per non-empty suffix', async () => {
  const tree = await importedTree();
  const star = new SuffixDecorator('star', row => row.isRoot || row.id === 'start' ? '*' : undefined);
  const box = new SuffixDecorator('box', row => row.kind === 'g' ? '(box)' : undefined);
  const registry = new TreeDecoratorRegistry();
  registry.install(new Map([['star', star]]), new Map([['box', box]]));
  const result = new TreeRenderer(registry).render(tree);
  assert.deepEqual(result.lines, [
    'svg (320x200) *',
    '└── g#flow (box)',
    '    ├── rect#start  x=1 y=2 w=30 h=40  fill=blue *',
    '    └── g#nested (box)',
    '        ├── text#text1  (7,8) "开始"',
    '        └── circle#dot  cx=10 cy=20 r=3',
  ]);
});

test('decorators are independent: each sees the undecorated row and an empty result leaves bytes unchanged', async () => {
  const tree = await importedTree();
  const observed: TreeRow[] = [];
  const first = new SuffixDecorator('first', row => { observed.push(row); return undefined; });
  const second = new SuffixDecorator('second', row => { observed.push(row); return ''; });
  const renderer = new TreeRenderer(createDecoratorRegistry([['first', first], ['second', second]]));
  assert.deepEqual(renderer.render(tree).lines, expectedTree);
  assert.equal(observed.length, expectedTree.length * 2);
  assert.deepEqual(first.rows.map(row => row.base), expectedTree);
  assert.deepEqual(second.rows.map(row => row.base), expectedTree);
  assert.ok(first.rows.every(row => !row.base.includes(' *') && !row.base.includes('(box)')));
});
