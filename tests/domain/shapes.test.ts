import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Shape } from '../../src/domain/shapes/Shape.js';
import { ShapeProvider } from '../../src/domain/shapes/ShapeProvider.js';
import type { ShapeRegistration } from '../../src/domain/shapes/ShapeRegistration.js';
import type { ShapeCreationContext } from '../../src/domain/shapes/ShapeCreationContext.js';
import type { ShapeContainer } from '../../src/domain/tree/ShapeContainer.js';
import type { ShapeTopology } from '../../src/domain/tree/ShapeTopology.js';
import { ChildCollection } from '../../src/domain/tree/ChildCollection.js';
import { RectShape } from '../../src/domain/shapes/RectShape.js';
import { GroupShape } from '../../src/domain/shapes/GroupShape.js';
import { createShapeRegistry } from '../helpers/builtins.js';

const registry = createShapeRegistry();
const creationContext: ShapeCreationContext = {
  createFromArguments() { throw new Error('leaf shape must not create children'); },
  createFromSvgElement() { throw new Error('leaf shape must not create children'); },
};

const builtins = [
  ['rect', 'rect', ['1', '2', '3', '4'], undefined],
  ['circle', 'circle', ['1', '2', '3'], undefined],
  ['ellipse', 'ellipse', ['1', '2', '3', '4'], undefined],
  ['line', 'line', ['1', '2', '3', '4'], undefined],
  ['text', 'text', ['1', '2', 'a < b & "c"'], [true, true, true]],
  ['g', 'g', [], undefined],
] as const;

for (const [type, tag, args, quoted] of builtins) {
  test(`${type} registration exposes static type and instance kind/tag/label/heading`, () => {
    const registration: ShapeRegistration = registry.get(type);
    assert.equal(registration.type, type);
    assert.ok(registration.prototype instanceof ShapeProvider);
    const shape = registration.createFromArguments('s', [...args], quoted, creationContext);
    assert.ok(shape instanceof ShapeProvider);
    assert.equal(shape.kind, type);
    assert.equal(shape.tag, tag);
    assert.equal(shape.label, `${type}#s`);
    assert.equal(shape.describe().heading, `${tag}#s`);
    assert.equal(shape.kind, shape.tag);
  });
}

test('builtin registry contains exactly the six Phase 1 shapes in order', () => {
  assert.deepEqual(registry.values().map(registration => registration.type), ['rect', 'circle', 'ellipse', 'line', 'text', 'g']);
  for (const [type] of builtins) assert.equal(registry.get(type), registry.values().find(registration => registration.type === type));
});

test('ShapeRegistration is satisfied by concrete class objects, not by provider instances', () => {
  const registration: ShapeRegistration = RectShape;
  assert.equal(registration.type, 'rect');
  assert.ok(registration.prototype instanceof ShapeProvider);
  const shape = registration.createFromArguments('r', ['1', '2', '3', '4'], undefined, creationContext);
  assert.ok(shape instanceof RectShape);
  const fromSvg = registration.createFromSvgElement({ tag: 'rect', attributes: { id: 'q', x: '5' }, children: [] }, creationContext);
  assert.equal(fromSvg.getAttribute('x'), '5');
});

test('registry creates and reads back through concrete static methods and the creation context', () => {
  assert.equal(registry.createFromArguments('circle', 'c', ['1', '2', '3']).tag, 'circle');
  const group = registry.createFromSvgElement({
    tag: 'g', attributes: { id: 'g' },
    children: [{ tag: 'rect', attributes: { id: 'r', x: '1' }, children: [] }],
  });
  assert.equal(group.tag, 'g');
  const container = group.asContainer();
  assert.ok(container);
  assert.deepEqual(container.children.items.map(shape => shape.id), ['r']);
});

class PlainProvider extends ShapeProvider {
  constructor(id = 'plain') { super(id, {}); }
  get tag() { return 'plain'; }
  protected get xKeys() { return []; }
  protected get yKeys() { return []; }
}

