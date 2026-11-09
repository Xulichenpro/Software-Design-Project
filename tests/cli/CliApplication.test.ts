import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CliApplication } from '../../src/cli/CliApplication.js';
import { CommandLineParser } from '../../src/cli/CommandLineParser.js';
import { CliResultRenderer } from '../../src/cli/CliResultRenderer.js';
import { CommandExecutor } from '../../src/application/execution/CommandExecutor.js';
import { CommandRegistry } from '../../src/application/registries/CommandRegistry.js';
import { QueryCommand } from '../../src/application/commands/base/QueryCommand.js';
import { ShapeTree } from '../../src/domain/tree/ShapeTree.js';
import type { CommandRegistration } from '../../src/application/contracts/CommandRegistration.js';
import type { CommandServices } from '../../src/application/contracts/CommandServices.js';
import type { ArgumentToken } from '../../src/application/contracts/ArgumentToken.js';
import type { CommandResult } from '../../src/application/contracts/CommandResult.js';
import { ScriptTerminal } from '../helpers/terminal.js';

class LinesCommand extends QueryCommand {
  constructor(private readonly lines: readonly string[]) { super(); }
  execute(): CommandResult { return { lines: this.lines }; }
}

class FailingCommand extends QueryCommand {
  execute(): CommandResult { throw new Error('command exploded'); }
}

function commandRegistration(name: string, create: CommandRegistration['create']): CommandRegistration {
  return { name, help: `${name} help`, create };
}

function setup(lines: readonly string[], registrations: readonly CommandRegistration[]) {
  const tree = new ShapeTree();
  tree.initialize(10, 20);
  const terminal = new ScriptTerminal(lines);
  const commands = new CommandRegistry();
  commands.install(new Map(registrations.map(registration => [registration.name, registration])), new Map());
  const services: CommandServices = { document: tree };
  const app = new CliApplication(
    terminal,
    new CommandLineParser(),
    commands,
    new CommandExecutor(),
    new CliResultRenderer(terminal),
    services,
  );
  return { app, terminal, tree, commands, services };
}

test('application displays the banner, prompts, skips blank/comment lines and exits cleanly at EOF', async () => {
  const calls: ArgumentToken[][] = [];
  const f = setup(['', '# comment', '  ', 'help'], [
    commandRegistration('help', args => { calls.push([...args]); return new LinesCommand(['help-text']); }),
  ]);
  await f.app.run();
  assert.equal(f.terminal.output[0], "svg-editor 0.1 — type 'help' for commands");
  assert.ok(f.terminal.output.includes('help-text'));
  assert.equal(f.terminal.prompts.length, 5);
  assert.ok(f.terminal.prompts.every(prompt => prompt === 'svg> '));
  assert.equal(f.terminal.closed, true);
  assert.equal(calls.length, 1);
});

test('CLI looks commands up in the registry and passes parsed tokens and CommandServices to create', async () => {
  let receivedArgs: readonly ArgumentToken[] | undefined;
  let receivedServices: CommandServices | undefined;
  let calls = 0;
  const f = setup(['probe "two words" 3'], [
    commandRegistration('probe', (args, services) => {
      calls += 1;
      receivedArgs = args;
      receivedServices = services;
      return new LinesCommand([`probe:${args.map(arg => `${arg.value}/${arg.quoted}`).join(',')}`]);
    }),
  ]);
  await f.app.run();
  assert.equal(calls, 1);
  assert.deepEqual(receivedArgs?.map(arg => [arg.value, arg.quoted]), [['two words', true], ['3', false]]);
  assert.equal(receivedServices?.document, f.tree);
  assert.deepEqual(f.terminal.output, [
    "svg-editor 0.1 — type 'help' for commands",
    'probe:two words/true,3/false',
  ]);
});

test('the registry is queried for every command line, creating a fresh command each time', async () => {
  let calls = 0;
  const f = setup(['ping', 'ping'], [
    commandRegistration('ping', () => new LinesCommand([`pong:${++calls}`])),
  ]);
  await f.app.run();
  assert.equal(calls, 2);
  assert.deepEqual(f.terminal.output.slice(1), ['pong:1', 'pong:2']);
});

test('unknown commands surface the registry error once and the next command still runs', async () => {
  const f = setup(['missing', 'help'], [
    commandRegistration('help', () => new LinesCommand(['help-text'])),
  ]);
  await f.app.run();
  assert.deepEqual(f.terminal.output.filter(line => line.startsWith('error:')), ['error: unknown command: missing']);
  assert.ok(f.terminal.output.includes('help-text'));
});

test('parser, command and receiver failures are rendered once and do not stop the loop', async () => {
  const f = setup(['create text bad 1 2 "unfinished', 'boom', 'help'], [
    commandRegistration('boom', () => new FailingCommand()),
    commandRegistration('help', () => new LinesCommand(['help-text'])),
  ]);
  await f.app.run();
  const errors = f.terminal.output.filter(line => line.startsWith('error:'));
  assert.equal(errors.length, 2);
  assert.ok(errors[0]!.includes('unterminated quoted argument'));
  assert.equal(errors[1], 'error: command exploded');
  assert.ok(f.terminal.output.includes('help-text'));
  assert.ok(errors.every(line => !/[\r\n]/.test(line)));
});

test('application awaits each command before reading the next input line', async () => {
  let finish: (() => void) | undefined;
  let started: (() => void) | undefined;
  const startedPromise = new Promise<void>(resolve => { started = resolve; });
  class WaitingCommand extends QueryCommand {
    execute(): Promise<CommandResult> {
      started!();
      return new Promise<CommandResult>(resolve => { finish = () => resolve({ lines: ['waited'] }); });
    }
  }
  const f = setup(['slow', 'ping'], [
    commandRegistration('slow', () => new WaitingCommand()),
    commandRegistration('ping', () => new LinesCommand(['pong'])),
  ]);
  const running = f.app.run();
  await startedPromise;
  assert.equal(f.terminal.prompts.length, 2);
  assert.ok(!f.terminal.output.includes('pong'));
  assert.ok(finish);
  finish();
  await running;
  assert.ok(f.terminal.output.indexOf('waited') < f.terminal.output.indexOf('pong'));
  assert.equal(f.terminal.closed, true);
});

test('IO errors with line breaks are flattened to one rendered error line', async () => {
  class LineBreakCommand extends QueryCommand {
    execute(): CommandResult { throw new Error('bad\r\nsource'); }
  }
  const f = setup(['boom'], [
    commandRegistration('boom', () => new LineBreakCommand()),
  ]);
  await f.app.run();
  assert.deepEqual(f.terminal.output.filter(line => line.startsWith('error:')), ['error: bad source']);
});
