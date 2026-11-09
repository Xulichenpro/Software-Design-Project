import type { DocumentView } from './DocumentView.js';

/** Runtime services injected into command registrations by `CliApplication`. */
export interface CommandServices {
  readonly document: DocumentView;
}
