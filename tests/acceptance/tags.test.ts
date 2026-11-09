import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const entry = fileURLToPath(new URL('../../src/bootstrap/main.ts', import.meta.url));
const tsxLoader = pathToFileURL(join(root, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href;
const rootConfig = join(root, 'plugins.config.json');
const noPluginsConfig = fileURLToPath(new URL('../fixtures/no-plugins.config.json', import.meta.url));
const boxPluginsConfig = fileURLToPath(new URL('../fixtures/box-plugins.config.json', import.meta.url));
const treeStarOnlyConfig = fileURLToPath(new URL('../fixtures/tree-star-only.config.json', import.meta.url));
const banner = "svg-editor 0.1 — type 'help' for commands";

interface CliOptions {
  readonly cwd?: string;
  readonly config?: string;
}

function runCli(lines: readonly string[], options: CliOptions = {}): Promise<{ code: number | null; out: string; err: string }> {
  const args = ['--import', tsxLoader, entry];
  if (options.config) args.push('--config', options.config);
  const child = spawn(process.execPath, args, {
    cwd: options.cwd ?? root,
    stdio: 'pipe',
    windowsHide: true,
    env: process.env,
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let out = '';
  let err = '';
  child.stdout.on('data', (chunk: string) => { out += chunk; });
  child.stderr.on('data', (chunk: string) => { err += chunk; });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('CLI process timed out')); }, 25000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', code => { clearTimeout(timeout); resolve({ code, out, err }); });
    child.stdin.end(lines.join('\n'));
  });
}

function renderedLines(output: string): string[] {
  const lines = output.replaceAll('svg> ', '').split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

/** Splits rendered output into the consecutive blocks that start at a tree root line. */
function treeBlocks(lines: readonly string[]): string[][] {
  const blocks: string[][] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (!line.startsWith('svg (')) continue;
    const block = [line];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const next = lines[cursor]!;
      if (!(next.startsWith('svg (') || /^[│├└ ]/.test(next))) break;
      block.push(next);
      cursor++;
    }
    blocks.push(block);
    index = cursor - 1;
  }
  return blocks;
}

