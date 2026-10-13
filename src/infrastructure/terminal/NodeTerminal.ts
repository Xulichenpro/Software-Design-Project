import { createInterface } from 'node:readline';
import type { Interface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { Terminal } from '../../application/contracts/Terminal.js';

export class NodeTerminal implements Terminal {
  readonly #reader: Interface;
  readonly #lines: string[] = [];
  #finished = false;
  #failure: Error | undefined;
  #pending: { resolve: (line: string | undefined) => void; reject: (error: Error) => void } | undefined;

  constructor(input: Readable = process.stdin, private readonly output: Writable = process.stdout) {
    this.#reader = createInterface({ input, crlfDelay: Infinity, terminal: false });
    this.#reader.on('line', line => {
      if (this.#pending) { const pending = this.#pending; this.#pending = undefined; pending.resolve(line); }
      else this.#lines.push(line);
    });
    this.#reader.on('close', () => {
      this.#finished = true;
      this.#pending?.resolve(undefined); this.#pending = undefined;
    });
    this.#reader.on('error', (error: Error) => {
      this.#failure = error; this.#finished = true;
      this.#pending?.reject(error); this.#pending = undefined; this.#reader.close();
    });
  }
  async readLine(prompt: string): Promise<string | undefined> {
    this.output.write(prompt);
    if (this.#failure) throw this.#failure;
    if (this.#lines.length) return this.#lines.shift()!;
    if (this.#finished) return undefined;
    if (this.#pending) throw new Error('a terminal read is already pending');
    return new Promise((resolve, reject) => { this.#pending = { resolve, reject }; });
  }
  writeLine(text: string): void { this.output.write(text + '\n'); }
  close(): void {
    this.#finished = true; this.#lines.length = 0;
    this.#pending?.resolve(undefined); this.#pending = undefined; this.#reader.close();
  }
}
