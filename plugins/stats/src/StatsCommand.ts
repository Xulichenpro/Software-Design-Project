import { QueryCommand, ShapeProvider } from '../../../src/extension-api/index.js';
import type {
  CommandResult, DocumentView, Shape, ShapeContainer,
} from '../../../src/extension-api/index.js';

/**
 * Read-only structural summary of the shared document. Containers are counted
 * separately and never contribute a leaf kind; leaves are grouped by `kind` in
 * first-encountered depth-first order. The canvas root is not counted.
 */
export class StatsCommand extends QueryCommand {
  constructor(private readonly document: DocumentView) { super(); }

  execute(): CommandResult {
    this.document.requireInitialized();
    const counts = new Map<string, number>();
    let containers = 0;

    const visit = (container: ShapeContainer): void => {
      for (const shape of container.children.items) {
        const nested = asContainer(shape);
        if (nested) {
          containers += 1;
          visit(nested);
        } else {
          counts.set(shape.kind, (counts.get(shape.kind) ?? 0) + 1);
        }
      }
    };
    visit(this.document.root);

    const segments = [...counts].map(([kind, count]) => `${kind}: ${count}`);
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    segments.push(`(total ${total}, containers ${containers})`);
    return { lines: [segments.join('  ')] };
  }
}

function asContainer(shape: Shape): ShapeContainer | undefined {
  return shape instanceof ShapeProvider ? shape.asContainer() : undefined;
}
