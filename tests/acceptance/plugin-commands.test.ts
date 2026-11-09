import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
const failingCwdPreload = pathToFileURL(fileURLToPath(new URL('../fixtures/failing-cwd.ts', import.meta.url))).href;
const banner = "svg-editor 0.1 — type 'help' for commands";

interface CliOptions {
  readonly cwd?: string;
  readonly config?: string;
  readonly preload?: string;
  readonly env?: NodeJS.ProcessEnv;
}

function runCli(lines: readonly string[], options: CliOptions = {}): Promise<{ code: number | null; out: string; err: string }> {
  const args = ['--import', tsxLoader];
  if (options.preload) args.push('--import', options.preload);
  args.push(entry);
  if (options.config) args.push('--config', options.config);
  const child = spawn(process.execPath, args, {
    cwd: options.cwd ?? root,
    stdio: 'pipe',
    windowsHide: true,
    env: { ...process.env, ...options.env },
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

async function createFixedWorkingDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'svg-plugin-cwd-'));
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

function helpLine(lines: readonly string[], name: string): string | undefined {
  return lines.find(line => line === name || line.startsWith(name + ' '));
}

// Prompts are written without a trailing newline, so they prefix the first
// rendered line after each input. Strip the exact prompt to assert rendered
// lines; raw stdout is still compared byte-for-byte between routes A and B.
function renderedLines(output: string): string[] {
  return output.replaceAll('svg> ', '').split(/\r?\n/);
}

const otherSvg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect x="0" y="0" width="400" height="300" fill="#ffffff"/><text id="t1" x="10" y="290">imported</text><circle id="c1" cx="50" cy="50" r="10"/><g id="g1"><rect id="r2" x="0" y="0" width="10" height="10"/><circle id="c2" cx="5" cy="5" r="2"/></g><ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/></svg>';

test('an empty plugin config keeps stats and dir unloaded and unknown', async () => {
  const terminal = new ScriptTerminal(['help', 'stats', 'dir']);
  await new ApplicationBootstrap(terminal, undefined, noPluginsConfig).run();
  assert.equal(terminal.output[0], banner);
  const help = terminal.output;
  assert.equal(helpLine(help, 'stats'), undefined);
  assert.equal(helpLine(help, 'dir'), undefined);
  assert.deepEqual(terminal.output.filter(line => line.startsWith('error:')), [
    'error: unknown command: stats',
    'error: unknown command: dir',
  ]);
});

test('loaded plugins expose stats and dir in help, dir works before init and stats works after init', async () => {
  const directory = await createFixedWorkingDirectory();
  try {
    const result = await runCli([
      'help',
      'dir',
      'stats',
      'init 100 100',
      'create rect r 1 2 3 4',
      'stats',
    ], { cwd: directory });
    assert.equal(result.code, 0, result.err);
    assert.equal(result.err, '');
    const lines = renderedLines(result.out);
    const statsHelp = helpLine(lines, 'stats');
    const dirHelp = helpLine(lines, 'dir');
    assert.ok(statsHelp, 'stats help line');
    assert.ok(dirHelp, 'dir help line');
    assert.ok(lines.indexOf(statsHelp) < lines.indexOf(dirHelp), 'stats is listed before dir');

    assert.deepEqual(lines.filter(line => line.startsWith('error:')), [
      "error: no document. use 'init' or 'read' first",
    ]);
    const dirAt = lines.indexOf('[DIR]  docs');
    assert.ok(dirAt >= 0);
    assert.deepEqual(lines.slice(dirAt, dirAt + 4), [
      '[DIR]  docs', '[DIR]  plugins', '[FILE]  .hidden', '[FILE]  demo.svg',
    ]);
    assert.ok(lines.includes('rect: 1  (total 1, containers 0)'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('dir read failures report cannot read directory and later commands still run', async () => {
  const directory = await createFixedWorkingDirectory();
  const missing = join(directory, 'missing-working-directory');
  try {
    const result = await runCli(['dir', 'help', 'init 10 10'], {
      cwd: directory,
      preload: failingCwdPreload,
      env: { SVG_TEST_FAILING_CWD: missing },
    });
    assert.equal(result.code, 0, result.err);
    assert.equal(result.err, '');
    const lines = renderedLines(result.out);
    assert.deepEqual(lines.filter(line => line.startsWith('error:')), [
      `error: cannot read directory: ${missing}`,
    ]);
    assert.ok(helpLine(lines, 'stats'), 'stats help still renders after the failure');
    assert.ok(helpLine(lines, 'dir'), 'dir help still renders after the failure');
    assert.ok(lines.includes('canvas 10x10 created'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('code assembly A and config assembly B produce byte-identical plugin sessions', async () => {
  const directory = await createFixedWorkingDirectory();
  const storage = await mkdtemp(join(tmpdir(), 'svg-plugin-storage-'));
  try {
    const imported = join(storage, 'other.svg');
    const saved = join(storage, 'demo.svg');
    await writeFile(imported, otherSvg);
    const session = [
      'init 800 600',
      'create rect bg 0 0 800 600 #ffffff',
      'create text title 20 40 "My Diagram"',
      'create circle c1 100 100 20 red',
      'create rect box 200 80 60 60 #3366ff',
      'group markers c1 box',
      'tree',
      'move c1 30 0',
      'undo',
      'redo',
      'set title text "My Diagram v2"',
      'undo',
      'group bad c1 markers',
      'delete box',
      'undo',
      'stats',
      'dir',
      `save ${JSON.stringify(saved)}`,
      'undo',
      `read ${JSON.stringify(imported)}`,
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
    assert.deepEqual(lines.filter(line => line.startsWith('error:')), [
      'error: cannot group a container into its own descendant: markers',
      'error: undo not allowed after io command',
    ]);
    assert.ok(lines.includes('rect: 2  text: 1  circle: 1  (total 4, containers 1)'));
    assert.ok(lines.includes('rect: 2  text: 1  circle: 2  ellipse: 1  (total 6, containers 1)'));
    const dirAt = lines.indexOf('[DIR]  docs');
    assert.ok(dirAt >= 0);
    assert.deepEqual(lines.slice(dirAt, dirAt + 4), [
      '[DIR]  docs', '[DIR]  plugins', '[FILE]  .hidden', '[FILE]  demo.svg',
    ]);
    const statsHelp = helpLine(lines, 'stats');
    const dirHelp = helpLine(lines, 'dir');
    assert.ok(statsHelp, 'A must load the stats plugin');
    assert.ok(dirHelp, 'A must load the dir plugin');
    assert.ok(lines.indexOf(statsHelp) < lines.indexOf(dirHelp));
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(storage, { recursive: true, force: true });
  }
});

test('an empty plugin config reproduces the Phase 1 baseline byte for byte', async () => {
  const asset = await readFile(new URL('../assets/phase1-nested.svg', import.meta.url), 'utf8');
  const expectedTree = [
    'svg (320x200)',
    '└── g#flow',
    '    ├── rect#start  x=1 y=2 w=30 h=40  fill=blue',
    '    └── g#nested',
    '        ├── text#text1  (7,8) "开始"',
    '        └── circle#dot  cx=10 cy=20 r=3',
  ];
  const terminal = new ScriptTerminal(['read fixture.svg', 'move start 2 3', 'undo', 'redo', 'tree']);
  await new ApplicationBootstrap(
    terminal,
    { read: () => Promise.resolve(asset), async write() {} },
    noPluginsConfig,
  ).run();
  assert.deepEqual(terminal.output, [
    banner,
    'warning: assigned id text1 to unnamed <text>',
    'read fixture.svg (5 elements)',
    'rect#start moved to (3,5)',
    'rect#start moved back to (1,2)',
    'rect#start moved to (3,5)',
    ...expectedTree.map(line => line.replace('x=1 y=2', 'x=3 y=5')),
  ]);
});
