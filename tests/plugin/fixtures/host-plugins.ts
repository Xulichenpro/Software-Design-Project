import type { PluginContext, PluginModule } from '../../../src/bootstrap/PluginHost.js';
import type { CommandRegistration } from '../../../src/application/contracts/CommandRegistration.js';
import type { ShapeRegistration } from '../../../src/domain/shapes/ShapeRegistration.js';
import type { AttributeHandler } from '../../../src/application/attributes/AttributeHandler.js';
import type { TreeDecorator } from '../../../src/application/tree/TreeDecorator.js';

export function commandRegistration(name: string): CommandRegistration {
  return Object.freeze({
    name,
    help: `${name} help`,
    create() { throw new Error('test registration is never instantiated'); },
  });
}

export interface FixtureContributions {
  readonly commands?: readonly string[];
  readonly shapes?: readonly ShapeRegistration[];
  readonly attributes?: readonly AttributeHandler[];
  readonly decorators?: readonly TreeDecorator[];
}

export function registeringModule(contributions: FixtureContributions): PluginModule {
  return {
    activate(context: PluginContext) {
      for (const command of contributions.commands ?? []) context.registerCommand(commandRegistration(command));
      for (const shape of contributions.shapes ?? []) context.registerShape(shape);
      for (const attribute of contributions.attributes ?? []) context.registerAttribute(attribute);
      for (const decorator of contributions.decorators ?? []) context.registerDecorator(decorator);
    },
  };
}

export function recordingOptionsModule(record: { options?: Readonly<Record<string, unknown>> }): PluginModule {
  return {
    activate(_context: PluginContext, options?: Readonly<Record<string, unknown>>) {
      record.options = options;
    },
  };
}

export function throwingModule(message: string): PluginModule {
  return {
    async activate() { throw new Error(message); },
  };
}
