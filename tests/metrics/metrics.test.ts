import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

function runMetrics(): Promise<{ code: number | null; out: string; err: string }> {
  const child = spawn(process.execPath, ['scripts/metrics.mjs', '--from', 'final', '--to', 'HEAD'], {
    cwd: root, stdio: 'pipe', windowsHide: true,
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let out = '';
  let err = '';
  child.stdout.on('data', chunk => { out += chunk; });
  child.stderr.on('data', chunk => { err += chunk; });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('metrics script timed out')); }, 60_000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', code => { clearTimeout(timeout); resolve({ code, out, err }); });
  });
}

test('metrics script is executable and writes a git-history-derived kernel/assembly/plugin report', async () => {
  const script = join(root, 'scripts', 'metrics.mjs');
  const info = await stat(script);
  assert.ok(info.isFile());
  const source = await readFile(script, 'utf8');
  assert.match(source, /docs\/metrics/);
  assert.match(source, /metrics/);
  assert.match(source, /git/i);

  const result = await runMetrics();
  assert.equal(result.code, 0, `metrics failed:\n${result.err}\n${result.out}`);

  const directory = join(root, 'docs', 'metrics');
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries.filter(entry => entry.isFile());
  assert.ok(files.length > 0, 'docs/metrics must contain a generated report');

  let text = '';
  for (const entry of files) text += await readFile(join(directory, entry.name), 'utf8');
  for (const category of ['内核', '装配', '插件']) assert.match(text, new RegExp(category));
  assert.match(text, /git/i);
  assert.match(text, /(历史|history)/i);
  assert.match(text, /(生成|generated)/i);
});
