import type { ShapeTree } from '../../domain/tree/ShapeTree.js';
import type { Shape } from '../../domain/shapes/Shape.js';
import type { CommandResult } from '../contracts/CommandResult.js';
export class QueryReceiver {
  constructor(private readonly treeState: ShapeTree) {}
  tree(id?: string): CommandResult {
    this.treeState.requireInitialized();
    const lines: string[] = [];
    const summary = (shape: Shape) => { const d = shape.describe(); return [d.heading, d.geometry, d.style].filter(Boolean).join('  '); };
    const walk = (shapes: readonly Shape[], prefix: string) => {
      shapes.forEach((shape, index) => {
        const last = index === shapes.length - 1; lines.push(prefix + (last ? '└── ' : '├── ') + summary(shape));
        walk(shape.descendants, prefix + (last ? '    ' : '│   '));
      });
    };
    if (id) { const shape = this.treeState.findShape(id); lines.push(summary(shape)); walk(shape.descendants, ''); }
    else { const { width, height } = this.treeState.canvasSize; lines.push(`svg (${width}x${height})`); walk(this.treeState.root.children.items, ''); }
    return { lines };
  }
  show(id: string): CommandResult {
    const shape = this.treeState.findShape(id); const d = shape.describe();
    return { lines: [`${d.heading}  parent=${shape.parent?.label ?? 'svg'}`, ...[d.geometry, d.style].filter(Boolean).map(line => '  ' + line)] };
  }
  showCanvas(): CommandResult { const { width, height } = this.treeState.canvasSize; return { lines: [`canvas ${width}x${height}`] }; }
  help(): CommandResult {
    return { lines: ['init [w] [h]', 'read <file.svg>', 'save [file.svg]', 'canvas [w] [h]',
      'create <type> <id> [params…] [in <containerId>]', 'delete <id>', 'move <id> <dx> <dy>',
      'scale <id> <factor>', 'set <id> <attr> <value>', 'group <newGid> <id1> <id2>…', 'ungroup <gid>',
      'addto <gid> <id>', 'front <id>', 'back <id>', 'tree [id]', 'show <id>', 'help', 'undo', 'redo'] };
  }
}

