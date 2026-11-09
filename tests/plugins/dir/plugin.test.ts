import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { QueryCommand } from '../../../src/extension-api/index.js';
import type {
  ArgumentToken, CommandRegistration, PluginContext, ShapeRegistration,
} from '../../../src/extension-api/index.js';
import plugin from '../../../plugins/dir/src/index.js';
import { DirCommand } from '../../../plugins/dir/src/DirCommand.js';
import { ExistingDocument } from './fixtures.js';

class RecordingContext implements PluginContext {
  readonly commands: CommandRegistration[] = [];
  registerCommand(registration: CommandRegistration): void { this.commands.push(registration); }
  registerShape(_registration: ShapeRegistration): void { throw new Error('dir registers no shapes'); }
  registerAttribute(): void { throw new Error('dir registers no attributes'); }
  registerDecorator(): void { throw new Error('dir registers no decorators'); }
}

const token = (value: string): ArgumentToken => ({ value, quoted: false });
const services = { document: new ExistingDocument() };

test('the dir package activates exactly one command named dir', async () => {
  const context = new RecordingContext();
  await plugin.activate(context);
  assert.equal(context.commands.length, 1);
  const registration = context.commands[0]!;
  assert.equal(registration.name, 'dir');
  assert.match(registration.help, /\bdir\b/);
});

test('the dir manifest declares exactly the commands it registers', async () => {
  const context = new RecordingContext();
  await plugin.activate(context);
  const manifest = JSON.parse(await readFile(new URL('../../../plugins/dir/package.json', import.meta.url), 'utf8')) as {
    name?: string;
    contributes?: { commands?: readonly string[] };
  };
  assert.equal(manifest.name, '@svgframe/plugin-dir');
  assert.deepEqual(
    [...(manifest.contributes?.commands ?? [])].sort(),
    context.commands.map(registration => registration.name).sort(),
  );
});

test('dir creates a DirCommand for no arguments and rejects all arguments', async () => {
  const context = new RecordingContext();
  await plugin.activate(context);
  const registration = context.commands[0]!;
  const command = registration.create([], services);
  assert.ok(command instanceof DirCommand);
  assert.ok(command instanceof QueryCommand);
  for (const args of [[token('x')], [token('a'), token('b')]]) {
    assert.throws(() => registration.create(args, services), { message: 'invalid parameters for dir' });
  }
});
