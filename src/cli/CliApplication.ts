import type { Terminal } from '../application/contracts/Terminal.js';
import type { CommandRegistry } from '../application/registries/CommandRegistry.js';
import type { Command } from '../application/commands/base/Command.js';
import type { CommandServices } from '../application/contracts/CommandServices.js';
import type { CommandExecutor } from '../application/execution/CommandExecutor.js';
import type { CommandLineParser } from './CommandLineParser.js';
import type { CliResultRenderer } from './CliResultRenderer.js';

export class CliApplication {
  constructor(
    private readonly terminal: Terminal,
    private readonly parser: CommandLineParser,
    private readonly commands: CommandRegistry,
    private readonly executor: CommandExecutor,
    private readonly renderer: CliResultRenderer,
    private readonly services: CommandServices,
  ) {}
  async run(): Promise<void> {
    try {
      this.terminal.writeLine("svg-editor 0.1 — type 'help' for commands");
      let pending: Promise<string | undefined> | undefined;
      while (true) {
        const line = pending ? await pending : await this.terminal.readLine('svg> ');
        if (line === undefined) return;
        pending = this.terminal.readLine('svg> ');
        try {
          const input = this.parser.parse(line);
          if (input) {
            const command: Command = this.commands.get(input.name).create(input.args, this.services);
            this.renderer.render(await this.executor.execute(command));
          }
        } catch (error) { this.renderer.renderError(error); }
      }
    } finally { this.terminal.close(); }
  }
}
