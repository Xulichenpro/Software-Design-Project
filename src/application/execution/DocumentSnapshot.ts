import type { ShapeSnapshot } from '../contracts/DocumentEvent.js';
import type { DocumentView } from '../contracts/DocumentView.js';
import type { Shape } from '../../domain/shapes/Shape.js';

/** Captures an immutable before/after snapshot of every reachable shape. */
export function snapshotDocument(document: DocumentView): ReadonlyMap<string, ShapeSnapshot> {
  const snapshots = new Map<string, ShapeSnapshot>();
  let root;
  try {
    root = document.root;
  } catch {
    return snapshots;
  }
  const visit = (shapes: readonly Shape[]) => {
    for (const shape of shapes) {
      const description = shape.describe();
      const parent = shape.parent;
      const parentId = parent && 'id' in parent ? String(parent.id) : undefined;
      snapshots.set(shape.id, Object.freeze({
        id: shape.id,
        kind: shape.kind,
        tag: shape.tag,
        content: [description.heading, description.geometry, description.style].filter(Boolean).join('  '),
        parentId,
        childrenIds: Object.freeze(shape.descendants.map(child => child.id)),
      }));
      visit(shape.descendants);
    }
  };
  visit(root.children.items);
  return snapshots;
}
