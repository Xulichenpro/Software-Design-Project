import type { PluginContext, PluginManifest } from '../../../src/extension-api/index.js';
import { ModifiedStarDecorator } from './ModifiedStarDecorator.js';

/** Must stay identical to `package.json` so the host manifest check passes. */
export const manifest = {
  name: '@svgframe/plugin-tree-star',
  contributes: {
    shapes: [],
    commands: [],
    attributes: [],
    decorators: ['modified-star'],
  },
} satisfies PluginManifest;

export async function activate(context: PluginContext): Promise<void> {
  context.registerDecorator(new ModifiedStarDecorator());
}

export default { activate };
