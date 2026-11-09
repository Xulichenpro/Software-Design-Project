interface FixtureContext {
  registerCommand(registration: { name: string; help: string; create: (...args: unknown[]) => unknown }): void;
}

export default {
  activate(context: FixtureContext) {
    context.registerCommand({ name: 'index', help: 'index', create() { throw new Error('unused'); } });
  },
};
