import type { TreeDecorator } from '../tree/TreeDecorator.js';
import type { TreeRow } from '../tree/TreeRow.js';
import type { DocumentView } from '../contracts/DocumentView.js';
import type { DocumentEvent, DocumentObserver } from '../contracts/DocumentEvent.js';

export class TreeDecoratorRegistry implements DocumentObserver {
  #entries: ReadonlyMap<string, TreeDecorator> | undefined;

  install(
    builtin: ReadonlyMap<string, TreeDecorator>,
    plugin: ReadonlyMap<string, TreeDecorator>,
  ): void {
    if (this.#entries) throw new Error('tree decorator registry is already installed');
    const merged = new Map<string, TreeDecorator>();
    for (const [name, decorator] of [...builtin, ...plugin]) {
      if (merged.has(name)) throw new Error(`duplicate tree decorator registration: ${name}`);
      merged.set(name, decorator);
    }
    this.#entries = merged;
  }

  get(name: string): TreeDecorator {
    const decorator = this.#entries?.get(name);
    if (!decorator) throw new Error(`unknown tree decorator: ${name}`);
    return decorator;
  }

  values(): readonly TreeDecorator[] {
    if (!this.#entries) throw new Error('tree decorator registry is not installed');
    return [...this.#entries.values()];
  }

  decorate(row: TreeRow, document: DocumentView): readonly string[] {
    const suffixes: string[] = [];
    for (const decorator of this.values()) {
      try {
        const suffix = decorator.decorate(row, document);
        if (suffix) suffixes.push(suffix);
      } catch {
        // A broken decorator must not break rendering.
      }
    }
    return suffixes;
  }

  onCommitted(event: DocumentEvent): void {
    for (const decorator of this.values()) {
      try {
        decorator.onCommitted(event);
      } catch {
        // A broken decorator must not break an already committed command.
      }
    }
  }
}
