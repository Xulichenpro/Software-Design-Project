import { BarrierCommand } from '../base/BarrierCommand.js';
import type { DocumentReceiver } from '../../receivers/DocumentReceiver.js';
export class SaveCommand extends BarrierCommand {
  constructor(private readonly receiver: DocumentReceiver, private readonly path?: string) { super(); }
  execute() { return this.receiver.save(this.path); }
}

