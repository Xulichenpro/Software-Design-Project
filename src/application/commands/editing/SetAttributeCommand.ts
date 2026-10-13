import { UndoableCommand } from '../base/UndoableCommand.js';
import type { ShapeEditorReceiver } from '../../receivers/ShapeEditorReceiver.js';
import type { AttributeEditParameters } from '../../contracts/AttributeEditParameters.js';
export class SetAttributeCommand extends UndoableCommand<AttributeEditParameters> {
  readonly #parameters: AttributeEditParameters;
  constructor(private readonly receiver: ShapeEditorReceiver, parameters: AttributeEditParameters) {
    super(); this.#parameters = Object.freeze({ ...parameters });
  }
  protected firstExecute() { return this.receiver.setAttribute(this.#parameters); }
  protected replay(parameters: AttributeEditParameters) { return this.receiver.setAttribute(parameters).result; }
}

