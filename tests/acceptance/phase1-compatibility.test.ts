import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SvgXmlCodec } from '../../src/infrastructure/svg/SvgXmlCodec.js';
import { createQueryReceiver, createShapeRegistry } from '../helpers/builtins.js';
import { ApplicationBootstrap } from '../../src/bootstrap/ApplicationBootstrap.js';
import type { Terminal } from '../../src/application/contracts/Terminal.js';

const asset = (name: string) => readFile(new URL(`../assets/${name}`, import.meta.url), 'utf8');
const noPluginsConfig = fileURLToPath(new URL('../fixtures/no-plugins.config.json', import.meta.url));
const expectedTree = [
  'svg (320x200)',
  '└── g#flow',
  '    ├── rect#start  x=1 y=2 w=30 h=40  fill=blue',
  '    └── g#nested',
  '        ├── text#text1  (7,8) "开始"',
  '        └── circle#dot  cx=10 cy=20 r=3',
];

test('Phase 1 fixture retains byte-for-byte tree output and generated-id warnings', async () => {
  const imported = new SvgXmlCodec(createShapeRegistry()).decode(await asset('phase1-nested.svg'));
  assert.deepEqual(createQueryReceiver(imported.tree).tree().lines, expectedTree);
  assert.deepEqual(imported.warnings, ['assigned id text1 to unnamed <text>']);
});

test('Phase 1 CLI read, move, undo and redo retain their existing visible behavior', async () => {
  const lines = ['read fixture.svg', 'move start 2 3', 'undo', 'redo', 'tree'];
  const output: string[] = [];
  let cursor = 0;
  const terminal: Terminal = {
    async readLine() { return lines[cursor++]; },
    writeLine(line) { output.push(line); },
    close() {},
  };
  await new ApplicationBootstrap(
    terminal,
    { read: () => asset('phase1-nested.svg'), async write() {} },
    noPluginsConfig,
  ).run();
  assert.deepEqual(output, [
    "svg-editor 0.1 — type 'help' for commands",
    'warning: assigned id text1 to unnamed <text>',
    'read fixture.svg (5 elements)',
    'rect#start moved to (3,5)',
    'rect#start moved back to (1,2)',
    'rect#start moved to (3,5)',
    ...expectedTree.map(line => line.replace('x=1 y=2', 'x=3 y=5')),
  ]);
});

test('Phase 1 still rejects SVG outside its supported business vocabulary', async () => {
  const text = await asset('outline.svg');
  assert.throws(() => new SvgXmlCodec(createShapeRegistry()).decode(text), /unknown attribute: id/);
});

test('Phase 1 malformed XML still reports its established error', async () => {
  const text = await asset('incomplete.svg');
  assert.throws(() => new SvgXmlCodec(createShapeRegistry()).decode(text), { name: 'EditorError', message: 'invalid SVG XML' });
});
