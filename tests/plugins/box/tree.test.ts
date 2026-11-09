import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoxTypeDecorator } from '../../../plugins/box/src/BoxTypeDecorator.js';
import { addBox, createBoxEnvironment } from './fixtures.js';

const baseRows = [
  'svg (800x600)',
  '└── g#n1',
  '    ├── rect#n1-rect  x=120 y=100 w=160 h=60  fill=#4a90d9',
  '    └── text#n1-label  (140,135) "开始"',
];

test('a box renders g#n1 (box) with two-space summaries and no tag on its rect/text rows', () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  assert.deepEqual(environment.renderer.render(environment.tree).lines, [
    'svg (800x600)',
    '└── g#n1 (box)',
    '    ├── rect#n1-rect  x=120 y=100 w=160 h=60  fill=#4a90d9',
    '    └── text#n1-label  (140,135) "开始"',
  ]);
});

test('tree <id> uses the g#id heading plus (box) and keeps the same child summaries', () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  assert.deepEqual(environment.renderer.render(environment.tree, 'n1').lines, [
    'g#n1 (box)',
    '├── rect#n1-rect  x=120 y=100 w=160 h=60  fill=#4a90d9',
    '└── text#n1-label  (140,135) "开始"',
  ]);
});

test('without any decorator the Phase 1 base rows are byte-for-byte unchanged', () => {
  const environment = createBoxEnvironment({ decorators: [] });
  addBox(environment, 'n1');
  assert.deepEqual(environment.renderer.render(environment.tree).lines, baseRows);

  const decorated = createBoxEnvironment({ decorators: [new BoxTypeDecorator()] });
  addBox(decorated, 'n1');
  assert.deepEqual(
    decorated.renderer.render(decorated.tree).lines,
    baseRows.map(line => line === '└── g#n1' ? '└── g#n1 (box)' : line),
  );
});

test('nested boxes each receive their own (box) label', () => {
  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  addBox(environment, 'n3', 200, 150, 100, 50, 'inner', 'n1');
  assert.deepEqual(environment.renderer.render(environment.tree).lines, [
    'svg (800x600)',
    '└── g#n1 (box)',
    '    ├── rect#n1-rect  x=120 y=100 w=160 h=60  fill=#4a90d9',
    '    ├── text#n1-label  (140,135) "开始"',
    '    └── g#n3 (box)',
    '        ├── rect#n3-rect  x=200 y=150 w=100 h=50  fill=#4a90d9',
    '        └── text#n3-label  (220,185) "inner"',
  ]);
});
