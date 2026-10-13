import { HistoryControlCommand } from '../base/HistoryControlCommand.js';
import type { UndoableCommand } from '../base/UndoableCommand.js';
export class RedoCommand extends HistoryControlCommand {
  getDirection(): 'redo' { return 'redo'; }
  execute(target: UndoableCommand) { return target.redo(); }
}

