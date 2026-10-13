import { HistoryControlCommand } from '../base/HistoryControlCommand.js';
import type { UndoableCommand } from '../base/UndoableCommand.js';
export class UndoCommand extends HistoryControlCommand {
  getDirection(): 'undo' { return 'undo'; }
  execute(target: UndoableCommand) { return target.undo(); }
}

