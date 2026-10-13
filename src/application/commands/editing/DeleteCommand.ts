import { UndoableCommand } from '../base/UndoableCommand.js';
import type { ShapeEditorReceiver } from '../../receivers/ShapeEditorReceiver.js';
import type { StructureEditParameters } from '../../contracts/StructureEditParameters.js';
export class DeleteCommand extends UndoableCommand<StructureEditParameters> {
  constructor(private readonly receiver: ShapeEditorReceiver, private readonly id: string) { super(); }
  protected firstExecute() { return this.receiver.delete(this.id); }
  protected replay(parameters: StructureEditParameters) { return this.receiver.editStructure(parameters); }
}
