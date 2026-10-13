import type { Terminal } from '../application/contracts/Terminal.js';
import type { CommandFactory } from '../application/factory/CommandFactory.js';
import type { CommandExecutor } from '../application/execution/CommandExecutor.js';
import type { CommandLineParser } from './CommandLineParser.js';
import type { CliResultRenderer } from './CliResultRenderer.js';

export class CliApplication {
  constructor(private readonly terminal: Terminal, private readonly parser: CommandLineParser,
    private readonly factory: CommandFactory, private readonly executor: CommandExecutor,
    private readonly renderer: CliResultRenderer) {}
  async run(): Promise<void> {
    try {
      this.terminal.writeLine("svg-editor 0.1 — type 'help' for commands");
      while (true) {
        const line = await this.terminal.readLine('svg> ');
        if (line === undefined) return;
        try {
          const input = this.parser.parse(line);
          if (input) this.renderer.render(await this.executor.execute(this.factory.create(input)));
        } catch (error) { this.renderer.renderError(error); }
      }
    } finally { this.terminal.close(); }
  }
}
