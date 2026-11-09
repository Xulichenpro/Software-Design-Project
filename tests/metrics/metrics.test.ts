import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const script = join(root, 'scripts', 'metrics.mjs');

function git(repo: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

async function write(repo: string, path: string, content: string): Promise<void> {
  const target = join(repo, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

async function fixture(run: (repo: string) => Promise<void>): Promise<void> {
  const repo = await mkdtemp(join(tmpdir(), 'phase-cli-metrics-'));
  try {
    git(repo, 'init', '--quiet');
    git(repo, 'config', 'user.name', 'Metrics Fixture');
    git(repo, 'config', 'user.email', 'metrics@example.invalid');
    git(repo, 'config', 'core.autocrlf', 'false');
    await run(repo);
  } finally {
    await rm(repo, { recursive: true, force: true });
  }
}

function commit(repo: string, tag: string): string {
  git(repo, 'add', '-A');
  git(repo, 'commit', '--quiet', '-m', tag);
  git(repo, 'tag', tag);
  return git(repo, 'rev-parse', 'HEAD');
}

async function report(repo: string, from: string, to: string, label = 'release-label'): Promise<string> {
  const directory = join(repo, 'reports');
  const child = spawn(process.execPath, [script, '--repo', repo, '--output', directory, '--from', from, '--to', to, '--label', label], {
    cwd: root, stdio: 'pipe', windowsHide: true,
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let out = '';
  let err = '';
  child.stdout.on('data', chunk => { out += chunk; });
  child.stderr.on('data', chunk => { err += chunk; });
  const code = await new Promise<number | null>((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('metrics script timed out')); }, 60_000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', status => { clearTimeout(timeout); resolve(status); });
  });
  assert.equal(code, 0, `metrics failed:\n${err}\n${out}`);
  const files = (await readdir(directory)).filter(name => name.endsWith('.md'));
  assert.equal(files.length, 1);
  return readFile(join(directory, files[0]!), 'utf8');
}

function row(text: string, path: string): string[] {
  const line = text.split('\n').find(candidate => candidate.startsWith(`| \`${path}\` |`));
  assert.ok(line, `missing report row for ${path}`);
  return line.split('|').slice(1, -1).map(value => value.trim());
}

test('historical metrics use immutable endpoint trees even when HEAD and the worktree differ', async () => {
  await fixture(async repo => {
    await write(repo, 'src/Changed.ts', 'export function changed() { return 0; }\n');
    await write(repo, 'src/Stable.ts', 'export function stable() { return 0; }\n');
    const baseline = commit(repo, 'fixture-baseline');
    await write(repo, 'src/Changed.ts', 'export function changed(flag: boolean) {\n  if (flag) return 1;\n  return 0;\n}\n');
    await write(repo, 'src/bootstrap/Assembly.ts', 'export function assemble() { return 1; }\n');
    await write(repo, 'plugins/example/src/Plugin.ts', 'export function plugin() { return 1; }\n');
    await write(repo, 'extensions/example/Extension.ts', 'export function extension() { return 1; }\n');
    const endpoint = commit(repo, 'fixture-target');
    await write(repo, 'src/Changed.ts', 'export function changed() { return 9; }\n');
    await write(repo, 'src/OnlyLater.ts', 'export function later() { return 2; }\n');
    commit(repo, 'fixture-later');
    const clean = await report(repo, 'fixture-baseline', 'fixture-target');
    await write(repo, 'src/Changed.ts', 'export function dirty() { if (true) { while (true) {} } }\n');
    await rm(join(repo, 'src/bootstrap/Assembly.ts'));
    await write(repo, 'src/Untracked.ts', 'export function untracked() { return true ? 1 : 2; }\n');
    const dirty = await report(repo, 'fixture-baseline', 'fixture-target');
    assert.equal(dirty, clean, 'historical output must be byte-identical after worktree changes');
    assert.match(clean, /\| 分类 \| fixture-baseline \| fixture-target \| 增量 \|/);
    assert.match(clean, /标签：`release-label`/);
    assert.ok(clean.includes(baseline));
    assert.ok(clean.includes(endpoint));
    assert.match(clean, /\| 内核（Kernel） \| 2 \| 3 \| \+1 \|/, 'unchanged source files contribute to endpoint totals');
    assert.deepEqual(row(clean.slice(clean.indexOf('## 内核（Kernel）')), 'src/Changed.ts').slice(-2), ['1', '4']);
    for (const category of ['内核', '装配', '插件', 'VSCode 扩展（单列']) assert.ok(clean.includes(category));
    assert.ok(!clean.includes('OnlyLater.ts'));
    assert.ok(!clean.includes('Untracked.ts'));
  });
});

test('AST complexity excludes type syntax, optional chains, strings, comments, and overload signatures', async () => {
  await fixture(async repo => {
    await write(repo, 'src/Types.ts', 'export interface CommandResult { message: string }\n');
    await write(repo, 'src/Optional.ts', 'export function optional(value: { child: { label: string } }) { return value.child.label; }\n');
    await write(repo, 'src/Decisions.ts', 'export function decisions(flag: boolean) { return flag; }\n');
    commit(repo, 'fixture-baseline');
    await write(repo, 'src/Types.ts', 'export interface CommandResult { message?: string; run?(value?: string): void }\nexport type Choice<T> = T extends string ? true : false;\n');
    await write(repo, 'src/Optional.ts', [
      'export function optional(value?: { child?: { label?: string } }) {',
      '  const text = "if for while case catch && || ?";',
      '  const expression = /if|while|for|catch|case/;',
      '  const template = `for ? && ||`;',
      '  // if (value) while (value) {}',
      '  /* catch case for && || ? */',
      '  return value?.child?.label;',
      '}',
      '',
    ].join('\n'));
    await write(repo, 'src/Decisions.ts', 'export function decisions(flag: boolean) { if (flag) return flag ? 1 : 2; return 0; }\n');
    await write(repo, 'src/Functions.ts', [
      'export function overloaded(value: string): string;',
      'export function overloaded(value: number): number;',
      'export function overloaded(value: unknown) { return value; }',
      'export class Example {',
      '  constructor() {}',
      '  method() { return 1; }',
      '  get value() { return 1; }',
      '  set value(value: number) {}',
      '}',
      'export const arrow = () => 1;',
      'export const expression = function () { return 1; };',
      '',
    ].join('\n'));
    await write(repo, 'src/Control.ts', [
      'export function control(value: any) {',
      '  let result = value;',
      '  for (let i = 0; i < 1; i++) {}',
      '  for (const key in value) {}',
      '  for (const item of value) {}',
      '  while (result) { break; }',
      '  do { break; } while (result);',
      '  switch (result) { case 1: break; case 2: break; default: break; }',
      '  try {} catch (error) {}',
      '  result = (value && result) || (value ?? result);',
      '  result &&= value; result ||= value; result ??= value;',
      '  return result;',
      '}',
      '',
    ].join('\n'));
    await write(repo, 'src/Heritage.ts', 'export class Example extends (true ? Error : TypeError) {}\n');
    await write(repo, 'src/Nested.ts', 'export function outer(flag: boolean) { return function inner() { if (flag) return `value ${flag ? 1 : 0}`; return ""; }; }\n');
    commit(repo, 'fixture-target');
    const text = await report(repo, 'fixture-baseline', 'fixture-target');
    assert.deepEqual(row(text, 'src/Types.ts').slice(1), ['0', '0', '+0']);
    assert.deepEqual(row(text, 'src/Optional.ts').slice(1), ['1', '1', '+0']);
    assert.deepEqual(row(text, 'src/Decisions.ts').slice(1), ['1', '3', '+2']);
    assert.deepEqual(row(text, 'src/Functions.ts').slice(1), ['0', '7', '+7']);
    assert.deepEqual(row(text, 'src/Control.ts').slice(1), ['0', '15', '+15']);
    assert.deepEqual(row(text, 'src/Heritage.ts').slice(1), ['0', '1', '+1']);
    assert.deepEqual(row(text, 'src/Nested.ts').slice(1), ['0', '4', '+4']);
    assert.match(text, /TypeScript 7\.0\.2/);
    assert.match(text, /AST/);
  });
});

test('tooling inventory includes the build config and excludes dependencies, locks, and build output', async () => {
  await fixture(async repo => {
    await write(repo, 'tsconfig.build.json', '{"include":["src"]}\n');
    commit(repo, 'fixture-baseline');
    await write(repo, 'tsconfig.build.json', '{\n  "include": ["src", "plugins"]\n}\n');
    await write(repo, 'plugins/demo/node_modules/dependency/index.ts', 'export function dependency() {}\n');
    await write(repo, 'plugins/demo/dist/compiled.ts', 'export function compiled() {}\n');
    await write(repo, 'plugins/demo/out/compiled.ts', 'export function compiled() {}\n');
    await write(repo, 'extensions/demo/build/compiled.js', 'export function compiled() {}\n');
    await write(repo, 'plugins/demo/package-lock.json', '{}\n');
    await write(repo, 'package-lock.json', '{}\n');
    commit(repo, 'fixture-target');
    const text = await report(repo, 'fixture-baseline', 'fixture-target');
    assert.deepEqual(row(text, 'tsconfig.build.json').slice(-4), ['3', '1', '1', '3']);
    assert.match(text, /TypeScript 发布构建范围/);
    assert.ok(!text.includes('compiled.ts'));
    assert.ok(!text.includes('compiled.js'));
    assert.ok(!text.includes('dependency/index.ts'));
    assert.ok(!text.includes('package-lock.json'));
    assert.match(text, /\| 插件（Plugin） \| 0 \| 0 \| \+0 \|/);
  });
});

test('added and deleted source files have zero complexity and lines at their missing endpoint', async () => {
  await fixture(async repo => {
    await write(repo, 'src/Removed.ts', 'export function removed() {\n  return 0;\n}\n');
    commit(repo, 'fixture-baseline');
    await rm(join(repo, 'src/Removed.ts'));
    await write(repo, 'src/Added.ts', 'export function added(flag: boolean) { return flag ? 1 : 0; }\n');
    commit(repo, 'fixture-target');
    const text = await report(repo, 'fixture-baseline', 'fixture-target');
    assert.deepEqual(row(text, 'src/Added.ts').slice(1), ['0', '2', '+2']);
    assert.deepEqual(row(text, 'src/Removed.ts').slice(1), ['1', '0', '-1']);
    const inventory = text.slice(text.indexOf('## 内核（Kernel）'));
    assert.deepEqual(row(inventory, 'src/Added.ts').slice(-4), ['1', '0', '0', '1']);
    assert.deepEqual(row(inventory, 'src/Removed.ts').slice(-4), ['0', '3', '3', '0']);
  });
});
