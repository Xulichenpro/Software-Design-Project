import { appendFileSync } from 'node:fs';

interface FixtureContext {
  registerCommand(registration: { name: string; help: string; create: (...args: unknown[]) => unknown }): void;
}

interface FixtureOptions {
  readonly marker?: string;
}

export default {
  activate(context: FixtureContext, options?: Readonly<FixtureOptions>) {
    if (typeof options?.marker === 'string') appendFileSync(options.marker, 'valid\n');
    context.registerCommand({ name: 'ping', help: 'ping', create() { throw new Error('unused'); } });
  },
};
