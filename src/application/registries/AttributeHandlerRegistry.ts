import type { AttributeHandler } from '../attributes/AttributeHandler.js';

export class AttributeHandlerRegistry {
  #entries: ReadonlyMap<string, AttributeHandler> | undefined;

  install(
    builtin: ReadonlyMap<string, AttributeHandler>,
    plugin: ReadonlyMap<string, AttributeHandler>,
  ): void {
    if (this.#entries) throw new Error('attribute handler registry is already installed');
    const merged = new Map<string, AttributeHandler>();
    for (const [name, handler] of [...builtin, ...plugin]) {
      if (merged.has(name)) throw new Error(`duplicate attribute handler registration: ${name}`);
      merged.set(name, handler);
    }
    this.#entries = merged;
  }

  get(name: string): AttributeHandler {
    const handler = this.#entries?.get(name);
    if (!handler) throw new Error(`unknown attribute handler: ${name}`);
    return handler;
  }

  values(): readonly AttributeHandler[] {
    if (!this.#entries) throw new Error('attribute handler registry is not installed');
    return [...this.#entries.values()];
  }
}
