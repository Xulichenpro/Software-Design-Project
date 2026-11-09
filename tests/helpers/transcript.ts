import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const repository = fileURLToPath(new URL('../../', import.meta.url));
export const transcriptDirectory = join(repository, 'doc', 'transcript');

export async function replayWorkspace(): Promise<{ directory: string; cwd: string; cleanup(): Promise<void> }> {
  const imported = await readFile(join(transcriptDirectory, 'assets', 'other.svg'));
  const directory = await mkdtemp(join(tmpdir(), 'svg-transcripts-'));
  const cwd = join(directory, 'cwd');
  await Promise.all(['cwd/docs', 'cwd/plugins', 'input', 'output'].map(path => mkdir(join(directory, path), { recursive: true })));
  await writeFile(join(cwd, '.hidden'), '');
  await writeFile(join(cwd, 'demo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  await writeFile(join(directory, 'input', 'other.svg'), imported);
  return {
    directory, cwd,
    async cleanup() {
      const withinTemporaryDirectory = relative(resolve(tmpdir()), resolve(directory));
      if (withinTemporaryDirectory.startsWith('..') || !withinTemporaryDirectory.startsWith('svg-transcripts-')) {
        throw new Error('refusing to remove an unexpected replay directory');
      }
      await rm(directory, { recursive: true, force: true });
    },
  };
}

/** Materialize the actual immutable Phase 1 Git objects, not a handwritten baseline. */
export async function materializeFinal(directory: string): Promise<string> {
  const baseline = join(directory, 'final');
  const listing = git(['ls-tree', '-r', '--name-only', 'final', '--', 'src', 'package.json']);
  for (const path of listing.split(/\r?\n/).filter(Boolean)) {
    const target = join(baseline, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, git(['show', `final:${path}`]));
  }
  await symlink(join(repository, 'node_modules'), join(baseline, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  return join(baseline, 'src', 'bootstrap', 'main.ts');
}

function git(args: readonly string[]): string {
  const result = spawnSync('git', [...args], { cwd: repository, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || 'cannot read baseline Git objects');
  return result.stdout;
}

export async function runTranscript(
  entry: string, cwd: string, input: string, config?: string,
): Promise<{ code: number | null; out: string; err: string }> {
  const loader = pathToFileURL(join(repository, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href;
  const args = ['--import', loader, entry, ...(config === undefined ? [] : ['--config', config])];
  const child = spawn(process.execPath, args, {
    cwd, stdio: 'pipe', windowsHide: true,
    env: { ...process.env, TSX_DISABLE_CACHE: '1', NODE_DISABLE_COMPILE_CACHE: '1' },
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let out = '', err = '';
  child.stdout.on('data', (chunk: string) => { out += chunk; });
  child.stderr.on('data', (chunk: string) => { err += chunk; });
  return new Promise((accept, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('transcript process timed out')); }, 30_000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', code => { clearTimeout(timeout); accept({ code, out, err }); });
    child.stdin.end(input);
  });
}
