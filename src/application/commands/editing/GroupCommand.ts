import { UndoableCommand } from '../base/UndoableCommand.js';
import type { ShapeEditorReceiver } from '../../receivers/ShapeEditorReceiver.js';
import type { StructureEditParameters } from '../../contracts/StructureEditParameters.js';
export class GroupCommand extends UndoableCommand<StructureEditParameters> {
  readonly #ids: readonly string[];
  constructor(private readonly receiver: ShapeEditorReceiver, private readonly id: string, ids: readonly string[]) {
    super(); this.#ids = Object.freeze([...ids]);
  }
  protected firstExecute() { return this.receiver.group(this.id, this.#ids); }
  protected replay(parameters: StructureEditParameters) { return this.receiver.editStructure(parameters); }
}
