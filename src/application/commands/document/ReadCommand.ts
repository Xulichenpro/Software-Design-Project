import { BarrierCommand } from '../base/BarrierCommand.js';
import type { DocumentReceiver } from '../../receivers/DocumentReceiver.js';
export class ReadCommand extends BarrierCommand {
  constructor(private readonly receiver: DocumentReceiver, private readonly path: string) { super(); }
  execute() { return this.receiver.read(this.path); }
}
