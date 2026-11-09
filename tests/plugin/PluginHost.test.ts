import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PluginHost } from '../../src/bootstrap/PluginHost.js';
import type { PluginManifest, PluginModule } from '../../src/bootstrap/PluginHost.js';
import { AttributeHandler } from '../../src/application/attributes/AttributeHandler.js';
import { TreeDecorator } from '../../src/application/tree/TreeDecorator.js';
import { RectShape } from '../../src/domain/shapes/RectShape.js';
import type { AttributeOutcome } from '../../src/application/attributes/AttributeOutcome.js';
import type { AttributeEditRequest } from '../../src/application/contracts/AttributeEditParameters.js';
import type { AttributeTransaction } from '../../src/application/attributes/AttributeTransaction.js';
import type { ReadonlyShape } from '../../src/application/attributes/ReadonlyShape.js';
import type { TreeRow } from '../../src/application/tree/TreeRow.js';
import type { DocumentView } from '../../src/application/contracts/DocumentView.js';
import { RecordingTerminal } from '../helpers/terminal.js';
import {
  commandRegistration, recordingOptionsModule, registeringModule, throwingModule,
} from './fixtures/host-plugins.js';

class HostHandler extends AttributeHandler {
  readonly name = 'host-handler';
  handles(_target: ReadonlyShape, _attr: string): boolean { return false; }
  apply(_target: ReadonlyShape, _request: AttributeEditRequest, _transaction: AttributeTransaction): AttributeOutcome {
    return { forwardLines: [], inverseLines: [] };
  }
}

class HostDecorator extends TreeDecorator {
  readonly name = 'host-decorator';
  decorate(_row: TreeRow, _document: DocumentView): string | undefined { return undefined; }
}

interface BuiltinNames {
  readonly shapes: readonly string[];
  readonly commands: readonly string[];
  readonly attributes: readonly string[];
  readonly decorators: readonly string[];
}

const NO_BUILTINS: BuiltinNames = { shapes: [], commands: [], attributes: [], decorators: [] };
const manifest = (name: string, contributes?: PluginManifest['contributes']): PluginManifest => ({ name, contributes });

function host(builtins: BuiltinNames = NO_BUILTINS) {
  const terminal = new RecordingTerminal();
  return { host: new PluginHost(builtins, terminal), terminal };
}

test('PluginHost stages and accepts all four contribution categories from one plugin', async () => {
  const command = commandRegistration('probe');
  const handler = new HostHandler();
  const decorator = new HostDecorator();
  const module = registeringModule({ commands: ['probe'], shapes: [RectShape], attributes: [handler], decorators: [decorator] });
  const { host: pluginHost, terminal } = host();
  await pluginHost.load(module, manifest('@test/all', {
    commands: ['probe'], shapes: ['rect'], attributes: [handler.name], decorators: [decorator.name],
  }));
  assert.deepEqual(terminal.errors, []);
  assert.equal(pluginHost.contributions.commands.get('probe')?.name, 'probe');
  assert.equal(pluginHost.contributions.shapes.get('rect'), RectShape);
  assert.equal(pluginHost.contributions.attributes.get(handler.name), handler);
  assert.equal(pluginHost.contributions.decorators.get(decorator.name), decorator);
});

test('missing contributes declarations default to empty sets', async () => {
  const { host: pluginHost, terminal } = host();
  await pluginHost.load(registeringModule({}), manifest('@test/empty'));
  assert.deepEqual(terminal.errors, []);
  assert.equal(pluginHost.contributions.commands.size, 0);
  assert.equal(pluginHost.contributions.shapes.size, 0);
  assert.equal(pluginHost.contributions.attributes.size, 0);
  assert.equal(pluginHost.contributions.decorators.size, 0);
});

test('manifest mismatch is reported and the whole plugin is discarded', async () => {
  const { host: pluginHost, terminal } = host();
  await pluginHost.load(registeringModule({ commands: ['pong'] }), manifest('@test/mismatch', { commands: ['ping'] }));
  assert.equal(terminal.errors.length, 1);
  assert.match(terminal.errors[0]!, /^error: plugin manifest mismatch: @test\/mismatch/);
  assert.match(terminal.errors[0]!, /declared/);
  assert.match(terminal.errors[0]!, /registered/);
  assert.equal(pluginHost.contributions.commands.size, 0);
});

