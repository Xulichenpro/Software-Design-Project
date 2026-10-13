import { BarrierCommand } from '../base/BarrierCommand.js';
import type { DocumentReceiver } from '../../receivers/DocumentReceiver.js';
export class InitCommand extends BarrierCommand {
  constructor(private readonly receiver: DocumentReceiver, private readonly width = 800, private readonly height = 600) { super(); }
  execute() { return this.receiver.initialize(this.width, this.height); }
}

