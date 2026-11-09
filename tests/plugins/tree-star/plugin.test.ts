import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import type {
  AttributeHandler, CommandRegistration, PluginContext, PluginManifest, ShapeRegistration, TreeDecorator,
} from '../../../src/extension-api/index.js';
import type { Terminal } from '../../../src/application/contracts/Terminal.js';
import { PluginHost } from '../../../src/bootstrap/PluginHost.js';
import plugin, { manifest } from '../../../plugins/tree-star/src/index.js';
import { ModifiedStarDecorator } from '../../../plugins/tree-star/src/ModifiedStarDecorator.js';

class RecordingContext implements PluginContext {
  readonly shapes: ShapeRegistration[] = [];
  readonly commands: CommandRegistration[] = [];
  readonly attributes: AttributeHandler[] = [];
  readonly decorators: TreeDecorator[] = [];
  registerShape(registration: ShapeRegistration): void { this.shapes.push(registration); }
  registerCommand(registration: CommandRegistration): void { this.commands.push(registration); }
  registerAttribute(handler: AttributeHandler): void { this.attributes.push(handler); }
  registerDecorator(decorator: TreeDecorator): void { this.decorators.push(decorator); }
}

class RecordingTerminal implements Terminal {
  readonly output: string[] = [];
  async readLine(): Promise<string | undefined> { return undefined; }
  writeLine(text: string): void { this.output.push(text); }
  close(): void {}
  get errors(): readonly string[] { return this.output.filter(line => line.startsWith('error:')); }
}

const builtinNames = {
  shapes: ['rect', 'circle', 'ellipse', 'line', 'text', 'g'],
  commands: ['init', 'create'],
  attributes: [] as readonly string[],
  decorators: [] as readonly string[],
};

test('the tree-star package activates exactly one decorator named modified-star', async () => {
  const context = new RecordingContext();
  await plugin.activate(context);

  assert.equal(context.decorators.length, 1);
  assert.equal(context.decorators[0]!.name, 'modified-star');
  assert.ok(context.decorators[0] instanceof ModifiedStarDecorator);
  assert.deepEqual(context.shapes, []);
  assert.deepEqual(context.commands, []);
  assert.deepEqual(context.attributes, []);
});

test('package.json declares exactly the decorator the plugin registers and no commands', async () => {
  const context = new RecordingContext();
  await plugin.activate(context);
  const pkg = JSON.parse(await readFile(new URL('../../../plugins/tree-star/package.json', import.meta.url), 'utf8')) as {
    name?: string;
    contributes?: {
      shapes?: readonly string[];
      commands?: readonly string[];
      attributes?: readonly string[];
      decorators?: readonly string[];
    };
  };

  assert.equal(pkg.name, '@svgframe/plugin-tree-star');
  assert.deepEqual([...(pkg.contributes?.decorators ?? [])].sort(), context.decorators.map(decorator => decorator.name).sort());
  assert.deepEqual(pkg.contributes?.commands ?? [], []);
  assert.deepEqual(pkg.contributes?.shapes ?? [], []);
  assert.deepEqual(pkg.contributes?.attributes ?? [], []);

  assert.equal(manifest.name, pkg.name);
  assert.deepEqual(manifest.contributes?.decorators, pkg.contributes?.decorators);
  assert.deepEqual(manifest.contributes?.commands ?? [], []);
  assert.deepEqual(manifest.contributes?.shapes ?? [], []);
  assert.deepEqual(manifest.contributes?.attributes ?? [], []);
});

test('PluginHost accepts the whole tree-star package when the decorator name is free', async () => {
  const terminal = new RecordingTerminal();
  const host = new PluginHost(builtinNames, terminal);
  await host.load(plugin, manifest);

  assert.deepEqual(terminal.output, []);
  assert.equal(host.contributions.decorators.get('modified-star') instanceof ModifiedStarDecorator, true);
  assert.equal(host.contributions.shapes.size, 0);
  assert.equal(host.contributions.commands.size, 0);
  assert.equal(host.contributions.attributes.size, 0);
});

test('a duplicate modified-star registration rejects the whole staged package', async () => {
  const terminal = new RecordingTerminal();
  const host = new PluginHost({ ...builtinNames, decorators: ['modified-star'] }, terminal);
  await host.load(plugin, manifest);

  assert.deepEqual(terminal.errors, ['error: duplicate registration: decorators/modified-star']);
  assert.equal(host.contributions.decorators.size, 0);
});

test('a manifest mismatch rejects the whole staged package', async () => {
  const terminal = new RecordingTerminal();
  const host = new PluginHost(builtinNames, terminal);
  const mismatched: PluginManifest = {
    name: '@svgframe/plugin-tree-star',
    contributes: { decorators: ['wrong-label'] },
  };
  await host.load(plugin, mismatched);

  assert.equal(terminal.errors.length, 1);
  assert.match(terminal.errors[0]!, /^error: plugin manifest mismatch: @svgframe\/plugin-tree-star/);
  assert.equal(host.contributions.decorators.size, 0);
});
