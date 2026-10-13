import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SvgXmlCodec } from '../../src/infrastructure/svg/SvgXmlCodec.js';
import { NodeFileGateway } from '../../src/infrastructure/files/NodeFileGateway.js';
import { ShapeFactory } from '../../src/domain/factory/ShapeFactory.js';
import { QueryReceiver } from '../../src/application/receivers/QueryReceiver.js';

const codec = new SvgXmlCodec(new ShapeFactory());
test('real XML round-trip escapes text/styles, nested shapes and absent styles', () => {
  const imported = codec.decode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><g id="g" fill="a&amp;b"><rect id="r" x="1" y="2" width="3" height="4"/><circle id="c" cx="1" cy="2" r="3"/><ellipse id="e" cx="1" cy="2" rx="3" ry="4"/><line id="l" x1="1" y1="2" x2="3" y2="4"/><text id="t" x="1" y="2">a &lt; b &amp; "c"</text></g></svg>');
  const text = codec.encode(imported.tree); assert.match(text, /a &lt; b &amp;/);
  assert.deepEqual(new QueryReceiver(codec.decode(text).tree).tree().lines, new QueryReceiver(imported.tree).tree().lines);
  assert.equal(imported.tree.findShape('r').getAttribute('fill'), undefined);
});

test('missing ids avoid every explicit id including later nodes and produce warnings', () => {
  const { tree, warnings } = codec.decode('<svg width="1" height="1"><rect width="0" height="0"/><g id="rect1"><rect id="rect2" width="1" height="1"/><text>hi</text></g></svg>');
  assert.equal(tree.findShape('rect3').getAttribute('x'), '0');
  assert.equal(tree.findShape('text1').getAttribute('text'), 'hi');
  assert.ok(warnings.some(w => w.includes('assigned id rect3 to unnamed <rect>')));
});

for (const body of [
  '<g id="same"/><circle id="same" r="1"/>', '<g transform="translate(1 2)"/>', '<path/>',
  '<rect width="-1"/>', '<text font-size="16">hi</text>', '<text><g/></text>', '<g>unexpected</g>',
  '<g id="a">', '<g/><svg/>', '<circle r="Infinity"/>', '<g xmlns="urn:other"/>', '<text text="hi"/>',
]) test(`reject unsupported or invalid SVG: ${body}`, () => {
  assert.throws(() => codec.decode(`<svg width="100" height="100">${body}</svg>`));
});
test('reject malformed XML, mismatched viewBox and document types', () => {
  for (const xml of ['<svg width="1" height="1" viewBox="1 0 1 1"/>', '<svg width="0" height="1"/>', '<svg width="1" height="1" unknown="x"/>', '<!DOCTYPE svg [<!ENTITY a "x">]><svg width="1" height="1"/>', '<svg width="1" height="1"/><svg/>']) assert.throws(() => codec.decode(xml));
});

test('NodeFileGateway atomically replaces files and cleans temporary files on failed writes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'svg-cli-')); const files = new NodeFileGateway();
  try {
    const path = join(dir, 'drawing.svg'); await files.write(path, 'old'); await files.write(path, 'new');
    assert.equal(await files.read(path), 'new'); assert.equal(await readFile(path, 'utf8'), 'new');
    const folder = join(dir, 'folder'); await mkdir(folder); await assert.rejects(files.write(folder, 'bad'), /cannot write file/);
    assert.deepEqual((await readdir(dir)).sort(), ['drawing.svg', 'folder']);
    await assert.rejects(files.read(join(dir, 'missing')), /cannot read file/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
