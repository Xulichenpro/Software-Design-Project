import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Command } from '../../../src/application/commands/base/Command.js';
import { PluginCommand } from '../../../src/application/commands/base/PluginCommand.js';
import { QueryCommand } from '../../../src/application/commands/base/QueryCommand.js';
import { UndoableCommand } from '../../../src/application/commands/base/UndoableCommand.js';
import { BarrierCommand } from '../../../src/application/commands/base/BarrierCommand.js';
import { HistoryControlCommand } from '../../../src/application/commands/base/HistoryControlCommand.js';
import { UndoCommand } from '../../../src/application/commands/history/UndoCommand.js';
import { RedoCommand } from '../../../src/application/commands/history/RedoCommand.js';
import { CommandRegistry } from '../../../src/application/registries/CommandRegistry.js';
import type { CommandRegistration } from '../../../src/application/contracts/CommandRegistration.js';
import type { ArgumentToken } from '../../../src/application/contracts/ArgumentToken.js';
import type { CommandServices } from '../../../src/application/contracts/CommandServices.js';
import type { CommandResult } from '../../../src/application/contracts/CommandResult.js';

class ProbeCommand extends PluginCommand<void> {
  constructor(private readonly lines: readonly string[]) { super(); }
  execute(): CommandResult { return { lines: this.lines }; }
}

const token = (value: string, quoted = false): ArgumentToken => Object.freeze({ value, quoted });

function registration(name: string, calls?: { args?: readonly ArgumentToken[]; services?: CommandServices }): CommandRegistration {
  return Object.freeze({
    name,
    help: `${name} help`,
    create(args: readonly ArgumentToken[], services: CommandServices) {
      if (calls) { calls.args = args; calls.services = services; }
      return new ProbeCommand([`${name}:${args.map(arg => arg.value).join(',')}`]);
    },
  });
}

test('PluginCommand is the single direct Command subclass and the four categories extend it', () => {
  assert.equal(Object.getPrototypeOf(PluginCommand), Command);
  for (const category of [QueryCommand, UndoableCommand, BarrierCommand, HistoryControlCommand]) {
    assert.equal(Object.getPrototypeOf(category), PluginCommand);
  }
  assert.ok(new ProbeCommand([]) instanceof Command);
  assert.ok(new UndoCommand() instanceof HistoryControlCommand);
  assert.ok(new RedoCommand() instanceof HistoryControlCommand);
});

test('CommandRegistry stores CommandRegistration objects and exposes read-only lookups in order', () => {
  const registry = new CommandRegistry();
  const alpha = registration('alpha');
  const beta = registration('beta');
  registry.install(new Map<string, CommandRegistration>([['alpha', alpha]]), new Map([['beta', beta]]));
  assert.equal(registry.get('alpha'), alpha);
  assert.equal(registry.get('beta'), beta);
  assert.deepEqual(registry.values(), [alpha, beta]);
  assert.equal(typeof (registry as unknown as { set?: unknown }).set, 'undefined');
});

test('CommandRegistry rejects unknown commands with the contract error', () => {
  const registry = new CommandRegistry();
  registry.install(new Map<string, CommandRegistration>(), new Map());
  assert.throws(() => registry.get('missing'), { message: 'unknown command: missing' });
});

test('CommandRegistry installs exactly once', () => {
  const registry = new CommandRegistry();
  registry.install(new Map(), new Map());
  assert.throws(() => registry.install(new Map(), new Map()));
});

test('registry create receives frozen argument tokens and the shared CommandServices', async () => {
  const calls: { args?: readonly ArgumentToken[]; services?: CommandServices } = {};
  const registry = new CommandRegistry();
  registry.install(new Map([['probe', registration('probe', calls)]]), new Map());
  const services: CommandServices = { document: {} as CommandServices['document'] };
  const args = Object.freeze([token('one'), token('two words', true)]);
  const command = registry.get('probe').create(args, services);
  assert.equal(calls.args, args);
  assert.equal(calls.services, services);
  assert.deepEqual(await command.execute(), { lines: ['probe:one,two words'] });
});