async function temporaryDirectory(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

async function createFixedWorkingDirectory(): Promise<string> {
  const directory = await temporaryDirectory('svg-tags-cwd-');
  try {
    await mkdir(join(directory, 'docs'));
    await mkdir(join(directory, 'plugins'));
    await writeFile(join(directory, 'demo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    await writeFile(join(directory, '.hidden'), '');
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return directory;
}

const boxTree = (suffix: string, x = 120, y = 100): readonly string[] => [
  ...(suffix === '' ? ['svg (800x600)'] : ['svg (800x600) *']),
  `└── g#n1 (box)${suffix}`,
  `    ├── rect#n1-rect  x=${x} y=${y} w=160 h=60  fill=#4a90d9${suffix}`,
  `    └── text#n1-label  (${x + 20},${y + 35}) "开始"${suffix}`,
];

test('tree shows both the box type label and the modified star with ancestors and new nodes marked', async () => {
  const directory = await temporaryDirectory('svg-tags-cwd-');
  try {
    const result = await runCli([
      'init 800 600',
      'create g parent',
      'create box n1 120 100 160 60 "开始" in parent',
      'tree',
      'set n1 fill #f5a623',
      'move n1 10 20',
      'tree',
    ], { cwd: directory });
    assert.equal(result.code, 0, result.err);
    assert.equal(result.err, '');
    const blocks = treeBlocks(renderedLines(result.out));
    assert.equal(blocks.length, 2);
    assert.deepEqual(blocks[0], [
      'svg (800x600) *',
      '└── g#parent *',
      '    └── g#n1 (box) *',
      '        ├── rect#n1-rect  x=120 y=100 w=160 h=60  fill=#4a90d9 *',
      '        └── text#n1-label  (140,135) "开始" *',
    ]);
    assert.deepEqual(blocks[1], [
      'svg (800x600) *',
      '└── g#parent *',
      '    └── g#n1 (box) *',
      '        ├── rect#n1-rect  x=130 y=120 w=160 h=60  fill=#f5a623 *',
      '        └── text#n1-label  (150,155) "开始" *',
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a successful save clears the stars but keeps (box); a successful read also clears the stars', async () => {
  const directory = await temporaryDirectory('svg-tags-cwd-');
  const storage = await temporaryDirectory('svg-tags-storage-');
  const saved = join(storage, 'tagged-box.svg');
  try {
    const result = await runCli([
      'init 800 600',
      'create box n1 120 100 160 60 "开始"',
      `save ${JSON.stringify(saved)}`,
      'tree',
      'move n1 10 20',
      'tree',
      `read ${JSON.stringify(saved)}`,
      'tree',
    ], { cwd: directory });
    assert.equal(result.code, 0, result.err);
    assert.equal(result.err, '');
    const blocks = treeBlocks(renderedLines(result.out));
    assert.equal(blocks.length, 3);
    assert.deepEqual(blocks[0], boxTree('', 120, 100));
    assert.deepEqual(blocks[1], boxTree(' *', 130, 120));
    assert.deepEqual(blocks[2], boxTree('', 120, 100));
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(storage, { recursive: true, force: true });
  }
});

test('undo back to the save point keeps the star under the saved-after-edit semantics', async () => {
  const directory = await temporaryDirectory('svg-tags-cwd-');
  const storage = await temporaryDirectory('svg-tags-storage-');
  const saved = join(storage, 'undo-tags.svg');
  try {
    const result = await runCli([
      'init 800 600',
      'create box n1 120 100 160 60 "开始"',
      `save ${JSON.stringify(saved)}`,
      'move n1 10 20',
      'tree',
      'undo',
      'tree',
    ], { cwd: directory });
    assert.equal(result.code, 0, result.err);
    assert.equal(result.err, '');
    const blocks = treeBlocks(renderedLines(result.out));
    assert.equal(blocks.length, 2);
    assert.deepEqual(blocks[0], boxTree(' *', 130, 120));
    assert.deepEqual(blocks[1], boxTree(' *', 120, 100), 'undo restores the saved geometry but the star stays');
    assert.ok(blocks[1]!.every(line => line === 'svg (800x600) *' || line.endsWith('*')));
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(storage, { recursive: true, force: true });
  }
});

test('stats counts a real box as one container over its rect and text leaves', async () => {
  const directory = await temporaryDirectory('svg-tags-cwd-');
  try {
    const result = await runCli([
      'init 800 600',
      'create box n1 120 100 160 60 "开始"',
      'stats',
    ], { cwd: directory });
    assert.equal(result.code, 0, result.err);
    assert.equal(result.err, '');
    const lines = renderedLines(result.out);
    assert.ok(lines.includes('rect: 1  text: 1  (total 2, containers 1)'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('route A and route B produce byte-identical tag sessions and leave the working directory untouched', async () => {
  const directory = await createFixedWorkingDirectory();
  const storage = await temporaryDirectory('svg-tags-storage-');
  const saved = join(storage, 'tags-session.svg');
  try {
    const before = (await readdir(directory)).sort();
    const session = [
      'init 800 600',
      'create g parent',
      'create box n1 120 100 160 60 "开始" in parent',
      'set n1 fill #f5a623',
      'move n1 10 20',
      'tree',
      'stats',
      'dir',
      `save ${JSON.stringify(saved)}`,
      'move n1 5 5',
      'undo',
      'tree',
      `read ${JSON.stringify(saved)}`,
      'tree',
      'stats',
      'help',
    ];
    const routeA = await runCli(session, { cwd: directory });
    const routeB = await runCli(session, { cwd: directory, config: rootConfig });
    assert.equal(routeA.code, 0, routeA.err);
    assert.equal(routeB.code, 0, routeB.err);
    assert.equal(routeA.err, '');
    assert.equal(routeB.err, '');
    assert.equal(routeA.out, routeB.out, 'A and B must be byte-for-byte identical');

    const lines = renderedLines(routeA.out);
    assert.deepEqual(lines.filter(line => line.startsWith('error:')), []);
    assert.ok(lines.includes('└── g#parent *'));
    assert.ok(lines.includes('    └── g#n1 (box) *'));
    assert.ok(lines.includes('rect: 1  text: 1  (total 2, containers 2)'));
    const dirAt = lines.indexOf('[DIR]  docs');
    assert.ok(dirAt >= 0);
    assert.deepEqual(lines.slice(dirAt, dirAt + 4), [
      '[DIR]  docs', '[DIR]  plugins', '[FILE]  .hidden', '[FILE]  demo.svg',
    ]);

    const after = (await readdir(directory)).sort();
    assert.deepEqual(after, before, 'the CLI must not write logs or output files into the working directory');
    await readFile(saved, 'utf8');
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(storage, { recursive: true, force: true });
  }
});

test('an empty plugin config reproduces the Phase 1 baseline byte for byte', async () => {
  const directory = await temporaryDirectory('svg-tags-cwd-');
  try {
    const result = await runCli([
      'init 800 600',
      'create rect r 1 2 3 4',
      'create text t 5 6 "hi"',
      'tree',
      'move r 1 1',
      'undo',
    ], { cwd: directory, config: noPluginsConfig });
    assert.equal(result.code, 0, result.err);
    assert.equal(result.err, '');
    assert.deepEqual(renderedLines(result.out), [
      banner,
      'canvas 800x600 created',
      'rect#r created',
      'text#t created',
      'svg (800x600)',
      '├── rect#r  x=1 y=2 w=3 h=4',
      '└── text#t  (5,6) "hi"',
      'rect#r moved to (2,3)',
      'rect#r moved back to (1,2)',
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('box-only assembly writes (box) without stars; tree-star-only assembly writes stars without (box)', async () => {
  const directory = await temporaryDirectory('svg-tags-cwd-');
  try {
    const boxOnly = await runCli([
      'init 800 600',
      'create box n1 120 100 160 60 "开始"',
      'tree',
    ], { cwd: directory, config: boxPluginsConfig });
    assert.equal(boxOnly.code, 0, boxOnly.err);
    assert.equal(boxOnly.err, '');
    const boxLines = renderedLines(boxOnly.out);
    assert.deepEqual(boxLines, [
      banner,
      'canvas 800x600 created',
      'box#n1 created (g#n1 + rect#n1-rect + text#n1-label)',
      'svg (800x600)',
      '└── g#n1 (box)',
      '    ├── rect#n1-rect  x=120 y=100 w=160 h=60  fill=#4a90d9',
      '    └── text#n1-label  (140,135) "开始"',
    ]);
    assert.equal(boxLines.some(line => line.includes('*')), false);

    const treeStarOnly = await runCli([
      'init 800 600',
      'create g parent',
      'create rect r 1 2 3 4 in parent',
      'tree',
    ], { cwd: directory, config: treeStarOnlyConfig });
    assert.equal(treeStarOnly.code, 0, treeStarOnly.err);
    assert.equal(treeStarOnly.err, '');
    const starLines = renderedLines(treeStarOnly.out);
    assert.deepEqual(starLines, [
      banner,
      'canvas 800x600 created',
      'g#parent created',
      'rect#r created in g#parent',
      'svg (800x600) *',
      '└── g#parent *',
      '    └── rect#r  x=1 y=2 w=3 h=4 *',
    ]);
    assert.equal(starLines.some(line => line.includes('(box)')), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
