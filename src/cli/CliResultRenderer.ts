import type { Terminal } from '../application/contracts/Terminal.js';
import type { CommandResult } from '../application/contracts/CommandResult.js';

export class CliResultRenderer {
  constructor(private readonly terminal: Terminal) {}
  render(result: CommandResult): void {
    for (const warning of result.warnings ?? []) {
      this.terminal.writeLine('warning: ' + this.singleLine(warning).replace(/^(?:warning:\s*)+/, ''));
    }
    for (const line of result.lines) this.terminal.writeLine(line);
  }
  renderError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.terminal.writeLine('error: ' + this.singleLine(message).replace(/^(?:error:\s*)+/, ''));
  }
  private singleLine(text: string): string { return text.replace(/[\r\n]+/g, ' '); }
}
