import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TreeRow } from '../../../src/application/tree/TreeRow.js';
import { BoxTypeDecorator } from '../../../plugins/box/src/BoxTypeDecorator.js';
import { createBoxEnvironment } from './fixtures.js';

function row(kind: string | undefined, base = 'g#n1', isRoot = false): TreeRow {
  return { id: isRoot ? undefined : 'n1', kind, isRoot, base };
}

test('the decorator is named box-type-label', () => {
  assert.equal(new BoxTypeDecorator().name, 'box-type-label');
});

test('only rows whose kind is box receive (box)', () => {
  const environment = createBoxEnvironment();
  const decorator = new BoxTypeDecorator();
  assert.equal(decorator.decorate(row('box'), environment.tree), '(box)');
  assert.equal(decorator.decorate(row('box', 'g#n1 *'), environment.tree), '(box)');

  for (const kind of ['g', 'rect', 'text', 'circle', 'line', undefined]) {
    assert.equal(decorator.decorate(row(kind), environment.tree), undefined);
  }
  assert.equal(decorator.decorate(row(undefined, 'svg (800x600)', true), environment.tree), undefined);
});
