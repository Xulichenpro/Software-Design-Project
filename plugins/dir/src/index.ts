import { EditorError } from '../../../src/extension-api/index.js';
import type {
  ArgumentToken, CommandServices, PluginContext, PluginManifest,
} from '../../../src/extension-api/index.js';
import { DirCommand } from './DirCommand.js';
import { NodeDirectoryAdapter } from './NodeDirectoryAdapter.js';

/** Must stay identical to `package.json` so the host manifest check passes. */
export const manifest = {
  name: '@svgframe/plugin-dir',
  contributes: { commands: ['dir'] },
} satisfies PluginManifest;

export async function activate(context: PluginContext): Promise<void> {
  context.registerCommand({
    name: 'dir',
    help: 'dir',
    create(args: readonly ArgumentToken[], _services: CommandServices) {
      if (args.length > 0) throw new EditorError('invalid parameters for dir');
      return new DirCommand(new NodeDirectoryAdapter());
    },
  });
}

export default { activate };
