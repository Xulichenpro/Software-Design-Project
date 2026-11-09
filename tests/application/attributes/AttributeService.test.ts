import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AttributeHandler } from '../../../src/application/attributes/AttributeHandler.js';
import type { AttributeOutcome } from '../../../src/application/attributes/AttributeOutcome.js';
import type { AttributeTransaction } from '../../../src/application/attributes/AttributeTransaction.js';
import type { ReadonlyShape } from '../../../src/application/attributes/ReadonlyShape.js';
import type { AttributeEditRequest } from '../../../src/application/contracts/AttributeEditParameters.js';
import { AttributeEditRecord } from '../../../src/application/records/AttributeEditRecord.js';
import { createReceiverEnvironment } from '../../helpers/builtins.js';

function setup(handlers: readonly AttributeHandler[] = []) {
  const env = createReceiverEnvironment({
    initialized: false,
    handlers: handlers.map(handler => [handler.name, handler] as const),
  });
  env.document.initialize();
  env.editor.create('rect', 'r', ['1', '2', '3', '4']);
  env.editor.create('text', 't', ['1', '2', 'hello'], undefined, [false, false, true]);
  return env;
}

class SetFillHandler extends AttributeHandler {
  readonly name: string = 'set-fill';
  calls = 0;
  failSelection = false;
  seenTarget: ReadonlyShape | undefined;
  handles(target: ReadonlyShape, attr: string): boolean {
    if (this.failSelection) throw new Error('replay must not select handlers');
    return target.id === 'r' && attr === 'fill';
  }
  apply(target: ReadonlyShape, _request: AttributeEditRequest, transaction: AttributeTransaction): AttributeOutcome {
    this.calls += 1;
    this.seenTarget = target;
    transaction.setAttribute('r', 'fill', 'custom');
    return { forwardLines: ['rect#r updated: fill=custom'], inverseLines: ['rect#r updated: fill=restored'] };
  }
}

class ExplodingHandler extends AttributeHandler {
  readonly name = 'exploding';
  handles(_target: ReadonlyShape, attr: string): boolean { return attr === 'width'; }
  apply(_target: ReadonlyShape, _request: AttributeEditRequest, transaction: AttributeTransaction): AttributeOutcome {
    transaction.setAttribute('r', 'width', '9');
    transaction.setAttribute('r', 'height', '9');
    throw new Error('handler exploded');
  }
}

class ExplodingDefaultAttributeHandler extends AttributeHandler {
  readonly name = 'exploding-default';
  handles(_target: ReadonlyShape, attr: string): boolean { return attr === 'fill'; }
  apply(_target: ReadonlyShape, _request: AttributeEditRequest, transaction: AttributeTransaction): AttributeOutcome {
    transaction.setAttribute('r', 'fill', 'broken');
    throw new Error('must not fall back');
  }
}

test('zero handlers use the Phase 1 default whitelist and produce one AttributeEditRecord', () => {
  const { attributes, tree, editor } = setup();
  const outcome = attributes.setAttribute({ id: 'r', name: 'fill', value: 'red', quoted: false });
  assert.ok(outcome.record instanceof AttributeEditRecord);
  assert.deepEqual(outcome.result.lines, ['rect#r updated: fill=red']);
  assert.deepEqual(outcome.record.forward.writes, [{ shapeId: 'r', name: 'fill', value: 'red' }]);
  assert.deepEqual(outcome.record.forward.lines, ['rect#r updated: fill=red']);
  assert.deepEqual(outcome.record.inverse.writes, [{ shapeId: 'r', name: 'fill', value: undefined }]);
  assert.deepEqual(outcome.record.inverse.lines, ['rect#r updated: fill=(default)']);
  assert.equal(tree.findShape('r').getAttribute('fill'), 'red');
  assert.ok(Object.isFrozen(outcome.record.forward));

  const undone = editor.setAttribute(outcome.record.inverse);
  assert.deepEqual(undone.lines, ['rect#r updated: fill=(default)']);
  assert.equal(tree.findShape('r').getAttribute('fill'), undefined);
  const redone = editor.setAttribute(outcome.record.forward);
  assert.deepEqual(redone.lines, ['rect#r updated: fill=red']);
  assert.equal(tree.findShape('r').getAttribute('fill'), 'red');
});

