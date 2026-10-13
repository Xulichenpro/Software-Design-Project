import { QueryCommand } from '../base/QueryCommand.js';
import type { QueryReceiver } from '../../receivers/QueryReceiver.js';
export class HelpCommand extends QueryCommand {
  constructor(private readonly receiver: QueryReceiver) { super(); }
  execute() { return this.receiver.help(); }
}

