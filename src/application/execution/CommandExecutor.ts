import type { Command } from '../commands/base/Command.js';
import { UndoableCommand } from '../commands/base/UndoableCommand.js';
import { BarrierCommand } from '../commands/base/BarrierCommand.js';
import { QueryCommand } from '../commands/base/QueryCommand.js';
import { HistoryControlCommand } from '../commands/base/HistoryControlCommand.js';
import type { CommandResult } from '../contracts/CommandResult.js';
import { EditorError } from '../contracts/EditorError.js';

export class CommandExecutor {
  readonly #undoStack: UndoableCommand[] = [];
  readonly #redoStack: UndoableCommand[] = [];
  #historyBlocked = false;

  async execute(command: Command | HistoryControlCommand): Promise<CommandResult> {
    if (command instanceof HistoryControlCommand) {
      const direction = command.getDirection();
      if (this.#historyBlocked) throw new EditorError(`${direction} not allowed after io command`);
      const source = direction === 'undo' ? this.#undoStack : this.#redoStack;
      const destination = direction === 'undo' ? this.#redoStack : this.#undoStack;
      const target = source.at(-1);
      if (!target) throw new EditorError(`nothing to ${direction}`);
      const result = await command.execute(target);
      source.pop(); destination.push(target);
      return result;
    }
    if (!(command instanceof UndoableCommand || command instanceof BarrierCommand || command instanceof QueryCommand)) {
      throw new EditorError('unsupported command category');
    }
    const result = await command.execute();
    if (command instanceof UndoableCommand) {
      this.#undoStack.push(command);
      this.#redoStack.length = 0;
      this.#historyBlocked = false;
    } else if (command instanceof BarrierCommand) {
      this.#undoStack.length = 0;
      this.#redoStack.length = 0;
      this.#historyBlocked = true;
    }
    return result;
  }
}
