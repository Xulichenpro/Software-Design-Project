import { EditorError } from '../../../src/extension-api/index.js';
import type {
  ArgumentToken, CommandServices, PluginContext, PluginManifest,
} from '../../../src/extension-api/index.js';
import { StatsCommand } from './StatsCommand.js';

/** Must stay identical to `package.json` so the host manifest check passes. */
export const manifest = {
  name: '@svgframe/plugin-stats',
  contributes: { commands: ['stats'] },
} satisfies PluginManifest;

export async function activate(context: PluginContext): Promise<void> {
  context.registerCommand({
    name: 'stats',
    help: 'stats',
    create(args: readonly ArgumentToken[], services: CommandServices) {
      if (args.length > 0) throw new EditorError('invalid parameters for stats');
      return new StatsCommand(services.document);
    },
  });
}

export default { activate };
