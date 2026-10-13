import { Command } from './Command.js';
import type { CommandResult } from '../../contracts/CommandResult.js';
import type { EditRecord } from '../../records/EditRecord.js';
import type { EditOutcome } from '../../receivers/EditOutcome.js';
import { EditorError } from '../../contracts/EditorError.js';
export abstract class UndoableCommand<TParameters = unknown> extends Command {
  #record: EditRecord<TParameters> | undefined;
  execute(): CommandResult {
    if (this.#record) return this.replay(this.#record.forward);
    const outcome = this.firstExecute();
    this.#record = outcome.record;
    return outcome.result;
  }
  undo(): CommandResult { return this.replay(this.requireRecord().inverse); }
  redo(): CommandResult { return this.replay(this.requireRecord().forward); }
  protected abstract firstExecute(): EditOutcome<EditRecord<TParameters>>;
  protected abstract replay(parameters: TParameters): CommandResult;
  private requireRecord(): EditRecord<TParameters> {
    if (!this.#record) throw new EditorError('command has not been executed');
    return this.#record;
  }
}

