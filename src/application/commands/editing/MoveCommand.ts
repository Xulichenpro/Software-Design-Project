import { UndoableCommand } from '../base/UndoableCommand.js';
import type { ShapeEditorReceiver } from '../../receivers/ShapeEditorReceiver.js';
import type { MoveParameters } from '../../contracts/MoveParameters.js';
export class MoveCommand extends UndoableCommand<MoveParameters> {
  readonly #parameters: MoveParameters;
  constructor(private readonly receiver: ShapeEditorReceiver, parameters: MoveParameters) {
    super(); this.#parameters = Object.freeze({ ...parameters });
  }
  protected firstExecute() { return this.receiver.move(this.#parameters); }
  protected replay(parameters: MoveParameters) { return this.receiver.move(parameters).result; }
}

