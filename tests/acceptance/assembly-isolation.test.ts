import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bootstrap = new URL('../../src/bootstrap/ApplicationBootstrap.ts', import.meta.url).href;
const optionalPlugin = fileURLToPath(new URL('../../plugins/stats/src/index.ts', import.meta.url));
type Failure = 'missing' | 'evaluation';

function runIsolated(failure: Failure, configPath?: string): Promise<{ code: number | null; out: string; err: string }> {
  const script = `
    import { registerHooks } from 'node:module';
    const failure = ${JSON.stringify(failure)};
    const matches = value => value.replaceAll('\\\\', '/').includes('/plugins/stats/src/index.');
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (failure === 'missing' && matches(specifier)) throw new Error('optional plugin unavailable');
        return nextResolve(specifier, context);
      },
      load(url, context, nextLoad) {
        if (failure === 'evaluation' && matches(url)) {
          return { format: 'module', source: "export const manifest = { name: 'unavailable' }; export default {}; throw new Error('optional plugin evaluation failed');", shortCircuit: true };
        }
        return nextLoad(url, context);
      }
    });
    const { ApplicationBootstrap } = await import(${JSON.stringify(bootstrap)});
    const lines = ['init', 'create rect r 1 2 3 4', 'canvas', 'canvas 200 300', 'tree', 'stats'];
    const output = [];
    let cursor = 0;
    const terminal = { async readLine() { return lines[cursor++]; }, writeLine(line) { output.push(line); }, close() {} };
    await new ApplicationBootstrap(terminal, undefined, ${JSON.stringify(configPath)}).run();
    process.stdout.write(JSON.stringify(output));
  `;
  const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script], {
    cwd: root, stdio: 'pipe', windowsHide: true,
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let out = '', err = '';
  child.stdout.on('data', chunk => { out += chunk; });
  child.stderr.on('data', chunk => { err += chunk; });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('isolated assembly process timed out')); }, 15_000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', code => { clearTimeout(timeout); resolve({ code, out, err }); });
    child.stdin.end();
  });
}

for (const failure of ['missing', 'evaluation'] as const) {
  for (const config of ['empty', 'disabled'] as const) {
    test(`configuration assembly with ${config} plugins starts despite a code-assembly plugin's ${failure} failure`, async () => {
      const workspace = await mkdtemp(join(tmpdir(), 'svg-assembly-isolation-'));
      try {
        const configPath = join(workspace, 'plugins.config.json');
        await writeFile(configPath, JSON.stringify({ plugins: config === 'empty' ? [] : [
          { module: optionalPlugin, enabled: false },
        ] }));
        const result = await runIsolated(failure, configPath);
        assert.equal(result.code, 0, result.err);
        assert.equal(result.err, '');
        const output = JSON.parse(result.out) as string[];
        assert.ok(output.includes('rect#r created'));
        assert.ok(output.includes('canvas 800x600'));
        assert.ok(output.includes('canvas resized to 200x300'));
        assert.ok(output.some(line => line.includes('rect#r') && line.includes('x=1 y=2 w=3 h=4')));
        assert.deepEqual(output.filter(line => line.startsWith('error:')), ['error: unknown command: stats']);
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  }

  test(`the isolation probe detects the ${failure} failure when code assembly is selected`, async () => {
    const result = await runIsolated(failure);
    assert.notEqual(result.code, 0);
    assert.match(result.err, failure === 'missing' ? /optional plugin unavailable/ : /optional plugin evaluation failed/);
  });
}