test('malformed manifest name lists discard every staged category and allow later plugins', async () => {
  for (const invalid of [{}, 'probe', null, [42], ['']]) {
    for (const category of ['shapes', 'commands', 'attributes', 'decorators'] as const) {
      const { host: pluginHost, terminal } = host();
      const handler = new HostHandler();
      const decorator = new HostDecorator();
      const contributes = {
        shapes: ['rect'], commands: ['probe'], attributes: [handler.name], decorators: [decorator.name],
        [category]: invalid,
      } as unknown as PluginManifest['contributes'];
      await pluginHost.load(registeringModule({
        shapes: category === 'shapes' && invalid === null ? [] : [RectShape],
        commands: category === 'commands' && invalid === null ? [] : ['probe'],
        attributes: category === 'attributes' && invalid === null ? [] : [handler],
        decorators: category === 'decorators' && invalid === null ? [] : [decorator],
      }), manifest('@test/malformed', contributes));
      assert.equal(terminal.errors.length, 1, category);
      assert.match(terminal.errors[0]!, /^error: plugin manifest mismatch: @test\/malformed \(declared: .*, registered: .*\)$/);
      for (const accepted of Object.values(pluginHost.contributions)) assert.equal(accepted.size, 0, category);
      await pluginHost.load(registeringModule({ commands: ['probe'] }), manifest('@test/later', { commands: ['probe'] }));
      assert.equal(pluginHost.contributions.commands.has('probe'), true, category);
    }
  }
});

test('an iterable string is not accepted as a declaration of its individual characters', async () => {
  const { host: pluginHost, terminal } = host();
  await pluginHost.load(registeringModule({ commands: ['p', 'i', 'n', 'g'] }),
    manifest('@test/string', { commands: 'ping' } as unknown as PluginManifest['contributes']));
  assert.equal(terminal.errors.length, 1);
  assert.match(terminal.errors[0]!, /^error: plugin manifest mismatch: @test\/string/);
  assert.equal(pluginHost.contributions.commands.size, 0);
});

test('invalid declaration names cannot be accepted by matching invalid registration names', async () => {
  for (const name of [42, '']) {
    const { host: pluginHost, terminal } = host();
    await pluginHost.load(registeringModule({ commands: [name as string] }),
      manifest('@test/name', { commands: [name] } as unknown as PluginManifest['contributes']));
    assert.equal(terminal.errors.length, 1);
    assert.match(terminal.errors[0]!, /^error: plugin manifest mismatch: @test\/name/);
    assert.equal(pluginHost.contributions.commands.size, 0);
  }
});

test('a malformed contributes container is rejected even when activation registers nothing', async () => {
  for (const invalid of [null, [], 'commands', 42]) {
    const { host: pluginHost, terminal } = host();
    await pluginHost.load(registeringModule({}), manifest('@test/malformed', invalid as unknown as PluginManifest['contributes']));
    assert.equal(terminal.errors.length, 1);
    assert.match(terminal.errors[0]!, /^error: plugin manifest mismatch: @test\/malformed \(declared: .*, registered: .*\)$/);
  }
});

test('a plugin that registers an undeclared category also fails manifest comparison', async () => {
  const { host: pluginHost, terminal } = host();
  await pluginHost.load(registeringModule({ commands: ['ping'] }), manifest('@test/undeclared', {}));
  assert.equal(terminal.errors.length, 1);
  assert.match(terminal.errors[0]!, /^error: plugin manifest mismatch: @test\/undeclared/);
  assert.equal(pluginHost.contributions.commands.size, 0);
});

