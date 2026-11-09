import { PluginCommand } from './PluginCommand.js';
import type { UndoableCommand } from './UndoableCommand.js';

export abstract class HistoryControlCommand extends PluginCommand<UndoableCommand> {
  abstract getDirection(): 'undo' | 'redo';
}
