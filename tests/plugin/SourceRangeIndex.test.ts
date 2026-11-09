import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import type { Element } from '@xmldom/xmldom';
import { XmlParser } from '../../src/infrastructure/svg/XmlParser.js';
import { SourceRangeIndex } from '../../extensions/vscode-svg/src/SourceRangeIndex.js';

const asset = (name: string) => readFile(new URL(`../assets/${name}`, import.meta.url), 'utf8');

function elements(element: Element): Element[] {
  const result = [element];
  for (let child = element.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1) result.push(...elements(child as Element));
  }
  return result;
}

test('source range includes each complete nested element and its closing tag', async () => {
  const text = await asset('outline.svg');
  const dom = new XmlParser().parse(text);
  const ranges = new SourceRangeIndex().build(text, dom);
  const root = ranges.get(dom.documentElement)!;
  const group = dom.getElementsByTagName('g').item(0)!;
  const range = ranges.get(group)!;
  assert.equal(text.slice(root.start, root.end), text.slice(text.indexOf('<svg'), text.lastIndexOf('</svg>') + 6));
  assert.equal(text.slice(range.start, range.end), text.slice(text.indexOf('<g id="flow">'), text.lastIndexOf('</g>') + 4));
});

test('source ranges use exclusive end offsets for self-closing elements on the same line', async () => {
  const text = await asset('duplicate-ids.svg');
  const dom = new XmlParser().parse(text);
  const ranges = new SourceRangeIndex().build(text, dom);
  const rectangles = dom.getElementsByTagName('rect');
  const first = ranges.get(rectangles.item(0)!)!;
  const second = ranges.get(rectangles.item(1)!)!;
  assert.equal(text.slice(first.start, first.end), '<rect id="same"/>');
  assert.equal(text.slice(second.start, second.end), '<rect/>');
  assert.ok(first.end < second.start);
});

test('range index identifies repeated and absent ids by DOM node identity', async () => {
  const text = await asset('duplicate-ids.svg');
  const dom = new XmlParser().parse(text);
  const ranges = new SourceRangeIndex().build(text, dom);
  assert.equal(ranges.size, 4);
  assert.equal(new Set([...ranges.values()].map(range => range.start)).size, 4);
});

test('ranges retain original UTF-16 offsets through CRLF, Unicode, comments and CDATA', async () => {
  const text = await asset('source-ranges.svg');
  assert.ok(text.includes('\r\n'), 'fixture must retain CRLF to exercise original-buffer offsets');
  const dom = new XmlParser().parse(text);
  const ranges = new SourceRangeIndex().build(text, dom);
  const rect = dom.getElementsByTagName('rect').item(0)!;
  const range = ranges.get(rect)!;
  assert.equal(range.start, text.indexOf('<rect id="actual"'));
  assert.equal(text.slice(range.start, range.end), '<rect id="actual" data-note="quoted > delimiter"/>');
  assert.equal(ranges.size, 5, 'comment and CDATA tag-like text must not become elements');
});

test('selection offsets cover only the opening tag name of multiline tags', async () => {
  const text = await asset('source-ranges.svg');
  const dom = new XmlParser().parse(text);
  const ranges = new SourceRangeIndex().build(text, dom);
  const group = dom.getElementsByTagName('g').item(0)!;
  const range = ranges.get(group)!;
  assert.equal(text.slice(range.nameStart, range.nameEnd), 'g');
  assert.equal(text.slice(range.start, range.end), '<g\r\n    id="group"><rect id="actual" data-note="quoted > delimiter"/></g>');
});

test('each selection lies within its element and each child lies within its parent', async () => {
  const text = await asset('source-ranges.svg');
  const dom = new XmlParser().parse(text);
  const ranges = new SourceRangeIndex().build(text, dom);
  for (const element of elements(dom.documentElement)) {
    const range = ranges.get(element)!;
    assert.ok(range.start <= range.nameStart && range.nameStart < range.nameEnd && range.nameEnd <= range.end);
    assert.equal(text.slice(range.nameStart, range.nameEnd), element.tagName);
    if (element.parentNode?.nodeType === 1) {
      const parent = ranges.get(element.parentNode as Element)!;
      assert.ok(parent.start <= range.start && range.end <= parent.end);
    }
  }
});
