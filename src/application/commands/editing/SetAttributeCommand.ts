import { UndoableCommand } from '../base/UndoableCommand.js';
import type { ShapeEditorReceiver } from '../../receivers/ShapeEditorReceiver.js';
import type { AttributeEditParameters, AttributeEditRequest } from '../../contracts/AttributeEditParameters.js';
export class SetAttributeCommand extends UndoableCommand<AttributeEditParameters> {
  readonly #request: AttributeEditRequest;
  constructor(private readonly receiver: ShapeEditorReceiver, request: AttributeEditRequest) {
    super(); this.#request = Object.freeze({ ...request });
  }
  protected firstExecute() { return this.receiver.setAttribute(this.#request); }
  protected replay(parameters: AttributeEditParameters) { return this.receiver.setAttribute(parameters); }
}
