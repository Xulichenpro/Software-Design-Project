import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PluginHost } from '../../src/bootstrap/PluginHost.js';
import { PluginLoader } from '../../src/bootstrap/PluginLoader.js';
import { RecordingTerminal } from '../helpers/terminal.js';

const loaderFixtures = fileURLToPath(new URL('./fixtures/loader/', import.meta.url));

interface PluginConfigEntry {
  readonly module: string;
  readonly enabled?: boolean;
  readonly options?: Readonly<Record<string, unknown>>;
}

function setup() {
  const terminal = new RecordingTerminal();
  const host = new PluginHost({ shapes: [], commands: [], attributes: [], decorators: [] }, terminal);
  const loader = new PluginLoader(host, terminal);
  return { host, loader, terminal };
}

async function withConfig(entries: readonly PluginConfigEntry[] | string, body: (configPath: string, configDir: string) => Promise<void>) {
  const configDir = await mkdtemp(join(loaderFixtures, '.tmp-'));
  try {
    const configPath = join(configDir, 'plugins.config.json');
    await writeFile(configPath, typeof entries === 'string' ? entries : JSON.stringify({ plugins: entries }));
    await body(configPath, configDir);
  } finally {
    await rm(configDir, { recursive: true, force: true });
  }
}

test('loader resolves a relative plugin directory through src/index.ts', async () => {
  const { host, loader, terminal } = setup();
  await withConfig([{ module: '../valid' }], async configPath => {
    await loader.load(configPath);
  });
  assert.deepEqual(terminal.errors, []);
  assert.equal(host.contributions.commands.has('ping'), true);
});

test('loader resolves index.ts when a plugin has no src directory', async () => {
  const { host, loader, terminal } = setup();
  await withConfig([{ module: '../index-only' }], async configPath => {
    await loader.load(configPath);
  });
  assert.deepEqual(terminal.errors, []);
  assert.equal(host.contributions.commands.has('index'), true);
});

test('loader resolves the package main entry of a plugin directory', async () => {
  const { host, loader, terminal } = setup();
  await withConfig([{ module: '../package-main' }], async configPath => {
    await loader.load(configPath);
  });
  assert.deepEqual(terminal.errors, []);
  assert.equal(host.contributions.commands.has('main'), true);
});

