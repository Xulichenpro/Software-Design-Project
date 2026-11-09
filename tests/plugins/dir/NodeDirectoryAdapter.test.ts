import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { DirectoryEntry } from '../../../plugins/dir/src/DirectoryReader.js';
import { NodeDirectoryAdapter } from '../../../plugins/dir/src/NodeDirectoryAdapter.js';
import { DirCommand } from '../../../plugins/dir/src/DirCommand.js';

function byName(items: readonly DirectoryEntry[]): Map<string, DirectoryEntry> {
  return new Map(items.map(item => [item.name, item]));
}

test('NodeDirectoryAdapter lists direct children of the injected directory, including hidden entries', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-dir-adapter-'));
  try {
    await mkdir(join(directory, 'docs'));
    await mkdir(join(directory, 'docs', 'nested'));
    await writeFile(join(directory, 'demo.svg'), '<svg/>');
    await writeFile(join(directory, '.hidden'), '');
    let linked = false;
    try {
      await symlink(join(directory, 'docs'), join(directory, 'docs-link'), 'junction');
      linked = true;
    } catch (error) {
      t.diagnostic(`symlink unavailable on this platform: ${(error as NodeJS.ErrnoException).code ?? String(error)}`);
    }

    const adapter = new NodeDirectoryAdapter(directory);
    assert.equal(adapter.currentDirectory(), directory);
    const items = await adapter.list(directory);
    const map = byName(items);

    assert.equal(map.get('docs')?.kind, 'directory');
    assert.equal(map.get('demo.svg')?.kind, 'file');
    assert.equal(map.get('.hidden')?.kind, 'file');
    assert.equal(map.has('nested'), false, 'listing must not recurse');
    assert.equal(map.has('.'), false);
    assert.equal(map.has('..'), false);
    const expected = linked ? ['.hidden', 'demo.svg', 'docs', 'docs-link'] : ['.hidden', 'demo.svg', 'docs'];
    assert.deepEqual([...map.keys()].sort(), [...expected].sort());
    if (linked) assert.equal(map.get('docs-link')?.kind, 'file', 'symlinks are reported as files');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('DirCommand over NodeDirectoryAdapter prints the real directory with exact markers', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-dir-real-'));
  try {
    await mkdir(join(directory, 'docs'));
    await writeFile(join(directory, 'demo.svg'), '<svg/>');
    await writeFile(join(directory, '.hidden'), '');
    let linked = false;
    try {
      await symlink(join(directory, 'docs'), join(directory, 'docs-link'), 'junction');
      linked = true;
    } catch (error) {
      t.diagnostic(`symlink unavailable on this platform: ${(error as NodeJS.ErrnoException).code ?? String(error)}`);
    }

    const result = await new DirCommand(new NodeDirectoryAdapter(directory)).execute();
    assert.deepEqual(result.lines, [
      '[DIR]  docs',
      '[FILE]  .hidden',
      '[FILE]  demo.svg',
      ...(linked ? ['[FILE]  docs-link'] : []),
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('DirCommand over NodeDirectoryAdapter reports a missing working directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'svg-dir-missing-'));
  try {
    const missing = join(directory, 'does-not-exist');
    await assert.rejects(
      async () => { await new DirCommand(new NodeDirectoryAdapter(missing)).execute(); },
      { message: `cannot read directory: ${missing}` },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
