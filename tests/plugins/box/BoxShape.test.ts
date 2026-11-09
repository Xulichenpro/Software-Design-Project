import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ShapeProvider } from '../../../src/domain/shapes/ShapeProvider.js';
import { BoxShape } from '../../../plugins/box/src/BoxShape.js';
import {
  boxArguments, boxQuoted, createBoxRegistry, standaloneBox, topologyFor,
} from './fixtures.js';

test('box exposes static type box while its command label is box#id and its tree heading is g#id', () => {
  assert.equal(BoxShape.type, 'box');
  const box = standaloneBox('n1');
  assert.ok(box instanceof BoxShape);
  assert.ok(box instanceof ShapeProvider);
  assert.equal(box.kind, 'box');
  assert.equal(box.tag, 'g');
  assert.equal(box.label, 'box#n1');
  assert.equal(box.describe().heading, 'g#n1');
  assert.equal(box.asContainer(), box);
  assert.equal(box.canUngroup(), false);
});

test('the create template derives rect n1-rect and text n1-label directly under the box', () => {
  const box = standaloneBox('n1', 120, 100, 160, 60, '开始');
  assert.deepEqual(box.descendants.map(child => child.id), ['n1-rect', 'n1-label']);
  const [rect, label] = box.descendants;
  assert.ok(rect);
  assert.ok(label);

  assert.equal(rect.tag, 'rect');
  assert.equal(rect.getAttribute('x'), '120');
  assert.equal(rect.getAttribute('y'), '100');
  assert.equal(rect.getAttribute('width'), '160');
  assert.equal(rect.getAttribute('height'), '60');
  assert.equal(rect.getAttribute('fill'), '#4a90d9');

  assert.equal(label.tag, 'text');
  assert.equal(label.getAttribute('x'), '140');
  assert.equal(label.getAttribute('y'), '135');
  assert.equal(label.getAttribute('text'), '开始');
  assert.equal(label.getAttribute('fill'), undefined);

  assert.equal(rect.parent, box);
  assert.equal(label.parent, box);
  assert.equal(box.parent, undefined);
});

test('create rejects missing or non-numeric template parameters without inventing new error text', () => {
  const registry = createBoxRegistry();
  assert.throws(() => registry.createFromArguments('box', 'n1', boxArguments().slice(0, 4)));
  assert.throws(() => registry.createFromArguments('box', 'n1', ['left', '100', '160', '60', '开始'], [...boxQuoted]));
  assert.throws(() => registry.createFromArguments('box', 'n1', ['120', '100', 'wide', '60', '开始'], [...boxQuoted]));
});

test('create rejects an explicitly unquoted title while retaining internal creation without quote flags', () => {
  const registry = createBoxRegistry();
  assert.throws(() => registry.createFromArguments('box', 'n1', boxArguments(), [false, false, false, false, false]), /title must be quoted/);
  assert.equal(registry.createFromArguments('box', 'internal', boxArguments()).descendants[1]?.getAttribute('text'), '开始');
  assert.equal(registry.createFromArguments('box', 'quoted', boxArguments(), [...boxQuoted]).descendants[1]?.getAttribute('text'), '开始');
});

test('move traverses every direct child, including nested boxes and extra shapes, not just rect and text', () => {
  const box = standaloneBox('n1', 120, 100, 160, 60, 'outer');
  const inner = standaloneBox('n3', 200, 150, 100, 50, 'inner');
  const extra = createBoxRegistry().createFromArguments('circle', 'dot', ['10', '20', '5']);
  const container = box.asContainer();
  assert.ok(container);
  container.children.insert(inner, container.children.items.length);
  container.children.insert(extra, container.children.items.length);
  assert.deepEqual(box.descendants.map(child => child.id), ['n1-rect', 'n1-label', 'n3', 'dot']);

  box.move(10, 20);

  const rect = box.descendants.find(child => child.id === 'n1-rect');
  const label = box.descendants.find(child => child.id === 'n1-label');
  const innerRect = inner.descendants.find(child => child.id === 'n3-rect');
  const innerLabel = inner.descendants.find(child => child.id === 'n3-label');
  assert.ok(rect && label && innerRect && innerLabel);
  assert.deepEqual([rect.getAttribute('x'), rect.getAttribute('y')], ['130', '120']);
  assert.deepEqual([label.getAttribute('x'), label.getAttribute('y')], ['150', '155']);
  assert.deepEqual([innerRect.getAttribute('x'), innerRect.getAttribute('y')], ['210', '170']);
  assert.deepEqual([innerLabel.getAttribute('x'), innerLabel.getAttribute('y')], ['230', '205']);
  assert.equal(extra.getAttribute('cx'), '20');
});