class PlainContainer extends ShapeProvider implements ShapeContainer {
  readonly #children = new ChildCollection(this);
  constructor(id = 'box') { super(id, {}); }
  get tag() { return 'plain'; }
  get children() { return this.#children; }
  override asContainer() { return this; }
  protected get xKeys() { return []; }
  protected get yKeys() { return []; }
}

test('ShapeProvider defaults are leaf behavior: no container, ungroup allowed, empty structure validation', () => {
  const shape = new PlainProvider();
  assert.equal(shape.asContainer(), undefined);
  assert.equal(shape.canUngroup(), true);
  const topology: ShapeTopology = {
    parentOf() { throw new Error('default validateStructure must not query the topology'); },
    childrenOf() { throw new Error('default validateStructure must not query the topology'); },
    contains() { throw new Error('default validateStructure must not query the topology'); },
  };
  assert.doesNotThrow(() => shape.validateStructure(topology));
});

test('GroupShape is a container while leaf providers are not', () => {
  const group = registry.createFromArguments('g', 'group', []) as GroupShape;
  assert.equal(group.asContainer(), group);
  assert.equal(group.canUngroup(), true);
  const rect = registry.createFromArguments('rect', 'r', ['1', '2', '3', '4']);
  assert.equal(rect.asContainer(), undefined);
  const container = new PlainContainer();
  assert.equal(container.asContainer(), container);
});

for (const [type, args, moved, scaled] of [
  ['rect', ['1', '2', '3', '4'], { x: '6', y: '9', width: '3', height: '4' }, { x: '12', y: '18', width: '6', height: '8' }],
  ['circle', ['1', '2', '3'], { cx: '6', cy: '9', r: '3' }, { cx: '12', cy: '18', r: '6' }],
  ['ellipse', ['1', '2', '3', '4'], { cx: '6', cy: '9', rx: '3', ry: '4' }, { cx: '12', cy: '18', rx: '6', ry: '8' }],
  ['line', ['1', '2', '3', '4'], { x1: '6', y1: '9', x2: '8', y2: '11' }, { x1: '12', y1: '18', x2: '16', y2: '22' }],
  ['text', ['1', '2', 'a < b & "c"'], { x: '6', y: '9' }, { x: '12', y: '18' }],
] as const) {
  test(`${type} keeps Phase 1 polymorphic move/scale behavior`, () => {
    const shape = registry.createFromArguments(type, 's', [...args], type === 'text' ? [true, true, true] : undefined);
    shape.move(5, 7);
    assert.deepEqual(shape.toSvgElement().attributes, { id: 's', ...moved });
    shape.scale(2);
    assert.deepEqual(shape.toSvgElement().attributes, { id: 's', ...scaled });
    if (type === 'text') assert.equal(shape.toSvgElement().text, args[2]);
  });
}

test('attributes validate before changing state and absent styles can be restored', () => {
  const shape = registry.createFromArguments('rect', 'r', ['0', '0', '1', '2']);
  for (const [name, value] of [['width', '-1'], ['x', 'Infinity'], ['bogus', '1'], ['stroke-width', '-1']]) {
    assert.throws(() => shape.setAttribute(name!, value!), /attribute|non-negative|finite/);
  }
  assert.equal(shape.getAttribute('width'), '1');
  assert.equal(shape.getAttribute('fill'), undefined);
  shape.setAttribute('fill', 'red');
  shape.setAttribute('fill', undefined);
  assert.equal(shape.getAttribute('fill'), undefined);
  assert.throws(() => registry.createFromArguments('circle', 'c', ['0', '0', '-1']));
  assert.throws(() => registry.createFromArguments('box', 'b', []), /unknown shape type: box/);
  assert.throws(() => shape.scale(0), /positive/);
});

test('a leaf still extends Shape and groups still delegate geometry atomically', () => {
  const rect = registry.createFromArguments('rect', 'r', ['1', '2', '3', '4']);
  assert.ok(rect instanceof Shape);
  const outer = registry.createFromArguments('g', 'outer', []) as GroupShape;
  const inner = registry.createFromArguments('g', 'inner', []) as GroupShape;
  const first = registry.createFromArguments('rect', 'first', ['1', '2', '3', '4']);
  const huge = registry.createFromArguments('circle', 'huge', ['1e308', '2', '1']);
  outer.children.insert(inner, 0); inner.children.insert(first, 0); inner.children.insert(huge, 1);
  assert.throws(() => outer.scale(2), /finite/);
  assert.equal(first.getAttribute('x'), '1');
  assert.throws(() => outer.move(1e308, 0), /finite/);
  assert.equal(first.getAttribute('x'), '1');
  outer.setAttribute('fill', 'red');
  assert.equal(first.getAttribute('fill'), undefined);
  inner.children.remove(huge);
  outer.move(4, 5); outer.scale(0.5);
  assert.equal(first.getAttribute('x'), '2.5');
});

test('finite moves and scales reject irreversible floating point edits before mutation', () => {
  const shape = registry.createFromArguments('rect', 'r', ['1', '2', '3', '4']);
  const before = shape.toSvgElement();
  assert.throws(() => shape.move(1e20, 0), /reversible|precision/);
  assert.deepEqual(shape.toSvgElement(), before);
  const tiny = registry.createFromArguments('circle', 'c', ['0', '0', '1e-300']);
  assert.throws(() => tiny.scale(1e-100), /reversible|precision/);
  assert.equal(tiny.getAttribute('r'), '1e-300');
});