test('default path keeps Phase 1 messages for unknown attributes, numbers, non-negative values and text quotes', () => {
  const { attributes } = setup();
  assert.throws(() => attributes.setAttribute({ id: 'r', name: 'label', value: 'x', quoted: false }), {
    message: 'unknown attribute: label',
  });
  assert.throws(() => attributes.setAttribute({ id: 'r', name: 'width', value: 'Infinity', quoted: false }), /width must be finite/);
  assert.throws(() => attributes.setAttribute({ id: 'r', name: 'width', value: '-1', quoted: false }), /width must be non-negative/);
  assert.throws(() => attributes.setAttribute({ id: 'r', name: 'stroke-width', value: '-1', quoted: false }), /stroke-width/);
  assert.throws(() => attributes.setAttribute({ id: 't', name: 'text', value: 'unquoted', quoted: false }), {
    message: 'text content must be quoted',
  });
  const quoted = attributes.setAttribute({ id: 't', name: 'text', value: 'new text', quoted: true });
  assert.deepEqual(quoted.result.lines, ['text#t updated: text="new text"']);
});

test('one matching handler owns the edit, receives a ReadonlyShape and writes through the transaction', () => {
  const handler = new SetFillHandler();
  const { attributes, tree, editor } = setup([handler]);
  tree.findShape('r').setAttribute('fill', 'blue');
  const outcome = attributes.setAttribute({ id: 'r', name: 'fill', value: 'custom', quoted: false });
  assert.equal(handler.calls, 1);
  assert.equal(handler.seenTarget?.id, 'r');
  assert.equal(handler.seenTarget?.kind, 'rect');
  assert.equal(tree.findShape('r').getAttribute('fill'), 'custom');
  assert.deepEqual(outcome.record.forward.writes, [{ shapeId: 'r', name: 'fill', value: 'custom' }]);
  assert.deepEqual(outcome.record.forward.lines, ['rect#r updated: fill=custom']);
  assert.deepEqual(outcome.record.inverse.writes, [{ shapeId: 'r', name: 'fill', value: 'blue' }]);
  assert.deepEqual(outcome.record.inverse.lines, ['rect#r updated: fill=restored']);

  handler.failSelection = true;
  editor.setAttribute(outcome.record.inverse);
  assert.equal(tree.findShape('r').getAttribute('fill'), 'blue');
  editor.setAttribute(outcome.record.forward);
  assert.equal(tree.findShape('r').getAttribute('fill'), 'custom');
  assert.equal(handler.calls, 1);
});

test('multiple matching handlers are a conflict and perform no writes', () => {
  class OtherFillHandler extends SetFillHandler {
    override readonly name = 'other-fill';
  }
  const first = new SetFillHandler();
  const second = new OtherFillHandler();
  const { attributes, tree } = setup([first, second]);
  tree.findShape('r').setAttribute('fill', 'blue');
  assert.throws(() => attributes.setAttribute({ id: 'r', name: 'fill', value: 'red', quoted: false }), /conflict|multiple|more than one/i);
  assert.equal(first.calls, 0);
  assert.equal(second.calls, 0);
  assert.equal(tree.findShape('r').getAttribute('fill'), 'blue');
});

test('a handler that fails after partial writes is rolled back in reverse order and is never replaced by the default path', () => {
  const exploding = new ExplodingHandler();
  const { attributes, tree } = setup([exploding]);
  const before = { width: tree.findShape('r').getAttribute('width'), height: tree.findShape('r').getAttribute('height') };
  assert.throws(() => attributes.setAttribute({ id: 'r', name: 'width', value: '9', quoted: false }), /handler exploded/);
  assert.equal(tree.findShape('r').getAttribute('width'), before.width);
  assert.equal(tree.findShape('r').getAttribute('height'), before.height);

  const fallbackHandler = new ExplodingDefaultAttributeHandler();
  const second = setup([fallbackHandler]);
  const fillBefore = second.tree.findShape('r').getAttribute('fill');
  assert.throws(() => second.attributes.setAttribute({ id: 'r', name: 'fill', value: 'red', quoted: false }), /must not fall back/);
  assert.equal(second.tree.findShape('r').getAttribute('fill'), fillBefore);
});

test('unknown targets and uninitialized documents fail before any handler or write', () => {
  const handler = new SetFillHandler();
  const { attributes } = setup([handler]);
  assert.throws(() => attributes.setAttribute({ id: 'missing', name: 'fill', value: 'red', quoted: false }), /no such shape/);
  assert.equal(handler.calls, 0);
});
