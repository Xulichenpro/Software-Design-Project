import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SvgXmlCodec } from '../../../src/infrastructure/svg/SvgXmlCodec.js';
import { TreeRenderer } from '../../../src/application/tree/TreeRenderer.js';
import { TreeDecoratorRegistry } from '../../../src/application/registries/TreeDecoratorRegistry.js';
import { BoxTypeDecorator } from '../../../plugins/box/src/BoxTypeDecorator.js';
import {
  addBox, allShapeIds, boxSvg, createBoxEnvironment, createBoxRegistry, createBuiltinRegistry, svgDocument,
} from './fixtures.js';

function rendererWithBoxLabel(): TreeRenderer {
  const registry = new TreeDecoratorRegistry();
  registry.install(new Map(), new Map([['box-type-label', new BoxTypeDecorator()]]));
  return new TreeRenderer(registry);
}

test('data-kind box reads back as BoxShape with real child parts and a stable round-trip', () => {
  const codec = new SvgXmlCodec(createBoxRegistry());
  const tree = codec.decode(svgDocument(boxSvg('n1', 10, 20, 100, 50, '开始'))).tree;
  const box = tree.findShape('n1');

  assert.equal(box.kind, 'box');
  assert.equal(box.tag, 'g');
  assert.equal(box.label, 'box#n1');
  assert.deepEqual(box.descendants.map(child => child.id), ['n1-rect', 'n1-label']);
  const rect = tree.findShape('n1-rect');
  const label = tree.findShape('n1-label');
  assert.equal(rect.tag, 'rect');
  assert.equal(rect.getAttribute('x'), '10');
  assert.equal(rect.getAttribute('fill'), '#4a90d9');
  assert.equal(label.tag, 'text');
  assert.equal(label.getAttribute('text'), '开始');

  const encoded = codec.encode(tree);
  const reread = codec.decode(encoded).tree;
  assert.equal(reread.findShape('n1').kind, 'box');
  assert.deepEqual(allShapeIds(reread), allShapeIds(tree));
  assert.equal(codec.encode(reread), encoded);
  assert.deepEqual(
    rendererWithBoxLabel().render(reread).lines,
    rendererWithBoxLabel().render(tree).lines,
  );
});

test('without the box registration the same SVG degrades to a plain g with its real children', () => {
  const codec = new SvgXmlCodec(createBuiltinRegistry());
  const tree = codec.decode(svgDocument(boxSvg('n1', 10, 20, 100, 50, '开始'))).tree;
  const shape = tree.findShape('n1');

  assert.equal(shape.kind, 'g');
  assert.equal(shape.tag, 'g');
  assert.equal(shape.label, 'g#n1');
  assert.deepEqual(shape.descendants.map(child => child.id), ['n1-rect', 'n1-label']);
  assert.equal(shape.toSvgElement().attributes['data-kind'], undefined);
  assert.equal(codec.encode(tree).includes('data-kind'), false);

  const lines = rendererWithBoxLabel().render(tree).lines;
  assert.deepEqual(lines, [
    'svg (800x600)',
    '└── g#n1',
    '    ├── rect#n1-rect  x=10 y=20 w=100 h=50  fill=#4a90d9',
    '    └── text#n1-label  (30,55) "开始"',
  ]);
  assert.equal(lines.some(line => line.includes('(box)')), false);
});

test('a registered box with a missing or retyped required part rejects the whole read and keeps the document', async () => {
  const environment = createBoxEnvironment();
  environment.editor.create('rect', 'keep', ['0', '0', '10', '10']);
  const before = allShapeIds(environment.tree);

  const missingLabel = svgDocument(
    '<g id="n1" data-kind="box">' +
    '<rect id="n1-rect" x="10" y="20" width="100" height="50" fill="#4a90d9"/>' +
    '</g>',
  );
  const missingRect = svgDocument(
    '<g id="n2" data-kind="box">' +
    '<text id="n2-label" x="30" y="55">开始</text>' +
    '</g>',
  );
  const retypedRect = svgDocument(
    '<g id="n3" data-kind="box">' +
    '<circle id="n3-rect" cx="1" cy="2" r="3"/>' +
    '<text id="n3-label" x="30" y="55">开始</text>' +
    '</g>',
  );

  for (const [name, content] of [['missing-label.svg', missingLabel], ['missing-rect.svg', missingRect], ['retyped.svg', retypedRect]] as const) {
    environment.files.files.set(name, content);
    await assert.rejects(async () => { await environment.document.read(name); });
    assert.deepEqual(allShapeIds(environment.tree), before, `${name} must not change the document`);
    assert.equal(environment.document.associatedPath, undefined);
  }
});

