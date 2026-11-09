import type { DocumentEvent } from './DocumentEvent.js';

export interface CommandResult {
  readonly lines: readonly string[];
  readonly warnings?: readonly string[];
  readonly documentEvent?: DocumentEvent;
}
