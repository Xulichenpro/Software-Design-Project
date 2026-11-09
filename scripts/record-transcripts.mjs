import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { materializeFinal, replayWorkspace, repository, runTranscript, transcriptDirectory } from '../tests/helpers/transcript.ts';

const sessions = [
  { name: 'cli-1', baseline: true, saved: 'demo.svg' },
  { name: 'flowchart-a', baseline: true, saved: 'flowchart.svg' },
  { name: 'box', baseline: false, saved: 'flowchart-box.svg' },
  { name: 'plugins', baseline: false, saved: 'plugins.svg' },
];
await mkdir(join(transcriptDirectory, 'expected-svg'), { recursive: true });
for (const session of sessions) {
  const workspace = await replayWorkspace();
  try {
    const entry = session.baseline ? await materializeFinal(workspace.directory) : join(repository, 'src/bootstrap/main.ts');
    const input = await readFile(join(transcriptDirectory, `${session.name}.txt`), 'utf8');
    const result = await runTranscript(entry, workspace.cwd, input);
    if (result.code !== 0 || result.err) throw new Error(result.err || `cannot record ${session.name}`);
    await writeFile(join(transcriptDirectory, `${session.name}.expected.txt`), result.out);
    await writeFile(join(transcriptDirectory, 'expected-svg', session.saved), await readFile(join(workspace.directory, 'output', session.saved)));
    process.stdout.write(`recorded ${session.name}: ${session.baseline ? 'actual final' : 'route A'}\n`);
  } finally {
    await workspace.cleanup();
  }
}
const baseline = spawnSync('git', ['rev-parse', 'final^{commit}'], { cwd: repository, encoding: 'utf8', windowsHide: true });
if (baseline.status !== 0) throw new Error(baseline.stderr);
await writeFile(join(transcriptDirectory, 'provenance.json'), JSON.stringify({
  baseline: baseline.stdout.trim(),
  command: 'node --import tsx scripts/record-transcripts.mjs',
  sessions,
}, null, 2) + '\n');
