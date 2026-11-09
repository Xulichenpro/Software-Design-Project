import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { materializeFinal, replayWorkspace, repository, runTranscript, transcriptDirectory } from '../helpers/transcript.js';

const cases = [
  { name: 'cli-1', baseline: true, saved: 'demo.svg' },
  { name: 'flowchart-a', baseline: true, saved: 'flowchart.svg' },
  { name: 'box', baseline: false, saved: 'flowchart-box.svg' },
  { name: 'plugins', baseline: false, saved: 'plugins.svg' },
];

test('committed transcript inputs contain only commands/comments and have separate expected output', async () => {
  for (const { name } of cases) {
    const input = await readFile(join(transcriptDirectory, `${name}.txt`), 'utf8');
    assert.doesNotMatch(input, /^\s*(?:svg>|\$|svg-editor)/m);
    assert.ok(input.endsWith('\n'));
    assert.ok((await readFile(join(transcriptDirectory, `${name}.expected.txt`), 'utf8')).startsWith('svg-editor'));
  }
});

for (const item of cases) {
  test(`${item.name}: committed stdout and SVG match ${item.baseline ? 'actual final and no-plugin runtime' : 'both assembly routes'}`, async () => {
    const workspace = await replayWorkspace();
    try {
      const input = await readFile(join(transcriptDirectory, `${item.name}.txt`), 'utf8');
      const expected = await readFile(join(transcriptDirectory, `${item.name}.expected.txt`), 'utf8');
      const expectedSvg = await readFile(join(transcriptDirectory, 'expected-svg', item.saved), 'utf8');
      const entry = join(repository, 'src', 'bootstrap', 'main.ts');
      const firstEntry = item.baseline ? await materializeFinal(workspace.directory) : entry;
      const first = await runTranscript(firstEntry, workspace.cwd, input);
      assert.equal(first.code, 0, first.err);
      assert.equal(first.err, '');
      assert.equal(first.out, expected, 'first route must match committed stdout byte for byte');
      assert.equal(await readFile(join(workspace.directory, 'output', item.saved), 'utf8'), expectedSvg);
      const config = join(repository, item.baseline ? 'tests/fixtures/no-plugins.config.json' : 'plugins.config.json');
      const second = await runTranscript(entry, workspace.cwd, input, config);
      assert.equal(second.code, 0, second.err);
      assert.equal(second.err, '');
      assert.equal(second.out, first.out, 'both runtimes must have identical raw stdout');
      assert.equal(await readFile(join(workspace.directory, 'output', item.saved), 'utf8'), expectedSvg);
    } finally {
      await workspace.cleanup();
    }
  });
}
