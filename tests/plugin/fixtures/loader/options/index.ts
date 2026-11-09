import { appendFileSync, writeFileSync } from 'node:fs';

interface FixtureContext {
  registerCommand(registration: { name: string; help: string; create: (...args: unknown[]) => unknown }): void;
}

interface FixtureOptions {
  readonly marker?: string;
  readonly optionsFile?: string;
}

export default {
  activate(context: FixtureContext, options?: Readonly<FixtureOptions>) {
    if (typeof options?.marker === 'string') appendFileSync(options.marker, 'options\n');
    if (typeof options?.optionsFile === 'string') {
      writeFileSync(options.optionsFile, JSON.stringify({ frozen: Object.isFrozen(options), options }));
    }
    context.registerCommand({ name: 'options-cmd', help: 'options-cmd', create() { throw new Error('unused'); } });
  },
};
