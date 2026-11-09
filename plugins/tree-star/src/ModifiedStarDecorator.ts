import { TreeDecorator } from '../../../src/extension-api/index.js';
import type {
  DocumentEvent, DocumentView, ShapeSnapshot, TreeRow,
} from '../../../src/extension-api/index.js';

/**
 * Appends `*` to rows that were edited since the last successful save/read.
 *
 * State lives only in this instance: `#dirtyIds` accumulates ids touched by
 * `edited` events and `#rootDirty` tracks edits that are not attributable to a
 * single shape (init/resize/ancestor propagation). Undo/redo deliberately do
 * nothing, so returning to the saved state keeps the stars (ADR-005).
 */
export class ModifiedStarDecorator extends TreeDecorator {
  readonly name = 'modified-star';
  readonly #dirtyIds = new Set<string>();
  #rootDirty = false;

  override onCommitted(event: DocumentEvent): void {
    switch (event.kind) {
      case 'saved':
      case 'replaced':
        this.#dirtyIds.clear();
        this.#rootDirty = false;
        return;
      case 'initialized':
        this.#dirtyIds.clear();
        this.#rootDirty = true;
        return;
      case 'resized':
        this.#rootDirty = true;
        return;
      case 'history':
        return;
      case 'edited':
        this.#recordEdit(event);
        return;
      default:
        return;
    }
  }

  override decorate(row: TreeRow, _document: DocumentView): string | undefined {
    if (row.isRoot) return this.#rootDirty ? '*' : undefined;
    return row.id !== undefined && this.#dirtyIds.has(row.id) ? '*' : undefined;
  }

  #recordEdit(event: DocumentEvent): void {
    let changed = false;
    for (const id of union(event.before.keys(), event.after.keys())) {
      const before = event.before.get(id);
      const after = event.after.get(id);
      if (before && after && unchanged(before, after)) continue;

      changed = true;
      this.#dirtyIds.add(id);
      if (before) this.#markAncestors(before.parentId, event.before);
      if (after) this.#markAncestors(after.parentId, event.after);
    }
    if (changed) this.#rootDirty = true;
  }

  #markAncestors(parentId: string | undefined, snapshots: ReadonlyMap<string, ShapeSnapshot>): void {
    const visited = new Set<string>();
    let current = parentId;
    while (current !== undefined && !visited.has(current)) {
      visited.add(current);
      this.#dirtyIds.add(current);
      current = snapshots.get(current)?.parentId;
    }
  }
}

function union(left: Iterable<string>, right: Iterable<string>): Set<string> {
  return new Set([...left, ...right]);
}

function unchanged(before: ShapeSnapshot, after: ShapeSnapshot): boolean {
  return before.content === after.content
    && before.parentId === after.parentId
    && sameIds(before.childrenIds, after.childrenIds);
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