test('duplicate names against builtins use the category/name contract error', async () => {
  const commands = host({ ...NO_BUILTINS, commands: ['create'] });
  await commands.host.load(registeringModule({ commands: ['create'] }), manifest('@test/duplicate-builtin', { commands: ['create'] }));
  assert.deepEqual(commands.terminal.errors, ['error: duplicate registration: commands/create']);
  assert.equal(commands.host.contributions.commands.size, 0);

  const shapes = host({ ...NO_BUILTINS, shapes: ['rect'] });
  await shapes.host.load(registeringModule({ shapes: [RectShape] }), manifest('@test/duplicate-shape', { shapes: ['rect'] }));
  assert.deepEqual(shapes.terminal.errors, ['error: duplicate registration: shapes/rect']);
  assert.equal(shapes.host.contributions.shapes.size, 0);
});

test('duplicates against an accepted plugin reject only the later plugin', async () => {
  const first = commandRegistration('shared');
  const { host: pluginHost, terminal } = host();
  await pluginHost.load({ activate(context) { context.registerCommand(first); } }, manifest('@test/first', { commands: ['shared'] }));
  await pluginHost.load(registeringModule({ commands: ['shared'] }), manifest('@test/second', { commands: ['shared'] }));
  assert.deepEqual(terminal.errors, ['error: duplicate registration: commands/shared']);
  assert.equal(pluginHost.contributions.commands.get('shared'), first);
});

test('a duplicate inside a multi-contribution plugin rolls back every staged category', async () => {
  const { host: pluginHost, terminal } = host({ ...NO_BUILTINS, commands: ['create'] });
  await pluginHost.load(registeringModule({
    commands: ['ok', 'create'], shapes: [RectShape],
  }), manifest('@test/rollback', { commands: ['ok', 'create'], shapes: ['rect'] }));
  assert.deepEqual(terminal.errors, ['error: duplicate registration: commands/create']);
  assert.equal(pluginHost.contributions.commands.size, 0);
  assert.equal(pluginHost.contributions.shapes.size, 0);
});

test('a thrown activation is reported with plugin name and reason; accepted plugins stay installed', async () => {
  const good = commandRegistration('good');
  const { host: pluginHost, terminal } = host();
  await pluginHost.load({ activate(context) { context.registerCommand(good); } }, manifest('@test/good', { commands: ['good'] }));
  await pluginHost.load(throwingModule('kaboom'), manifest('@test/boom', { commands: ['gone'] }));
  assert.equal(terminal.errors.length, 1);
  assert.match(terminal.errors[0]!, /^error: plugin failed to activate: @test\/boom \(kaboom\)/);
  assert.equal(pluginHost.contributions.commands.get('good'), good);
  assert.equal(pluginHost.contributions.commands.has('gone'), false);
});

test('activate receives the options object frozen and unchanged', async () => {
  const record: { options?: Readonly<Record<string, unknown>> } = {};
  const { host: pluginHost, terminal } = host();
  await pluginHost.load(recordingOptionsModule(record), manifest('@test/options'), { fill: '#f5a623', nested: { keep: true } });
  assert.deepEqual(terminal.errors, []);
  assert.deepEqual(record.options, { fill: '#f5a623', nested: { keep: true } });
  assert.equal(Object.isFrozen(record.options), true);
});

test('PluginHost keeps accepted contributions in load order', async () => {
  const { host: pluginHost } = host();
  const first = commandRegistration('first');
  const second = commandRegistration('second');
  await pluginHost.load({ activate(context) { context.registerCommand(first); } }, manifest('@test/first', { commands: ['first'] }));
  await pluginHost.load({ activate(context) { context.registerCommand(second); } }, manifest('@test/second', { commands: ['second'] }));
  assert.deepEqual([...pluginHost.contributions.commands.keys()], ['first', 'second']);
});

test('a failed activation is not accepted even when it registered nothing partial', async () => {
  const module: PluginModule = { activate(context) { context.registerCommand(commandRegistration('partial')); throw new Error('after writes'); } };
  const { host: pluginHost, terminal } = host();
  await pluginHost.load(module, manifest('@test/partial', { commands: ['partial'] }));
  assert.match(terminal.errors[0]!, /^error: plugin failed to activate: @test\/partial \(after writes\)/);
  assert.equal(pluginHost.contributions.commands.size, 0);
});
