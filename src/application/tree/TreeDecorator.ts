import type { DocumentEvent } from '../contracts/DocumentEvent.js';
import type { DocumentView } from '../contracts/DocumentView.js';
import type { TreeRow } from './TreeRow.js';

/** Label extension point rendered after the Phase 1 base tree row. */
export abstract class TreeDecorator {
  abstract readonly name: string;
  onCommitted(_event: DocumentEvent): void {}
  abstract decorate(row: TreeRow, document: DocumentView): string | undefined;
}
