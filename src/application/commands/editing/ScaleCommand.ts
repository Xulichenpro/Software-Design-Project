import { UndoableCommand } from '../base/UndoableCommand.js';
import type { ShapeEditorReceiver } from '../../receivers/ShapeEditorReceiver.js';
import type { ScaleParameters } from '../../contracts/ScaleParameters.js';
export class ScaleCommand extends UndoableCommand<ScaleParameters> {
  readonly #parameters: ScaleParameters;
  constructor(private readonly receiver: ShapeEditorReceiver, parameters: ScaleParameters) {
    super(); this.#parameters = Object.freeze({ ...parameters });
  }
  protected firstExecute() { return this.receiver.scale(this.#parameters); }
  protected replay(parameters: ScaleParameters) { return this.receiver.scale(parameters).result; }
}
