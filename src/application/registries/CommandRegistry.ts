import type { CommandRegistration } from '../contracts/CommandRegistration.js';

export class CommandRegistry {
  #entries: ReadonlyMap<string, CommandRegistration> | undefined;

  install(
    builtin: ReadonlyMap<string, CommandRegistration>,
    plugin: ReadonlyMap<string, CommandRegistration>,
  ): void {
    if (this.#entries) throw new Error('command registry is already installed');
    const merged = new Map<string, CommandRegistration>();
    for (const [name, registration] of [...builtin, ...plugin]) {
      if (merged.has(name)) throw new Error(`duplicate command registration: ${name}`);
      merged.set(name, registration);
    }
    this.#entries = merged;
  }

  get(name: string): CommandRegistration {
    const registration = this.#entries?.get(name);
    if (!registration) throw new Error(`unknown command: ${name}`);
    return registration;
  }

  values(): readonly CommandRegistration[] {
    if (!this.#entries) throw new Error('command registry is not installed');
    return [...this.#entries.values()];
  }
}
