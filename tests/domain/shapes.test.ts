import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ShapeFactory } from '../../src/domain/factory/ShapeFactory.js';
import { GroupShape } from '../../src/domain/shapes/GroupShape.js';

const factory = new ShapeFactory();

for (const [type, args, moved, scaled] of [
  ['rect', ['1', '2', '3', '4'], { x: '6', y: '9', width: '3', height: '4' }, { x: '12', y: '18', width: '6', height: '8' }],
  ['circle', ['1', '2', '3'], { cx: '6', cy: '9', r: '3' }, { cx: '12', cy: '18', r: '6' }],
  ['ellipse', ['1', '2', '3', '4'], { cx: '6', cy: '9', rx: '3', ry: '4' }, { cx: '12', cy: '18', rx: '6', ry: '8' }],
  ['line', ['1', '2', '3', '4'], { x1: '6', y1: '9', x2: '8', y2: '11' }, { x1: '12', y1: '18', x2: '16', y2: '22' }],
  ['text', ['1', '2', 'a < b & "c"'], { x: '6', y: '9' }, { x: '12', y: '18' }],
] as const) {
  test(`${type} owns geometry and supports polymorphic move/scale`, () => {
    const shape = factory.createFromArguments(type, 's', args);
    shape.move(5, 7);
    assert.deepEqual(shape.toSvgElement().attributes, { id: 's', ...moved });
    shape.scale(2);
    assert.deepEqual(shape.toSvgElement().attributes, { id: 's', ...scaled });
    if (type === 'text') assert.equal(shape.toSvgElement().text, args[2]);
  });
}

test('attributes validate before changing state, and absent styles can be restored', () => {
  const shape = factory.createFromArguments('rect', 'r', ['0', '0', '1', '2']);
  for (const [name, value] of [['width', '-1'], ['x', 'Infinity'], ['bogus', '1'], ['stroke-width', '-1']]) {
    assert.throws(() => shape.setAttribute(name!, value!), /attribute|non-negative|finite/);
  }
  assert.equal(shape.getAttribute('width'), '1');
  assert.equal(shape.getAttribute('fill'), undefined);
  shape.setAttribute('fill', 'red');
  shape.setAttribute('fill', undefined);
  assert.equal(shape.getAttribute('fill'), undefined);
  assert.throws(() => factory.createFromArguments('circle', 'c', ['0', '0', '-1']));
  assert.throws(() => factory.createFromArguments('box', 'b', []), /unknown shape type/);
  assert.throws(() => shape.scale(0), /positive/);
});

test('nested groups delegate geometry atomically and set style on themselves', () => {
  const outer = factory.createFromArguments('g', 'outer', []) as GroupShape;
  const inner = factory.createFromArguments('g', 'inner', []) as GroupShape;
  const first = factory.createFromArguments('rect', 'first', ['1', '2', '3', '4']);
  const huge = factory.createFromArguments('circle', 'huge', ['1e308', '2', '1']);
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

test('finite moves reject catastrophic cancellation before changing geometry', () => {
  const shape = factory.createFromArguments('rect', 'r', ['1','2','3','4']);
  const before = shape.toSvgElement();
  assert.throws(() => shape.move(1e20, 0), /reversible|precision/);
  assert.deepEqual(shape.toSvgElement(), before);
});

test('finite scales reject lost small values and inverse overflow before mutation', () => {
  const tiny = factory.createFromArguments('circle', 'c', ['0','0','1e-300']);
  assert.throws(() => tiny.scale(1e-100), /reversible|precision/);
  assert.equal(tiny.getAttribute('r'), '1e-300');
  const huge = factory.createFromArguments('rect', 'r', [String(Number.MAX_VALUE),'0','0','0']);
  assert.throws(() => huge.scale(0.055), /finite|reversible/);
  assert.equal(huge.getAttribute('x'), String(Number.MAX_VALUE));
  const subnormal = factory.createFromArguments('circle', 's', ['0','0',String(Number.MIN_VALUE)]);
  assert.throws(() => subnormal.scale(0.5), /reversible|precision/);
  assert.equal(subnormal.getAttribute('r'), String(Number.MIN_VALUE));
});

test('group numeric reversibility validates every descendant before editing any child', () => {
  const group = factory.createFromArguments('g', 'g', []) as GroupShape;
  const normal = factory.createFromArguments('circle', 'normal', ['0','0','0']);
  const tiny = factory.createFromArguments('circle', 'tiny', ['0','0','1e-300']);
  group.children.insert(normal, 0); group.children.insert(tiny, 1);
  const before = group.toSvgElement();
  assert.throws(() => group.scale(1e-100), /reversible|precision/);
  assert.deepEqual(group.toSvgElement(), before);
});
