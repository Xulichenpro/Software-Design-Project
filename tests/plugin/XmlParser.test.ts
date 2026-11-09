import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { XmlParser } from '../../src/infrastructure/svg/XmlParser.js';

const asset = (name: string) => readFile(new URL(`../assets/${name}`, import.meta.url), 'utf8');

test('XML parser preserves elements outside the CLI shape vocabulary and arbitrary attributes', async () => {
  const document = new XmlParser().parse(await asset('outline.svg'));
  assert.equal(document.documentElement.tagName, 'svg');
  assert.equal(document.documentElement.hasAttribute('width'), false);
  assert.equal(document.documentElement.getAttribute('data-note'), 'outline only');
  assert.equal(document.getElementsByTagName('path').length, 1);
  assert.equal(document.getElementsByTagName('stop').item(0)!.getAttribute('stop-color'), 'red');
});

test('XML parser preserves missing ids without generating CLI ids', async () => {
  const document = new XmlParser().parse(await asset('outline.svg'));
  assert.equal(document.getElementsByTagName('text').item(0)!.hasAttribute('id'), false);
  assert.equal(document.getElementsByTagName('path').item(0)!.hasAttribute('id'), false);
});

test('XML parser preserves duplicate source ids for a read-only outline', async () => {
  const document = new XmlParser().parse(await asset('duplicate-ids.svg'));
  assert.equal(document.getElementsByTagName('g').item(0)!.getAttribute('id'), 'same');
  assert.equal(document.getElementsByTagName('rect').item(0)!.getAttribute('id'), 'same');
});

test('XML parser rejects incomplete XML instead of silently repairing it', async () => {
  const text = await asset('incomplete.svg');
  assert.throws(() => new XmlParser().parse(text));
});

test('XML parser rejects mismatched closing tags', async () => {
  const text = await asset('mismatched.svg');
  assert.throws(() => new XmlParser().parse(text));
});
