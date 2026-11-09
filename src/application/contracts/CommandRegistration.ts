import type { Command } from '../commands/base/Command.js';
import type { ArgumentToken } from './ArgumentToken.js';
import type { CommandServices } from './CommandServices.js';

/**
 * A command dictionary entry: help plus parsing/instantiation rules.
 * `CliApplication` passes the result to `CommandExecutor`, which detects the
 * history-control category at runtime.
 */
export interface CommandRegistration {
  readonly name: string;
  readonly help: string;
  create(args: readonly ArgumentToken[], services: CommandServices): Command;
}
