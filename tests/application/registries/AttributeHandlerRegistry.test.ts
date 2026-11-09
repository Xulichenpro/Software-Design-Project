import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AttributeHandler } from '../../../src/application/attributes/AttributeHandler.js';
import { AttributeHandlerRegistry } from '../../../src/application/registries/AttributeHandlerRegistry.js';
import type { AttributeOutcome } from '../../../src/application/attributes/AttributeOutcome.js';
import type { AttributeEditRequest } from '../../../src/application/contracts/AttributeEditParameters.js';
import type { AttributeTransaction } from '../../../src/application/attributes/AttributeTransaction.js';
import type { ReadonlyShape } from '../../../src/application/attributes/ReadonlyShape.js';

class ProbeHandler extends AttributeHandler {
  readonly name: string;
  constructor(name: string) { super(); this.name = name; }
  handles(_target: ReadonlyShape, _attr: string): boolean { return false; }
  apply(_target: ReadonlyShape, _request: AttributeEditRequest, _transaction: AttributeTransaction): AttributeOutcome {
    return { forwardLines: [], inverseLines: [] };
  }
}

test('AttributeHandlerRegistry installs handler instances once and exposes ordered values', () => {
  const alpha = new ProbeHandler('alpha');
  const beta = new ProbeHandler('beta');
  const registry = new AttributeHandlerRegistry();
  registry.install(new Map([['alpha', alpha]]), new Map([['beta', beta]]));
  assert.equal(registry.get('alpha'), alpha);
  assert.equal(registry.get('beta'), beta);
  assert.deepEqual(registry.values(), [alpha, beta]);
  assert.equal(typeof (registry as unknown as { set?: unknown }).set, 'undefined');
  assert.throws(() => registry.get('missing'));
});

test('AttributeHandlerRegistry refuses a second install', () => {
  const registry = new AttributeHandlerRegistry();
  registry.install(new Map(), new Map());
  assert.throws(() => registry.install(new Map(), new Map()));
});
