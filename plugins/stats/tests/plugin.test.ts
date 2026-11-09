import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import type {
  ArgumentToken, CommandRegistration, PluginContext, ShapeRegistration,
} from '../../../src/extension-api/index.js';
import plugin from '../src/index.js';
import { StatsCommand } from '../src/StatsCommand.js';
import { TestDocument } from './fixtures.js';

class RecordingContext implements PluginContext {
  readonly commands: CommandRegistration[] = [];
  registerCommand(registration: CommandRegistration): void { this.commands.push(registration); }
  registerShape(_registration: ShapeRegistration): void { throw new Error('stats registers no shapes'); }
  registerAttribute(): void { throw new Error('stats registers no attributes'); }
  registerDecorator(): void { throw new Error('stats registers no decorators'); }
}

const token = (value: string): ArgumentToken => ({ value, quoted: false });

test('the stats package activates exactly one command named stats', async () => {
  const context = new RecordingContext();
  await plugin.activate(context);
  assert.equal(context.commands.length, 1);
  const registration = context.commands[0]!;
  assert.equal(registration.name, 'stats');
  assert.match(registration.help, /\bstats\b/);
});

test('the stats manifest declares exactly the commands it registers', async () => {
  const context = new RecordingContext();
  await plugin.activate(context);
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    name?: string;
    contributes?: { commands?: readonly string[] };
  };
  assert.equal(manifest.name, '@svgframe/plugin-stats');
  assert.deepEqual(
    [...(manifest.contributes?.commands ?? [])].sort(),
    context.commands.map(registration => registration.name).sort(),
  );
});

test('stats rejects every argument with the fixed parameter error', async () => {
  const context = new RecordingContext();
  await plugin.activate(context);
  const registration = context.commands[0]!;
  const services = { document: new TestDocument() };
  for (const args of [[token('1')], [token('a'), token('b')]]) {
    assert.throws(() => registration.create(args, services), { message: 'invalid parameters for stats' });
  }
});

test('the stats registration instantiates StatsCommand for a no-argument line', async () => {
  const context = new RecordingContext();
  await plugin.activate(context);
  const registration = context.commands[0]!;
  const command = registration.create([], { document: new TestDocument() });
  assert.ok(command instanceof StatsCommand);
});
