import type { PluginContext, PluginManifest } from '../../../src/extension-api/index.js';
import { BoxShape } from './BoxShape.js';
import { BoxAttributeHandler } from './BoxAttributeHandler.js';
import { BoxTypeDecorator } from './BoxTypeDecorator.js';

/** Must stay identical to `package.json` so the host manifest check passes. */
export const manifest = {
  name: '@svgframe/plugin-shape-box',
  contributes: {
    shapes: ['box'],
    commands: [],
    attributes: ['box-attributes'],
    decorators: ['box-type-label'],
  },
} satisfies PluginManifest;

export async function activate(context: PluginContext): Promise<void> {
  context.registerShape(BoxShape);
  context.registerAttribute(new BoxAttributeHandler());
  context.registerDecorator(new BoxTypeDecorator());
}

export default { activate };
