import type { Terminal } from '../application/contracts/Terminal.js';
import type { CommandRegistration } from '../application/contracts/CommandRegistration.js';
import type { AttributeHandler } from '../application/attributes/AttributeHandler.js';
import type { TreeDecorator } from '../application/tree/TreeDecorator.js';
import type { ShapeRegistration } from '../domain/shapes/ShapeRegistration.js';

export interface PluginContributes {
  readonly shapes?: readonly string[];
  readonly commands?: readonly string[];
  readonly attributes?: readonly string[];
  readonly decorators?: readonly string[];
}

export interface PluginManifest {
  readonly name: string;
  readonly contributes?: PluginContributes;
}

export interface PluginContext {
  registerShape(registration: ShapeRegistration): void;
  registerCommand(registration: CommandRegistration): void;
  registerAttribute(handler: AttributeHandler): void;
  registerDecorator(decorator: TreeDecorator): void;
}

export interface PluginModule {
  activate(context: PluginContext, options?: Readonly<Record<string, unknown>>): void | Promise<void>;
}

export interface BuiltinNames {
  readonly shapes: readonly string[];
  readonly commands: readonly string[];
  readonly attributes: readonly string[];
  readonly decorators: readonly string[];
}

export interface AcceptedContributions {
  readonly shapes: ReadonlyMap<string, ShapeRegistration>;
  readonly commands: ReadonlyMap<string, CommandRegistration>;
  readonly attributes: ReadonlyMap<string, AttributeHandler>;
  readonly decorators: ReadonlyMap<string, TreeDecorator>;
}

type Category = 'shapes' | 'commands' | 'attributes' | 'decorators';
const categories: readonly Category[] = ['shapes', 'commands', 'attributes', 'decorators'];

interface StagedContributions {
  readonly shapes: Map<string, ShapeRegistration>;
  readonly commands: Map<string, CommandRegistration>;
  readonly attributes: Map<string, AttributeHandler>;
  readonly decorators: Map<string, TreeDecorator>;
}

/**
 * Stages and validates one plugin at a time. Nothing reaches the accepted
 * contribution maps until activation and every validation step has passed.
 */
export class PluginHost {
  readonly #builtinNames: Record<Category, ReadonlySet<string>>;
  readonly #terminal: Terminal;
  readonly #accepted: StagedContributions = {
    shapes: new Map(), commands: new Map(), attributes: new Map(), decorators: new Map(),
  };

  constructor(builtinNames: BuiltinNames, terminal: Terminal) {
    this.#builtinNames = {
      shapes: new Set(builtinNames.shapes),
      commands: new Set(builtinNames.commands),
      attributes: new Set(builtinNames.attributes),
      decorators: new Set(builtinNames.decorators),
    };
    this.#terminal = terminal;
  }

  get contributions(): AcceptedContributions { return this.#accepted; }

  async load(
    module: PluginModule,
    manifest: PluginManifest,
    options?: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    const staged: StagedContributions = {
      shapes: new Map(), commands: new Map(), attributes: new Map(), decorators: new Map(),
    };
    let internalDuplicate: string | undefined;
    const stage = <T>(category: Category, name: string, value: T, target: Map<string, T>): void => {
      if (target.has(name)) { internalDuplicate ??= `${category}/${name}`; return; }
      target.set(name, value);
    };
    const context: PluginContext = {
      registerShape: registration => stage('shapes', registration.type, registration, staged.shapes),
      registerCommand: registration => stage('commands', registration.name, registration, staged.commands),
      registerAttribute: handler => stage('attributes', handler.name, handler, staged.attributes),
      registerDecorator: decorator => stage('decorators', decorator.name, decorator, staged.decorators),
    };
    try {
      await module.activate(context, options === undefined ? undefined : Object.freeze(options));
    } catch (error) {
      this.#error(`plugin failed to activate: ${manifest.name} (${reasonOf(error)})`);
      return;
    }
    const declared = this.#declared(manifest);
    const registered = {
      shapes: [...staged.shapes.keys()],
      commands: [...staged.commands.keys()],
      attributes: [...staged.attributes.keys()],
      decorators: [...staged.decorators.keys()],
    };
    const mismatch = !declared || categories.some(category => !sameNames(declared[category], registered[category]));
    if (mismatch) {
      this.#error(`plugin manifest mismatch: ${manifest.name} ` +
        `(declared: ${declared ? formatNames(declared) : 'invalid'}, registered: ${formatNames(registered)})`);
      return;
    }
    if (internalDuplicate) {
      this.#error(`duplicate registration: ${internalDuplicate}`);
      return;
    }
    for (const category of categories) {
      for (const name of registered[category]) {
        if (this.#isDuplicate(category, name)) {
          this.#error(`duplicate registration: ${category}/${name}`);
          return;
        }
      }
    }
    for (const [name, value] of staged.shapes) this.#accepted.shapes.set(name, value);
    for (const [name, value] of staged.commands) this.#accepted.commands.set(name, value);
    for (const [name, value] of staged.attributes) this.#accepted.attributes.set(name, value);
    for (const [name, value] of staged.decorators) this.#accepted.decorators.set(name, value);
  }

  #declared(manifest: PluginManifest): Record<Category, readonly string[]> | undefined {
    const contributes: unknown = manifest.contributes;
    const declared: Record<Category, readonly string[]> = { shapes: [], commands: [], attributes: [], decorators: [] };
    if (contributes === undefined) return declared;
    if (typeof contributes !== 'object' || contributes === null || Array.isArray(contributes)) return undefined;
    for (const category of categories) {
      const names = (contributes as Record<string, unknown>)[category];
      if (names === undefined) continue;
      if (!Array.isArray(names) || names.some(name => typeof name !== 'string' || !name.trim())) return undefined;
      declared[category] = names;
    }
    return declared;
  }

  #isDuplicate(category: Category, name: string): boolean {
    return this.#builtinNames[category].has(name) || this.#accepted[category].has(name);
  }

  #error(message: string): void {
    this.#terminal.writeLine(`error: ${message}`);
  }
}

function sameNames(declared: readonly string[], registered: readonly string[]): boolean {
  const left = new Set(declared); const right = new Set(registered);
  if (left.size !== right.size) return false;
  for (const name of left) if (!right.has(name)) return false;
  return true;
}

function formatNames(names: Record<Category, readonly string[]>): string {
  return `[${categories.flatMap(category => names[category]).sort().join(', ')}]`;
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
