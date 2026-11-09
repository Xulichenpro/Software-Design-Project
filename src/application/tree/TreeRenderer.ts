import type { CommandResult } from '../contracts/CommandResult.js';
import type { ShapeTree } from '../../domain/tree/ShapeTree.js';
import type { Shape } from '../../domain/shapes/Shape.js';
import type { TreeDecoratorRegistry } from '../registries/TreeDecoratorRegistry.js';
import type { TreeRow } from './TreeRow.js';

export class TreeRenderer {
  constructor(private readonly decorators: TreeDecoratorRegistry) {}

  render(tree: ShapeTree, id?: string): CommandResult {
    tree.requireInitialized();
    const lines: string[] = [];
    const render = (shape: Shape, prefix: string, last: boolean) => {
      lines.push(this.decorate(tree, {
        id: shape.id,
        kind: shape.kind,
        isRoot: false,
        base: prefix + (last ? '└── ' : '├── ') + this.summary(shape),
      }));
      renderChildren(shape.descendants, prefix + (last ? '    ' : '│   '));
    };
    const renderChildren = (shapes: readonly Shape[], prefix: string) => {
      shapes.forEach((shape, index) => render(shape, prefix, index === shapes.length - 1));
    };
    if (id) {
      const shape = tree.findShape(id);
      lines.push(this.decorate(tree, {
        id: shape.id,
        kind: shape.kind,
        isRoot: false,
        base: this.summary(shape),
      }));
      renderChildren(shape.descendants, '');
    } else {
      const { width, height } = tree.canvasSize;
      lines.push(this.decorate(tree, {
        id: undefined,
        kind: undefined,
        isRoot: true,
        base: `svg (${width}x${height})`,
      }));
      renderChildren(tree.root.children.items, '');
    }
    return { lines };
  }

  private summary(shape: Shape): string {
    const description = shape.describe();
    return [description.heading, description.geometry, description.style].filter(Boolean).join('  ');
  }

  private decorate(tree: ShapeTree, row: TreeRow): string {
    let line = row.base;
    for (const suffix of this.decorators.decorate(row, tree)) line += ' ' + suffix;
    return line;
  }
}
