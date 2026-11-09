import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import type {
  AttributeHandler, CommandRegistration, PluginContext, PluginManifest, ShapeRegistration, TreeDecorator,
} from '../../../src/extension-api/index.js';
import type { Terminal } from '../../../src/application/contracts/Terminal.js';
import { PluginHost } from '../../../src/bootstrap/PluginHost.js';
import plugin, { manifest } from '../../../plugins/box/src/index.js';
import { BoxShape } from '../../../plugins/box/src/BoxShape.js';
import { BoxAttributeHandler } from '../../../plugins/box/src/BoxAttributeHandler.js';
import { BoxTypeDecorator } from '../../../plugins/box/src/BoxTypeDecorator.js';

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

test('the box package activates exactly one shape, one attribute handler and one decorator, with no command', async () => {
  const context = new RecordingContext();
  await plugin.activate(context);

  assert.equal(context.shapes.length, 1);
  assert.equal(context.shapes[0], BoxShape);
  assert.equal(context.shapes[0]!.type, 'box');
  assert.equal(context.shapes[0]!.prototype, BoxShape.prototype);

  assert.equal(context.attributes.length, 1);
  assert.equal(context.attributes[0]!.name, 'box-attributes');
  assert.ok(context.attributes[0] instanceof BoxAttributeHandler);

  assert.equal(context.decorators.length, 1);
  assert.equal(context.decorators[0]!.name, 'box-type-label');
  assert.ok(context.decorators[0] instanceof BoxTypeDecorator);

  assert.deepEqual(context.commands, []);
});

test('package.json declares exactly the shape, attribute and decorator names the plugin registers', async () => {
  const context = new RecordingContext();
  await plugin.activate(context);
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    name?: string;
    contributes?: {
      shapes?: readonly string[];
      commands?: readonly string[];
      attributes?: readonly string[];
      decorators?: readonly string[];
    };
  };

  assert.equal(pkg.name, '@svgframe/plugin-shape-box');
  assert.deepEqual([...(pkg.contributes?.shapes ?? [])].sort(), context.shapes.map(registration => registration.type).sort());
  assert.deepEqual([...(pkg.contributes?.attributes ?? [])].sort(), context.attributes.map(handler => handler.name).sort());
  assert.deepEqual([...(pkg.contributes?.decorators ?? [])].sort(), context.decorators.map(decorator => decorator.name).sort());
  assert.deepEqual(pkg.contributes?.commands ?? [], context.commands.map(registration => registration.name));

  assert.equal(manifest.name, pkg.name);
  assert.deepEqual(manifest.contributes?.shapes, pkg.contributes?.shapes);
  assert.deepEqual(manifest.contributes?.attributes, pkg.contributes?.attributes);
  assert.deepEqual(manifest.contributes?.decorators, pkg.contributes?.decorators);
});

test('PluginHost accepts the whole box package when every name is free', async () => {
  const terminal = new RecordingTerminal();
  const host = new PluginHost(builtinNames, terminal);
  await host.load(plugin, manifest);

  assert.deepEqual(terminal.output, []);
  assert.equal(host.contributions.shapes.get('box'), BoxShape);
  assert.equal(host.contributions.attributes.get('box-attributes')?.name, 'box-attributes');
  assert.equal(host.contributions.decorators.get('box-type-label')?.name, 'box-type-label');
  assert.equal(host.contributions.commands.size, 0);
});

test('a manifest mismatch rejects the whole staged package', async () => {
  const terminal = new RecordingTerminal();
  const host = new PluginHost(builtinNames, terminal);
  const mismatched: PluginManifest = {
    name: '@svgframe/plugin-shape-box',
    contributes: { shapes: ['box'], attributes: ['box-attributes'], decorators: ['wrong-label'] },
  };
  await host.load(plugin, mismatched);

  assert.equal(terminal.errors.length, 1);
  assert.match(terminal.errors[0]!, /^error: plugin manifest mismatch: @svgframe\/plugin-shape-box/);
  assert.equal(host.contributions.shapes.size, 0);
  assert.equal(host.contributions.attributes.size, 0);
  assert.equal(host.contributions.decorators.size, 0);
  assert.equal(host.contributions.commands.size, 0);
});

test('a duplicate name rejects the whole staged package and keeps earlier contributions intact', async () => {
  const terminal = new RecordingTerminal();
  const host = new PluginHost({ ...builtinNames, shapes: [...builtinNames.shapes, 'box'] }, terminal);
  await host.load(plugin, manifest);

  assert.deepEqual(terminal.output, ['error: duplicate registration: shapes/box']);
  assert.equal(host.contributions.shapes.size, 0);
  assert.equal(host.contributions.attributes.size, 0);
  assert.equal(host.contributions.decorators.size, 0);
});
