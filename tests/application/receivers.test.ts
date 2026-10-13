import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ShapeTree } from '../../src/domain/tree/ShapeTree.js';
import { ShapeFactory } from '../../src/domain/factory/ShapeFactory.js';
import { ShapeEditorReceiver } from '../../src/application/receivers/ShapeEditorReceiver.js';
import { DocumentReceiver } from '../../src/application/receivers/DocumentReceiver.js';
import { QueryReceiver } from '../../src/application/receivers/QueryReceiver.js';
import { SvgXmlCodec } from '../../src/infrastructure/svg/SvgXmlCodec.js';
import type { FileGateway } from '../../src/application/contracts/FileGateway.js';

class MemoryFiles implements FileGateway {
  files = new Map<string, string>();
  failWrite = false;
  async read(path: string) { const text = this.files.get(path); if (text === undefined) throw new Error('missing'); return text; }
  async write(path: string, text: string) { if (this.failWrite) throw new Error('failed'); this.files.set(path, text); }
}
function setup() {
  const tree = new ShapeTree(); const files = new MemoryFiles();
  const editor = new ShapeEditorReceiver(tree, new ShapeFactory());
  const document = new DocumentReceiver(tree, new SvgXmlCodec(new ShapeFactory()), files);
  return { tree, files, editor, document, query: new QueryReceiver(tree) };
}
function ids(tree: ShapeTree, parentId?: string) { return tree.getContainer(parentId).children.items.map(s => s.id); }