test('scale traverses every direct child and nested boxes recurse their own parts', () => {
  const box = standaloneBox('n1', 120, 100, 160, 60, 'outer');
  const inner = standaloneBox('n3', 200, 150, 100, 50, 'inner');
  const extra = createBoxRegistry().createFromArguments('circle', 'dot', ['10', '20', '5']);
  const container = box.asContainer();
  assert.ok(container);
  container.children.insert(inner, container.children.items.length);
  container.children.insert(extra, container.children.items.length);

  box.scale(2);

  const rect = box.descendants.find(child => child.id === 'n1-rect');
  const label = box.descendants.find(child => child.id === 'n1-label');
  const innerRect = inner.descendants.find(child => child.id === 'n3-rect');
  assert.ok(rect && label && innerRect);
  assert.deepEqual(
    [rect.getAttribute('x'), rect.getAttribute('y'), rect.getAttribute('width'), rect.getAttribute('height')],
    ['240', '200', '320', '120'],
  );
  assert.deepEqual([label.getAttribute('x'), label.getAttribute('y')], ['280', '270']);
  assert.deepEqual(
    [innerRect.getAttribute('x'), innerRect.getAttribute('y'), innerRect.getAttribute('width'), innerRect.getAttribute('height')],
    ['400', '300', '200', '100'],
  );
  assert.equal(extra.getAttribute('cx'), '20');
});

test('validateStructure accepts both required parts plus extra children', () => {
  const box = standaloneBox('n1');
  assert.doesNotThrow(() => box.validateStructure(topologyFor(box)));
  const extra = createBoxRegistry().createFromArguments('circle', 'dot', ['1', '2', '3']);
  const container = box.asContainer();
  assert.ok(container);
  container.children.insert(extra, container.children.items.length);
  assert.doesNotThrow(() => box.validateStructure(topologyFor(box)));
});

test('validateStructure rejects a missing, retyped or replaced required part', () => {
  const box = standaloneBox('n1');
  const [rect, label] = box.descendants;
  const extra = createBoxRegistry().createFromArguments('circle', 'dot', ['1', '2', '3']);
  assert.ok(rect && label);

  assert.throws(() => box.validateStructure(topologyFor(box, [rect, extra])));
  assert.throws(() => box.validateStructure(topologyFor(box, [label, extra])));

  const wrongRect = createBoxRegistry().createFromArguments('circle', 'n1-rect', ['1', '2', '3']);
  const wrongLabel = createBoxRegistry().createFromArguments('rect', 'n1-label', ['1', '2', '3', '4']);
  assert.throws(() => box.validateStructure(topologyFor(box, [wrongRect, label])));
  assert.throws(() => box.validateStructure(topologyFor(box, [rect, wrongLabel])));
});

test('serialization emits g data-kind box, the two parts in order, and readable g styles', () => {
  const box = standaloneBox('n1', 120, 100, 160, 60, '开始');
  const element = box.toSvgElement();
  assert.equal(element.tag, 'g');
  assert.equal(element.attributes.id, 'n1');
  assert.equal(element.attributes['data-kind'], 'box');
  assert.deepEqual(element.children.map(child => child.tag), ['rect', 'text']);

  const [rect, label] = element.children;
  assert.ok(rect && label);
  assert.equal(rect.attributes.x, '120');
  assert.equal(rect.attributes.y, '100');
  assert.equal(rect.attributes.width, '160');
  assert.equal(rect.attributes.height, '60');
  assert.equal(rect.attributes.fill, '#4a90d9');
  assert.equal(label.attributes.x, '140');
  assert.equal(label.attributes.y, '135');
  assert.equal(label.text, '开始');

  box.setAttribute('stroke', 'red');
  box.setAttribute('stroke-width', '2');
  const styled = box.toSvgElement();
  assert.equal(styled.attributes.stroke, 'red');
  assert.equal(styled.attributes['stroke-width'], '2');
  assert.equal(styled.attributes['data-kind'], 'box');
});
