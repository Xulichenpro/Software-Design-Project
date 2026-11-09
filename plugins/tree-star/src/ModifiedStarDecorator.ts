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
    const stableParents = parentsWithSameChildren(event.before, event.after);
    let changed = false;
    for (const id of union(event.before.keys(), event.after.keys())) {
      const before = event.before.get(id);
      const after = event.after.get(id);
      const reordered = before?.siblingIndex !== undefined && after?.siblingIndex !== undefined
        && before.siblingIndex !== after.siblingIndex && stableParents.has(before.parentId);
      if (before && after && unchanged(before, after) && !reordered) continue;

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

/** A shifted index alone is an edit only when the siblings themselves did not change. */
function parentsWithSameChildren(
  before: ReadonlyMap<string, ShapeSnapshot>, after: ReadonlyMap<string, ShapeSnapshot>,
): ReadonlySet<string | undefined> {
  const childrenByParent = (snapshots: ReadonlyMap<string, ShapeSnapshot>) => {
    const parents = new Map<string | undefined, Set<string>>();
    for (const snapshot of snapshots.values()) {
      let children = parents.get(snapshot.parentId);
      if (!children) parents.set(snapshot.parentId, children = new Set());
      children.add(snapshot.id);
    }
    return parents;
  };
  const left = childrenByParent(before);
  const right = childrenByParent(after);
  const stableParents = new Set<string | undefined>();
  for (const [parent, children] of left) {
    const next = right.get(parent);
    if (next && children.size === next.size && [...children].every(id => next.has(id))) stableParents.add(parent);
  }
  return stableParents;
}

function unchanged(before: ShapeSnapshot, after: ShapeSnapshot): boolean {
  return before.content === after.content
    && before.parentId === after.parentId
    && sameIds(before.childrenIds, after.childrenIds);
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