test('all receivers share initialization and replacement, while help works without a document', async () => {
  const { tree, files, editor, document, query } = setup();
  assert.match(query.help().lines.join('\n'), /create.*in/);
  assert.throws(() => query.tree(), /no document/);
  assert.throws(() => editor.create('g', 'g', []), /no document/);
  document.initialize();
  assert.deepEqual(tree.canvasSize, { width: 800, height: 600 });
  editor.create('rect', 'old', ['1', '2', '3', '4']);
  files.files.set('new.svg', '<svg width="100" height="200"><circle id="new" cx="1" cy="2" r="3"/></svg>');
  await document.read('new.svg');
  assert.match(query.show('new').lines.join('\n'), /circle#new/);
  assert.throws(() => tree.findShape('old'), /no such shape/);
  document.resizeCanvas(300, 400);
  assert.match(query.showCanvas().lines[0]!, /300x400/);
  assert.throws(() => document.resizeCanvas(0, 1));
  assert.deepEqual(tree.canvasSize, { width: 300, height: 400 });
});

test('move, scale and attribute records apply forward/inverse parameters through the same receiver', () => {
  const { editor, document, tree } = setup(); document.initialize();
  editor.create('rect', 'r', ['0.1', '0.2', '3', '4']);
  const move = editor.move({ id: 'r', dx: 0.2, dy: 0.3 });
  editor.move(move.record.inverse); assert.ok(Math.abs(Number(tree.findShape('r').getAttribute('x')) - 0.1) < 1e-12);
  editor.move(move.record.forward);
  const scale = editor.scale({ id: 'r', factor: 3 }); editor.scale(scale.record.inverse);
  assert.ok(Math.abs(Number(tree.findShape('r').getAttribute('width')) - 3) < 1e-12);
  const attr = editor.setAttribute({ id: 'r', name: 'fill', value: 'red' });
  editor.setAttribute(attr.record.inverse); assert.equal(tree.findShape('r').getAttribute('fill'), undefined);
  editor.setAttribute(attr.record.forward); assert.equal(tree.findShape('r').getAttribute('fill'), 'red');
});

test('create and recursive delete records restore exact identities, parents, indexes and ordering', () => {
  const { editor, document, tree } = setup(); document.initialize();
  const created = editor.create('g', 'g', []);
  editor.editStructure(created.record.inverse); assert.throws(() => tree.findShape('g'));
  editor.editStructure(created.record.forward);
  editor.create('rect', 'a', ['0', '0', '1', '1'], 'g'); editor.create('g', 'nested', [], 'g');
  editor.create('text', 'label', ['1', '2', 'hello'], 'nested'); editor.create('g', 'tail', []);
  const label = tree.findShape('label'); const removed = editor.delete('g');
  assert.deepEqual(ids(tree), ['tail']); assert.throws(() => tree.findShape('label'));
  editor.editStructure(removed.record.inverse);
  assert.deepEqual(ids(tree), ['g', 'tail']); assert.deepEqual(ids(tree, 'g'), ['a', 'nested']);
  assert.equal(tree.findShape('label'), label); assert.equal(label.parent, tree.findShape('nested'));
  assert.throws(() => editor.create('g', 'label', []), /id already exists/);
  assert.throws(() => editor.create('g', 'bad', [], 'a'), /not a container/);
  assert.throws(() => editor.create('g', 'bad', [], 'missing'), /no such container/);
  assert.throws(() => tree.findShape('bad'));
});

test('cross-parent group anchors at first argument and orders children by original tree traversal', () => {
  const { editor, document, tree } = setup(); document.initialize();
  editor.create('g', 'p', []); editor.create('g', 'q', []);
  for (const id of ['a', 'b', 'c']) editor.create('circle', id, ['0', '0', '1'], 'p');
  editor.create('g', 'd', [], 'q');
  const grouped = editor.group('combined', ['d', 'b', 'a']);
  assert.deepEqual(ids(tree, 'p'), ['c']); assert.deepEqual(ids(tree, 'q'), ['combined']);
  assert.deepEqual(ids(tree, 'combined'), ['a', 'b', 'd']);
  editor.editStructure(grouped.record.inverse);
  assert.deepEqual(ids(tree, 'p'), ['a', 'b', 'c']); assert.deepEqual(ids(tree, 'q'), ['d']);
  editor.editStructure(grouped.record.forward);
  const ungrouped = editor.ungroup('combined'); assert.deepEqual(ids(tree, 'q'), ['a', 'b', 'd']);
  editor.editStructure(ungrouped.record.inverse); assert.deepEqual(ids(tree, 'combined'), ['a', 'b', 'd']);
  assert.throws(() => editor.ungroup('p'), /top-level container/);
});

test('addto/front/back round-trip and illegal cycles leave tree intact', () => {
  const { editor, document, tree, query } = setup(); document.initialize();
  editor.create('g', 'p', []); editor.create('g', 'child', [], 'p');
  editor.create('g', 'a', []); editor.create('g', 'b', []);
  const before = query.tree().lines;
  assert.throws(() => editor.addTo('child', 'p'), /descendant|cycle/);
  assert.throws(() => editor.group('bad', ['p', 'child']), /own descendant/);
  assert.throws(() => editor.group('bad', ['a', 'a']), /duplicate/);
  assert.deepEqual(query.tree().lines, before);
  const moved = editor.addTo('child', 'a'); assert.deepEqual(ids(tree, 'child'), ['a']);
  editor.editStructure(moved.record.inverse); assert.deepEqual(ids(tree), ['p', 'a', 'b']);
  const front = editor.front('p'); assert.deepEqual(ids(tree), ['a', 'b', 'p']);
  editor.editStructure(front.record.inverse); assert.deepEqual(ids(tree), ['p', 'a', 'b']);
  const back = editor.back('b'); assert.deepEqual(ids(tree), ['b', 'p', 'a']);
  editor.editStructure(back.record.inverse); assert.deepEqual(ids(tree), ['p', 'a', 'b']);
});

test('failed read/save retain shared document and association; successful save associates path', async () => {
  const { files, document, editor, query } = setup(); document.initialize(); editor.create('g', 'keep', []);
  await assert.rejects(document.save(), /specify|path/);
  await document.save('first.svg'); const before = query.tree().lines;
  files.files.set('bad.svg', '<svg width="5" height="5"><bogus/></svg>');
  await assert.rejects(document.read('bad.svg')); assert.deepEqual(query.tree().lines, before);
  files.failWrite = true; await assert.rejects(document.save('second.svg'), /cannot write file/);
  assert.equal(document.associatedPath, 'first.svg'); files.failWrite = false; await document.save();
  assert.ok(files.files.has('first.svg')); assert.equal(document.associatedPath, 'first.svg');
  document.initialize(); assert.equal(document.associatedPath, undefined);
});

test('scale rejects an infinite reciprocal before editing and records are immutable', () => {
  const { editor, document, tree } = setup(); document.initialize();
  editor.create('rect', 'r', ['1', '2', '3', '4']);
  assert.throws(() => editor.scale({ id: 'r', factor: Number.MIN_VALUE }), /finite/);
  assert.equal(tree.findShape('r').getAttribute('width'), '3');
  const result = editor.move({ id: 'r', dx: 2, dy: 3 });
  assert.ok(Object.isFrozen(result.record.forward)); assert.ok(Object.isFrozen(result.record.inverse));
  const structure = editor.create('g', 'group', []);
  assert.ok(Object.isFrozen(structure.record.forward.placements));
  assert.ok(Object.isFrozen(structure.record.forward.placements[0]));
});

test('invalid domain structure plans preserve parents, order and index atomically', () => {
  const { editor, document, tree, query } = setup(); document.initialize();
  editor.create('g', 'a', []); editor.create('g', 'b', []);
  const a = tree.findShape('a'); const b = tree.findShape('b'); const before = query.tree().lines;
  assert.throws(() => tree.editStructure({ placements: [{ shape: a, parent: tree.root, index: 99 }, { shape: b, index: 0 }] }));
  assert.deepEqual(query.tree().lines, before); assert.equal(a.parent, tree.root); assert.equal(tree.findShape('b'), b);
  const duplicate = new ShapeFactory().createFromArguments('g', 'a', []);
  assert.throws(() => tree.editStructure({ placements: [{ shape: duplicate, parent: tree.root, index: 0 }] }), /id already exists/);
  assert.deepEqual(query.tree().lines, before);
});
