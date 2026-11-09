import type { Terminal } from '../../src/application/contracts/Terminal.js';

export class ScriptTerminal implements Terminal {
  readonly output: string[] = [];
  readonly prompts: string[] = [];
  closed = false;
  constructor(private readonly lines: readonly string[]) {}
  async readLine(prompt: string): Promise<string | undefined> {
    this.prompts.push(prompt);
    return this.lines[this.prompts.length - 1];
  }
  writeLine(text: string): void { this.output.push(text); }
  close(): void { this.closed = true; }
}

export class RecordingTerminal implements Terminal {
  readonly output: string[] = [];
  async readLine(): Promise<string | undefined> { return undefined; }
  writeLine(text: string): void { this.output.push(text); }
  close(): void {}
  get errors(): readonly string[] { return this.output.filter(line => line.startsWith('error:')); }
}
