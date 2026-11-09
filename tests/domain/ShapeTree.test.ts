import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ShapeTree } from '../../src/domain/tree/ShapeTree.js';
import { ShapeProvider } from '../../src/domain/shapes/ShapeProvider.js';
import { ChildCollection } from '../../src/domain/tree/ChildCollection.js';
import type { ShapeContainer } from '../../src/domain/tree/ShapeContainer.js';
import type { ShapeTopology } from '../../src/domain/tree/ShapeTopology.js';
import { createShapeRegistry } from '../helpers/builtins.js';

class TestContainer extends ShapeProvider implements ShapeContainer {
  readonly #children = new ChildCollection(this);
  constructor(id: string) { super(id, {}); }
  get tag() { return 'test-container'; }
  get children() { return this.#children; }
  override asContainer() { return this; }
  protected get xKeys() { return []; }
  protected get yKeys() { return []; }
}

class GuardedShape extends ShapeProvider {
  fail = false;
  lastTopology: ShapeTopology | undefined;
  constructor(id: string) { super(id, {}); }
  get tag() { return 'guarded'; }
  override asContainer() { return undefined; }
  override validateStructure(topology: ShapeTopology) {
    this.lastTopology = topology;
    if (this.fail) throw new Error('structure rejected');
  }
  protected get xKeys() { return []; }
  protected get yKeys() { return []; }
}

function setupTree() {
  const tree = new ShapeTree();
  tree.initialize(100, 100);
  const container = new TestContainer('box');
  const guard = new GuardedShape('guard');
  tree.editStructure({ placements: [{ shape: container, parent: tree.root, index: 0 }] });
  tree.editStructure({ placements: [{ shape: guard, parent: container, index: 0 }] });
  return { tree, container, guard };
}

test('ShapeTree identifies containers with asContainer() rather than a concrete GroupShape check', () => {
  const { tree, container } = setupTree();
  const leaf = createShapeRegistry().createFromArguments('rect', 'leaf', ['1', '2', '3', '4']);
  tree.editStructure({ placements: [{ shape: leaf, parent: tree.root, index: 1 }] });
  assert.equal(tree.getContainer(), tree.root);
  assert.equal(tree.getContainer('box'), container);
  assert.throws(() => tree.getContainer('leaf'), /not a container: leaf/);
});

test('ShapeTree traverses custom containers and indexes every nested id', () => {
  const { tree } = setupTree();
  const leaf = createShapeRegistry().createFromArguments('circle', 'deep', ['1', '2', '3']);
  tree.editStructure({ placements: [{ shape: leaf, parent: tree.getContainer('box'), index: 1 }] });
  assert.equal(tree.findShape('deep'), leaf);
  assert.deepEqual(tree.shapes.map(shape => shape.id).sort(), ['box', 'deep', 'guard']);
  assert.equal(tree.root.children.items[0], tree.findShape('box'));
});

test('editStructure validates the final topology before committing any move', () => {
  const { tree, container, guard } = setupTree();
  guard.fail = true;
  guard.lastTopology = undefined;
  const rootBefore = tree.root.children.items;
  const containerBefore = container.children.items;

  assert.throws(() => tree.editStructure({
    placements: [{ shape: guard, parent: tree.root, index: 1 }],
  }), /structure rejected/);

  const topology = (guard as unknown as { lastTopology: ShapeTopology | undefined }).lastTopology;
  assert.ok(topology, 'validateStructure receives a topology');
  assert.equal(topology.parentOf(guard), tree.root);
  assert.deepEqual(topology.childrenOf(tree.root).map(shape => shape.id), ['box', 'guard']);
  assert.deepEqual(topology.childrenOf(container).map(shape => shape.id), []);
  assert.equal(topology.contains(guard), true);
  assert.equal(topology.contains(container), true);

  assert.deepEqual(tree.root.children.items, rootBefore);
  assert.deepEqual(container.children.items, containerBefore);
  assert.deepEqual(tree.shapes.map(shape => shape.id).sort(), ['box', 'guard']);
  assert.equal(guard.parent, container);
  assert.equal(tree.findShape('guard'), guard);
});

test('a rejected structure edit keeps parent links, order and the id index unchanged', () => {
  const { tree, container, guard } = setupTree();
  guard.fail = true;
  const beforeRoot = [...tree.root.children.items];
  const beforeContainer = [...container.children.items];
  const beforeIds = tree.shapes.map(shape => shape.id);

  assert.throws(() => tree.editStructure({
    placements: [
      { shape: guard, parent: tree.root, index: 0 },
      { shape: container, parent: tree.root, index: 1 },
    ],
  }), /structure rejected/);

  assert.deepEqual(tree.root.children.items, beforeRoot);
  assert.deepEqual(container.children.items, beforeContainer);
  assert.deepEqual(tree.shapes.map(shape => shape.id), beforeIds);
  assert.equal(guard.parent, container);
  assert.equal(container.parent, tree.root);
  assert.equal(tree.findShape('box'), container);
  assert.equal(tree.findShape('guard'), guard);
});

test('validateStructure is skipped for a shape that becomes unreachable through deletion', () => {
  const { tree, guard } = setupTree();
  guard.fail = true;
  assert.doesNotThrow(() => tree.editStructure({ placements: [{ shape: guard, index: 0 }] }));
  assert.throws(() => tree.findShape('guard'), /no such shape: guard/);
  assert.deepEqual(tree.shapes.map(shape => shape.id), ['box']);
});
