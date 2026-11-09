import type { ShapeTree } from '../../domain/tree/ShapeTree.js';
import type { CommandResult } from '../contracts/CommandResult.js';
import type { TreeRenderer } from '../tree/TreeRenderer.js';
import type { CommandRegistry } from '../registries/CommandRegistry.js';

export class QueryReceiver {
  constructor(
    private readonly treeState: ShapeTree,
    private readonly renderer: TreeRenderer,
    private readonly commands: CommandRegistry,
  ) {}
  tree(id?: string): CommandResult { return this.renderer.render(this.treeState, id); }
  show(id: string): CommandResult {
    const shape = this.treeState.findShape(id); const d = shape.describe();
    return { lines: [`${d.heading}  parent=${shape.parent?.label ?? 'svg'}`, ...[d.geometry, d.style].filter(Boolean).map(line => '  ' + line)] };
  }
  showCanvas(): CommandResult { const { width, height } = this.treeState.canvasSize; return { lines: [`canvas ${width}x${height}`] }; }
  help(): CommandResult { return { lines: this.commands.values().map(registration => registration.help) }; }
}