test('duplicate ids involving box parts reject the whole read and keep the document', async () => {
  const environment = createBoxEnvironment();
  environment.editor.create('rect', 'keep', ['0', '0', '10', '10']);
  const before = allShapeIds(environment.tree);

  const duplicatePart = svgDocument(
    boxSvg('n1', 10, 20, 100, 50, '开始'),
    '<rect id="n1-rect" x="0" y="0" width="1" height="1"/>',
  );
  const duplicateBoxId = svgDocument(
    '<g id="n1" data-kind="box">' +
    '<rect id="n1" x="10" y="20" width="100" height="50" fill="#4a90d9"/>' +
    '<text id="n1-label" x="30" y="55">开始</text>' +
    '</g>',
  );

  for (const [name, content] of [['duplicate-part.svg', duplicatePart], ['duplicate-box.svg', duplicateBoxId]] as const) {
    environment.files.files.set(name, content);
    await assert.rejects(async () => { await environment.document.read(name); });
    assert.deepEqual(allShapeIds(environment.tree), before, `${name} must not change the document`);
    assert.equal(environment.document.associatedPath, undefined);
  }
});

test('g styles read back onto the box itself and set stroke output reads back again', () => {
  const codec = new SvgXmlCodec(createBoxRegistry());
  const styled = svgDocument(boxSvg('n1', 10, 20, 100, 50, '开始', ' stroke="red" stroke-width="2" fill="#ffffff"'));
  const tree = codec.decode(styled).tree;
  const box = tree.findShape('n1');
  assert.equal(box.getAttribute('stroke'), 'red');
  assert.equal(box.getAttribute('stroke-width'), '2');
  assert.equal(box.getAttribute('fill'), '#ffffff');
  assert.equal(tree.findShape('n1-rect').getAttribute('fill'), '#4a90d9');

  const environment = createBoxEnvironment();
  addBox(environment, 'n1');
  environment.editor.setAttribute({ id: 'n1', name: 'stroke', value: 'blue', quoted: false });
  const encoded = new SvgXmlCodec(environment.shapes).encode(environment.tree);
  const reread = new SvgXmlCodec(environment.shapes).decode(encoded).tree;
  assert.equal(reread.findShape('n1').getAttribute('stroke'), 'blue');
  assert.equal(reread.findShape('n1-rect').getAttribute('fill'), '#4a90d9');
});

test('nested boxes restore data-kind recursively and reject a nested box missing a part', () => {
  const codec = new SvgXmlCodec(createBoxRegistry());
  const nested = svgDocument(boxSvg(
    'n1', 120, 100, 160, 60, 'outer', '',
    boxSvg('n3', 200, 150, 100, 50, 'inner'),
  ));
  const tree = codec.decode(nested).tree;
  const outer = tree.findShape('n1');
  assert.equal(outer.kind, 'box');
  assert.deepEqual(outer.descendants.map(child => child.id), ['n1-rect', 'n1-label', 'n3']);
  const inner = tree.findShape('n3');
  assert.equal(inner.kind, 'box');
  assert.deepEqual(inner.descendants.map(child => child.id), ['n3-rect', 'n3-label']);
  assert.equal(tree.findShape('n3-label').getAttribute('text'), 'inner');

  const encoded = codec.encode(tree);
  const reread = codec.decode(encoded).tree;
  assert.equal(reread.findShape('n1').kind, 'box');
  assert.equal(reread.findShape('n3').kind, 'box');
  assert.equal(codec.encode(reread), encoded);

  const brokenNested = svgDocument(
    '<g id="n1" data-kind="box">' +
    '<rect id="n1-rect" x="120" y="100" width="160" height="60" fill="#4a90d9"/>' +
    '<text id="n1-label" x="140" y="135">outer</text>' +
    '<g id="n3" data-kind="box">' +
    '<rect id="n3-rect" x="200" y="150" width="100" height="50" fill="#4a90d9"/>' +
    '</g></g>',
  );
  assert.throws(() => codec.decode(brokenNested));
});
