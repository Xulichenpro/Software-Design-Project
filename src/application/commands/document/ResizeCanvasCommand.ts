import { BarrierCommand } from '../base/BarrierCommand.js';
import type { DocumentReceiver } from '../../receivers/DocumentReceiver.js';
export class ResizeCanvasCommand extends BarrierCommand {
  constructor(private readonly receiver: DocumentReceiver, private readonly width: number, private readonly height: number) { super(); }
  execute() { return this.receiver.resizeCanvas(this.width, this.height); }
}

