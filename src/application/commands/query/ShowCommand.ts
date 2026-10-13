import { QueryCommand } from '../base/QueryCommand.js';
import type { QueryReceiver } from '../../receivers/QueryReceiver.js';
export class ShowCommand extends QueryCommand {
  constructor(private readonly receiver: QueryReceiver, private readonly id: string) { super(); }
  execute() { return this.receiver.show(this.id); }
}