test('relative modules are resolved from the directory containing the config file', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'svg-loader-'));
  try {
    await cp(join(loaderFixtures, 'valid'), join(workspace, 'plugins', 'sample'), { recursive: true });
    const configPath = join(workspace, 'plugins.config.json');
    await writeFile(configPath, JSON.stringify({ plugins: [{ module: './plugins/sample' }] }));
    const { host, loader, terminal } = setup();
    await loader.load(configPath);
    assert.deepEqual(terminal.errors, []);
    assert.equal(host.contributions.commands.has('ping'), true);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('a bare npm package resolves from a relative config path', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'svg-loader-package-'));
  try {
    const packageName = '@fixture/generated-plugin';
    const packageDir = join(workspace, 'node_modules', packageName);
    await mkdir(packageDir, { recursive: true });
    await writeFile(join(packageDir, 'package.json'), JSON.stringify({
      name: packageName, type: 'module', main: './index.js', contributes: { commands: ['package-ping'] },
    }));
    await writeFile(join(packageDir, 'index.js'), `export default {
      activate(context) {
        context.registerCommand({ name: 'package-ping', help: 'package-ping', create() { throw new Error('unused'); } });
      }
    };`);
    const configPath = join(workspace, 'plugins.config.json');
    await writeFile(configPath, JSON.stringify({ plugins: [{ module: packageName }] }));
    const { host, loader, terminal } = setup();
    await loader.load(relative(process.cwd(), configPath));
    assert.deepEqual(terminal.errors, []);
    assert.equal(host.contributions.commands.has('package-ping'), true);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('malformed manifest lists roll back their plugins and later plugins still load', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'svg-loader-manifest-'));
  try {
    for (const [name, contributes] of [
      ['bad-list', { commands: {} }], ['bad-contributes', 'commands'],
    ] as const) {
      const packageDir = join(workspace, name);
      await cp(join(loaderFixtures, 'valid'), packageDir, { recursive: true });
      await writeFile(join(packageDir, 'package.json'), JSON.stringify({ name, contributes }));
      if (name === 'bad-contributes') await writeFile(join(packageDir, 'src', 'index.ts'), 'export default { activate() {} };');
    }
    await cp(join(loaderFixtures, 'valid'), join(workspace, 'valid'), { recursive: true });
    const configPath = join(workspace, 'plugins.config.json');
    await writeFile(configPath, JSON.stringify({ plugins: [
      { module: './bad-list' }, { module: './bad-contributes' }, { module: './valid' },
    ] }));
    const { host, loader, terminal } = setup();
    await loader.load(configPath);
    assert.equal(terminal.errors.length, 2);
    assert.match(terminal.errors[0]!, /^error: plugin manifest mismatch: bad-list \(declared: .*, registered: .*\)$/);
    assert.match(terminal.errors[1]!, /^error: plugin manifest mismatch: bad-contributes \(declared: .*, registered: .*\)$/);
    assert.deepEqual([...host.contributions.commands.keys()], ['ping']);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('a missing module reports plugin not found with the configured module string', async () => {
  const { host, loader, terminal } = setup();
  await withConfig([{ module: '../does-not-exist' }], async configPath => {
    await loader.load(configPath);
  });
  assert.deepEqual(terminal.errors, ['error: plugin not found: ../does-not-exist']);
  assert.equal(host.contributions.commands.size, 0);
});

test('a module without a default export reports no default export', async () => {
  const { loader, terminal } = setup();
  await withConfig([{ module: '../no-default' }], async configPath => {
    await loader.load(configPath);
  });
  assert.deepEqual(terminal.errors, ['error: plugin has no default export: ../no-default']);
});

test('a manifest mismatch is reported by the shared host path', async () => {
  const { host, loader, terminal } = setup();
  await withConfig([{ module: '../mismatch' }], async configPath => {
    await loader.load(configPath);
  });
  assert.equal(terminal.errors.length, 1);
  assert.match(terminal.errors[0]!, /^error: plugin manifest mismatch: @fixture\/plugin-mismatch/);
  assert.equal(host.contributions.commands.size, 0);
});

test('a module that exists but throws while evaluating is a failed activation, not not-found', async () => {
  const { loader, terminal } = setup();
  await withConfig([{ module: '../evaluate-failure' }], async configPath => {
    await loader.load(configPath);
  });
  assert.equal(terminal.errors.length, 1);
  assert.match(terminal.errors[0]!, /^error: plugin failed to activate: @fixture\/plugin-evaluate-failure \(.*eval-boom.*\)/);
  assert.ok(!terminal.errors[0]!.includes('plugin not found'));
});

test('an activate rejection reports plugin failed to activate with the plugin name and reason', async () => {
  const { host, loader, terminal } = setup();
  await withConfig([{ module: '../boom' }], async configPath => {
    await loader.load(configPath);
  });
  assert.equal(terminal.errors.length, 1);
  assert.match(terminal.errors[0]!, /^error: plugin failed to activate: @fixture\/plugin-boom \(activate-boom\)/);
  assert.equal(host.contributions.commands.size, 0);
});

test('invalid plugin config produces one error and no contributions', async () => {
  const { host, loader, terminal } = setup();
  await withConfig('{ not json', async configPath => {
    await loader.load(configPath);
  });
  assert.deepEqual(terminal.errors, ['error: invalid plugin config']);
  assert.equal(host.contributions.commands.size, 0);
});

test('a config whose plugins value is not an array is invalid', async () => {
  const { loader, terminal } = setup();
  await withConfig(JSON.stringify({ plugins: { module: '../valid' } }), async configPath => {
    await loader.load(configPath);
  });
  assert.deepEqual(terminal.errors, ['error: invalid plugin config']);
});

test('enabled:false is skipped completely while later plugins still load', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'svg-loader-workspace-'));
  try {
    const marker = join(workspace, 'marker.txt');
    const optionsFile = join(workspace, 'options.json');
    const { host, loader, terminal } = setup();
    await withConfig([
      { module: '../options', enabled: false, options: { marker, optionsFile } },
      { module: '../valid', options: { marker } },
    ], async configPath => {
      await loader.load(configPath);
    });
    assert.deepEqual(terminal.errors, []);
    assert.equal((await readFile(marker, 'utf8')).trim(), 'valid');
    await assert.rejects(stat(optionsFile), /ENOENT/);
    assert.equal(host.contributions.commands.has('options-cmd'), false);
    assert.equal(host.contributions.commands.has('ping'), true);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('options are passed unchanged and frozen to activate', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'svg-loader-options-'));
  try {
    const marker = join(workspace, 'marker.txt');
    const optionsFile = join(workspace, 'options.json');
    const { host, loader, terminal } = setup();
    await withConfig([{ module: '../options', options: { marker, optionsFile, fill: '#f5a623' } }], async configPath => {
      await loader.load(configPath);
    });
    assert.deepEqual(terminal.errors, []);
    const record = JSON.parse(await readFile(optionsFile, 'utf8')) as { frozen: boolean; options: Record<string, unknown> };
    assert.equal(record.frozen, true);
    assert.equal(record.options.fill, '#f5a623');
    assert.equal(record.options.marker, marker);
    assert.equal(host.contributions.commands.has('options-cmd'), true);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('plugins are loaded in config order', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'svg-loader-order-'));
  try {
    const marker = join(workspace, 'order.txt');
    const { loader, terminal } = setup();
    await withConfig([
      { module: '../valid', options: { marker } },
      { module: '../options', options: { marker, optionsFile: join(workspace, 'options.json') } },
    ], async configPath => {
      await loader.load(configPath);
    });
    assert.deepEqual(terminal.errors, []);
    assert.deepEqual((await readFile(marker, 'utf8')).trim().split(/\r?\n/), ['valid', 'options']);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test('one failing plugin does not prevent later plugins from loading', async () => {
  const { host, loader, terminal } = setup();
  await withConfig([{ module: '../does-not-exist' }, { module: '../valid' }], async configPath => {
    await loader.load(configPath);
  });
  assert.deepEqual(terminal.errors, ['error: plugin not found: ../does-not-exist']);
  assert.equal(host.contributions.commands.has('ping'), true);
});

test('a duplicate plugin is rejected by the host and earlier contributions survive', async () => {
  const { host, loader, terminal } = setup();
  await withConfig([{ module: '../valid' }, { module: '../valid' }], async configPath => {
    await loader.load(configPath);
  });
  assert.deepEqual(terminal.errors, ['error: duplicate registration: commands/ping']);
  assert.equal(host.contributions.commands.has('ping'), true);
});

test('a missing config file is an invalid plugin config', async () => {
  const { host, loader, terminal } = setup();
  const configDir = await mkdtemp(join(loaderFixtures, '.tmp-'));
  try {
    await loader.load(join(configDir, 'missing.json'));
  } finally {
    await rm(configDir, { recursive: true, force: true });
  }
  assert.deepEqual(terminal.errors, ['error: invalid plugin config']);
  assert.equal(host.contributions.commands.size, 0);
});
