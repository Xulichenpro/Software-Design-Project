import { UndoableCommand } from '../base/UndoableCommand.js';
import type { ShapeEditorReceiver } from '../../receivers/ShapeEditorReceiver.js';
import type { StructureEditParameters } from '../../contracts/StructureEditParameters.js';
export class UngroupCommand extends UndoableCommand<StructureEditParameters> {
  constructor(private readonly receiver: ShapeEditorReceiver, private readonly id: string) { super(); }
  protected firstExecute() { return this.receiver.ungroup(this.id); }
  protected replay(parameters: StructureEditParameters) { return this.receiver.editStructure(parameters); }
}

