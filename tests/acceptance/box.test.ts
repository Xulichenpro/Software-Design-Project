import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { ApplicationBootstrap } from '../../src/bootstrap/ApplicationBootstrap.js';
import { ScriptTerminal } from '../helpers/terminal.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const entry = fileURLToPath(new URL('../../src/bootstrap/main.ts', import.meta.url));
const tsxLoader = pathToFileURL(join(root, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href;
const rootConfig = join(root, 'plugins.config.json');
const noPluginsConfig = fileURLToPath(new URL('../fixtures/no-plugins.config.json', import.meta.url));
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

function boxSession(savedPath: string): string[] {
  return [
    'init 800 600',
    'create box n1 120 100 160 60 "开始"',
    'create box n2 520 100 160 60 "处理数据"',
    'create line arrow1 280 130 520 130 black',
    'group flowchart n1 n2 arrow1',
    'move n2 0 100',
    'undo',
    'set n2 fill #f5a623',
    'set n2 label "处理数据 v2"',
    'undo',
    'tree',
    `save ${JSON.stringify(savedPath)}`,
  ];
}

async function temporaryDirectory(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

function fileGateway(content: string) {
  return {
    async read(): Promise<string> { return content; },
    async write(): Promise<void> {},
  };
}

test('the Phase 1 section 6.1 version B box session renders the fixed transcript lines', async () => {
  const directory = await temporaryDirectory('svg-box-cwd-');
  const storage = await temporaryDirectory('svg-box-storage-');
  const saved = join(storage, 'flowchart-box.svg');
  try {
    const result = await runCli(boxSession(saved), { cwd: directory });
    assert.equal(result.code, 0, result.err);
    assert.equal(result.err, '');
    const lines = renderedLines(result.out);

    assert.equal(lines[0], banner);
    assert.deepEqual(lines.filter(line => line.startsWith('error:')), []);
    for (const expected of [
      'canvas 800x600 created',
      'box#n1 created (g#n1 + rect#n1-rect + text#n1-label)',
      'box#n2 created (g#n2 + rect#n2-rect + text#n2-label)',
      'line#arrow1 created',
      'g#flowchart created with 3 children',
      'box#n2 moved by (0,100)',
      'box#n2 moved back by (0,-100)',
      'box#n2 fill propagated to n2-rect',
      'box#n2 label updated: "处理数据 v2"',
      'box#n2 label restored: "处理数据"',
    ]) {
      assert.ok(lines.includes(expected), `missing line: ${expected}`);
    }

    const treeAt = lines.indexOf('svg (800x600)');
    assert.ok(treeAt >= 0);
    assert.deepEqual(lines.slice(treeAt, treeAt + 9), [
      'svg (800x600)',
      '└── g#flowchart',
      '    ├── g#n1 (box)',
      '    │   ├── rect#n1-rect  x=120 y=100 w=160 h=60  fill=#4a90d9',
      '    │   └── text#n1-label  (140,135) "开始"',
      '    ├── g#n2 (box)',
      '    │   ├── rect#n2-rect  x=520 y=100 w=160 h=60  fill=#f5a623',
      '    │   └── text#n2-label  (540,135) "处理数据"',
      '    └── line#arrow1  (280,130) -> (520,130)  stroke=black',
    ]);
    assert.ok(lines.includes(`saved to ${saved} (8 elements)`));
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(storage, { recursive: true, force: true });
  }
});

test('the same box session is byte-identical through code assembly A and config assembly B', async () => {
  const directory = await temporaryDirectory('svg-box-cwd-');
  const storage = await temporaryDirectory('svg-box-storage-');
  try {
    const routeA = await runCli(boxSession(join(storage, 'ab.svg')), { cwd: directory });
    const routeB = await runCli(boxSession(join(storage, 'ab.svg')), { cwd: directory, config: rootConfig });
    assert.equal(routeA.code, 0, routeA.err);
    assert.equal(routeB.code, 0, routeB.err);
    assert.equal(routeA.err, '');
    assert.equal(routeB.err, '');
    assert.equal(routeA.out, routeB.out, 'A and B must be byte-for-byte identical');
    assert.equal(renderedLines(routeA.out).filter(line => line.startsWith('error:')).length, 0);
    assert.ok(renderedLines(routeA.out).some(line => line === 'box#n1 created (g#n1 + rect#n1-rect + text#n1-label)'));
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(storage, { recursive: true, force: true });
  }
});

test('a saved box SVG degrades to a plain g without the box plugin and restores with it', async () => {
  const directory = await temporaryDirectory('svg-box-cwd-');
  const storage = await temporaryDirectory('svg-box-storage-');
  const saved = join(storage, 'readback-box.svg');
  try {
    const savedRun = await runCli([
      'init 800 600',
      'create box n1 120 100 160 60 "开始"',
      `save ${JSON.stringify(saved)}`,
    ], { cwd: directory });
    assert.equal(savedRun.code, 0, savedRun.err);
    const content = await readFile(saved, 'utf8');
    assert.match(content, /data-kind="box"/);

    const withoutBox = new ScriptTerminal(['read box.svg', 'tree']);
    await new ApplicationBootstrap(withoutBox, fileGateway(content), noPluginsConfig).run();
    assert.deepEqual(withoutBox.output, [
      banner,
      'read box.svg (3 elements)',
      'svg (800x600)',
      '└── g#n1',
      '    ├── rect#n1-rect  x=120 y=100 w=160 h=60  fill=#4a90d9',
      '    └── text#n1-label  (140,135) "开始"',
    ]);
    assert.equal(withoutBox.output.some(line => line.includes('(box)')), false);

    const withBox = new ScriptTerminal(['read box.svg', 'tree']);
    await new ApplicationBootstrap(withBox, fileGateway(content), rootConfig).run();
    assert.deepEqual(withBox.output, [
      banner,
      'read box.svg (3 elements)',
      'svg (800x600)',
      '└── g#n1 (box)',
      '    ├── rect#n1-rect  x=120 y=100 w=160 h=60  fill=#4a90d9',
      '    └── text#n1-label  (140,135) "开始"',
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(storage, { recursive: true, force: true });
  }
});

test('an empty plugin config matches the Phase 1 baseline and a box-free session is unchanged by the default assembly', async () => {
  const directory = await temporaryDirectory('svg-box-cwd-');
  try {
    const session = [
      'init 800 600',
      'create rect r 1 2 3 4',
      'create text t 5 6 "hi"',
      'tree',
      'move r 1 1',
      'undo',
    ];
    const expected = [
      banner,
      'canvas 800x600 created',
      'rect#r created',
      'text#t created',
      'svg (800x600)',
      '├── rect#r  x=1 y=2 w=3 h=4',
      '└── text#t  (5,6) "hi"',
      'rect#r moved to (2,3)',
      'rect#r moved back to (1,2)',
    ];
    const baseline = await runCli(session, { cwd: directory, config: noPluginsConfig });
    assert.equal(baseline.code, 0, baseline.err);
    assert.equal(baseline.err, '');
    assert.deepEqual(renderedLines(baseline.out), expected);

    const defaultAssembly = await runCli(session, { cwd: directory });
    assert.equal(defaultAssembly.code, 0, defaultAssembly.err);
    assert.equal(defaultAssembly.out, baseline.out, 'box must not change a session that never uses it');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
