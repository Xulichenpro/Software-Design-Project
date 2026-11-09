import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ShapeProvider } from '../../../src/domain/shapes/ShapeProvider.js';
import { ShapeProviderRegistry } from '../../../src/application/registries/ShapeProviderRegistry.js';
import type { ShapeRegistration } from '../../../src/domain/shapes/ShapeRegistration.js';
import type { ShapeCreationContext } from '../../../src/domain/shapes/ShapeCreationContext.js';
import type { SvgElement } from '../../../src/domain/representation/SvgElement.js';
import { RectShape } from '../../../src/domain/shapes/RectShape.js';
import { CircleShape } from '../../../src/domain/shapes/CircleShape.js';
import { GroupShape } from '../../../src/domain/shapes/GroupShape.js';
import { builtinShapeMap } from '../../helpers/builtins.js';

class ProbeShape extends ShapeProvider {
  static readonly type = 'probe';
  static argumentsCalls: { id: string; args: readonly string[]; quoted: readonly boolean[] | undefined; context: ShapeCreationContext }[] = [];
  static svgCalls: { element: SvgElement; context: ShapeCreationContext }[] = [];
  static createFromArguments(id: string, args: readonly string[], quoted: readonly boolean[] | undefined, context: ShapeCreationContext) {
    ProbeShape.argumentsCalls.push({ id, args, quoted, context });
    return new ProbeShape(id);
  }
  static createFromSvgElement(element: SvgElement, context: ShapeCreationContext) {
    ProbeShape.svgCalls.push({ element, context });
    return new ProbeShape(element.attributes.id ?? 'probe');
  }
  constructor(id: string) { super(id, {}); }
  get tag() { return 'probe'; }
  protected get xKeys() { return []; }
  protected get yKeys() { return []; }
}

function registryWithProbe(): ShapeProviderRegistry {
  const registry = new ShapeProviderRegistry();
  registry.install(new Map<string, ShapeRegistration>([['probe', ProbeShape]]), new Map());
  return registry;
}

test('registry get/values preserve the installed registration objects and insertion order', () => {
  const registry = new ShapeProviderRegistry();
  registry.install(new Map<string, ShapeRegistration>([
    ['rect', RectShape], ['circle', CircleShape],
  ]), new Map());
  assert.equal(registry.get('rect'), RectShape);
  assert.equal(registry.get('circle'), CircleShape);
  assert.deepEqual(registry.values(), [RectShape, CircleShape]);
  assert.equal(typeof (registry as unknown as { set?: unknown }).set, 'undefined');
});

test('registry rejects unknown shape types with the contract error', () => {
  const registry = new ShapeProviderRegistry();
  registry.install(builtinShapeMap(), new Map());
  assert.throws(() => registry.get('box'), {
    message: 'unknown shape type: box (is the plugin loaded?)',
  });
});

test('registry installs exactly once', () => {
  const registry = new ShapeProviderRegistry();
  registry.install(builtinShapeMap(), new Map());
  assert.throws(() => registry.install(new Map(), new Map()));
});

test('registry delegates argument creation to the registered static method and passes itself as context', () => {
  ProbeShape.argumentsCalls = [];
  const registry = registryWithProbe();
  const shape = registry.createFromArguments('probe', 'p1', ['a', 'b'], [false, true]);
  assert.equal(shape.tag, 'probe');
  assert.equal(ProbeShape.argumentsCalls.length, 1);
  const call = ProbeShape.argumentsCalls[0]!;
  assert.equal(call.id, 'p1');
  assert.deepEqual(call.args, ['a', 'b']);
  assert.deepEqual(call.quoted, [false, true]);
  assert.equal(call.context, registry);
});

test('registry delegates SVG readback to the registered static method and passes itself as context', () => {
  ProbeShape.svgCalls = [];
  const registry = registryWithProbe();
  const element: SvgElement = { tag: 'probe', attributes: { id: 'p2' }, children: [] };
  const shape = registry.createFromSvgElement(element);
  assert.equal(shape.id, 'p2');
  assert.equal(ProbeShape.svgCalls.length, 1);
  assert.deepEqual(ProbeShape.svgCalls[0]!.element, element);
  assert.equal(ProbeShape.svgCalls[0]!.context, registry);
});

test('registry selects registered data-kind first and falls back to the SVG tag', () => {
  ProbeShape.svgCalls = [];
  const registry = registryWithProbe();
  const hinted = registry.createFromSvgElement({ tag: 'unknown', attributes: { id: 'x', 'data-kind': 'probe' }, children: [] });
  assert.equal(hinted.tag, 'probe');
  assert.equal(ProbeShape.svgCalls.length, 1);

  const builtins = new ShapeProviderRegistry();
  builtins.install(builtinShapeMap(), new Map());
  const circle = builtins.createFromSvgElement({ tag: 'circle', attributes: { id: 'c', cx: '1', cy: '2', r: '3' }, children: [] });
  assert.equal(circle.tag, 'circle');
  const degraded = builtins.createFromSvgElement({ tag: 'g', attributes: { id: 'g', 'data-kind': 'box' }, children: [] });
  assert.ok(degraded instanceof GroupShape);
  assert.equal(degraded.tag, 'g');
  assert.equal(degraded.getAttribute('fill'), undefined);
});

test('registry merges builtin and plugin maps into one read-only lookup', () => {
  const registry = new ShapeProviderRegistry();
  registry.install(builtinShapeMap(), new Map<string, ShapeRegistration>([['probe', ProbeShape]]));
  assert.equal(registry.get('rect'), RectShape);
  assert.equal(registry.get('probe'), ProbeShape);
  assert.deepEqual(registry.values().map(registration => registration.type), ['rect', 'circle', 'ellipse', 'line', 'text', 'g', 'probe']);
});
