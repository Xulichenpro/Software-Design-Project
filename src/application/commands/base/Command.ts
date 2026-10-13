import type { CommandExecutionResult } from '../../contracts/CommandExecutionResult.js';
export abstract class Command<TInput = void> {
  abstract execute(input: TInput): CommandExecutionResult;
}
