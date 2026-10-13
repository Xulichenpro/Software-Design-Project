import { UndoableCommand } from '../base/UndoableCommand.js';
import type { ShapeEditorReceiver } from '../../receivers/ShapeEditorReceiver.js';
import type { StructureEditParameters } from '../../contracts/StructureEditParameters.js';
export class CreateCommand extends UndoableCommand<StructureEditParameters> {
  readonly #args: readonly string[];
  constructor(private readonly receiver: ShapeEditorReceiver, private readonly type: string,
    private readonly id: string, args: readonly string[], private readonly parentId?: string) {
    super(); this.#args = Object.freeze([...args]);
  }
  protected firstExecute() { return this.receiver.create(this.type, this.id, this.#args, this.parentId); }
  protected replay(parameters: StructureEditParameters) { return this.receiver.editStructure(parameters); }
}
