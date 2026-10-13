import { Command } from './Command.js';
import type { UndoableCommand } from './UndoableCommand.js';
export abstract class HistoryControlCommand extends Command<UndoableCommand> {
  abstract getDirection(): 'undo' | 'redo';
}

