import { TreeDecorator } from '../../../src/extension-api/index.js';
import type { DocumentView, TreeRow } from '../../../src/extension-api/index.js';

/** Appends `(box)` to tree rows whose kind is `box`; it ignores other labels. */
export class BoxTypeDecorator extends TreeDecorator {
  readonly name = 'box-type-label';

  decorate(row: TreeRow, _document: DocumentView): string | undefined {
    return row.kind === 'box' ? '(box)' : undefined;
  }
}
