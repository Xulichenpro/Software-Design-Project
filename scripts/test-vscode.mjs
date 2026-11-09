import { build } from 'esbuild';
import { runTests } from '@vscode/test-electron';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tests = join(root, '.vscode-test', 'suite.cjs');
await build({
  entryPoints: [join(root, 'extensions/vscode-svg/tests/suite.ts')],
  outfile: tests,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
});

const installed = process.env.VSCODE_TEST_DOWNLOAD === '1' ? undefined : process.env.VSCODE_EXECUTABLE_PATH ?? (process.platform === 'win32'
  ? join(process.env.LOCALAPPDATA ?? '', 'Programs/Microsoft VS Code/Code.exe')
  : undefined);
await runTests({
  ...(installed && existsSync(installed) ? { vscodeExecutablePath: installed } : {}),
  extensionDevelopmentPath: join(root, 'extensions/vscode-svg'),
  extensionTestsPath: tests,
  extensionTestsEnv: { SVG_TEST_ASSETS: join(root, 'tests/assets') },
  launchArgs: [
    '--disable-extensions',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-workspace-trust',
    join(root, 'tests/assets'),
  ],
});
