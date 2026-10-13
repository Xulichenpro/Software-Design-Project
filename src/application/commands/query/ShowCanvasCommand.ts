import { QueryCommand } from '../base/QueryCommand.js';
import type { QueryReceiver } from '../../receivers/QueryReceiver.js';
export class ShowCanvasCommand extends QueryCommand {
  constructor(private readonly receiver: QueryReceiver) { super(); }
  execute() { return this.receiver.showCanvas(); }
}
