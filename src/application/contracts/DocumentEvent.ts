export type DocumentEventKind =
  | 'edited' | 'history' | 'saved' | 'replaced' | 'initialized' | 'resized';

export interface ShapeSnapshot {
  readonly id: string;
  readonly kind: string;
  readonly tag: string;
  /** Own content only; child content is represented by `childrenIds`. */
  readonly content: string;
  readonly parentId: string | undefined;
  /** Position within the parent's children, including children of the SVG root. */
  readonly siblingIndex?: number;
  readonly childrenIds: readonly string[];
}

export interface DocumentEvent {
  readonly kind: DocumentEventKind;
  readonly before: ReadonlyMap<string, ShapeSnapshot>;
  readonly after: ReadonlyMap<string, ShapeSnapshot>;
}

export interface DocumentObserver {
  onCommitted(event: DocumentEvent): void;
}

/** Builds an immutable event from already captured snapshots. */
export function createDocumentEvent(
  kind: DocumentEventKind,
  before: ReadonlyMap<string, ShapeSnapshot>,
  after: ReadonlyMap<string, ShapeSnapshot>,
): DocumentEvent {
  return Object.freeze({ kind, before, after });
}
