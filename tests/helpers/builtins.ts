import { ShapeTree } from '../../src/domain/tree/ShapeTree.js';
import { RectShape } from '../../src/domain/shapes/RectShape.js';
import { CircleShape } from '../../src/domain/shapes/CircleShape.js';
import { EllipseShape } from '../../src/domain/shapes/EllipseShape.js';
import { LineShape } from '../../src/domain/shapes/LineShape.js';
import { TextShape } from '../../src/domain/shapes/TextShape.js';
import { GroupShape } from '../../src/domain/shapes/GroupShape.js';
import type { ShapeRegistration } from '../../src/domain/shapes/ShapeRegistration.js';
import { ShapeProviderRegistry } from '../../src/application/registries/ShapeProviderRegistry.js';
import { AttributeHandlerRegistry } from '../../src/application/registries/AttributeHandlerRegistry.js';
import { CommandRegistry } from '../../src/application/registries/CommandRegistry.js';
import { TreeDecoratorRegistry } from '../../src/application/registries/TreeDecoratorRegistry.js';
import { AttributeService } from '../../src/application/attributes/AttributeService.js';
import { ShapeEditorReceiver } from '../../src/application/receivers/ShapeEditorReceiver.js';
import { DocumentReceiver } from '../../src/application/receivers/DocumentReceiver.js';
import { QueryReceiver } from '../../src/application/receivers/QueryReceiver.js';
import { SvgXmlCodec } from '../../src/infrastructure/svg/SvgXmlCodec.js';
import { TreeRenderer } from '../../src/application/tree/TreeRenderer.js';
import type { CommandRegistration } from '../../src/application/contracts/CommandRegistration.js';
import type { FileGateway } from '../../src/application/contracts/FileGateway.js';
import type { AttributeHandler } from '../../src/application/attributes/AttributeHandler.js';
import type { TreeDecorator } from '../../src/application/tree/TreeDecorator.js';

/**
 * The six built-in shape registrations, in the order Phase 1 lists them.
 * Tests use this helper instead of importing a central builtin table so that a
 * unit test can exercise a registry without booting the entire application.
 */
export const builtinShapeEntries: readonly (readonly [string, ShapeRegistration])[] = [
  ['rect', RectShape], ['circle', CircleShape], ['ellipse', EllipseShape],
  ['line', LineShape], ['text', TextShape], ['g', GroupShape],
];

export function builtinShapeMap(): Map<string, ShapeRegistration> {
  return new Map(builtinShapeEntries.map(([type, registration]) => [type, registration]));
}

export function createShapeRegistry(): ShapeProviderRegistry {
  const registry = new ShapeProviderRegistry();
  registry.install(builtinShapeMap(), new Map());
  return registry;
}

export function createAttributeHandlerRegistry(entries: readonly (readonly [string, AttributeHandler])[] = []): AttributeHandlerRegistry {
  const registry = new AttributeHandlerRegistry();
  registry.install(new Map(), new Map(entries));
  return registry;
}

export function createCommandRegistry(entries: readonly CommandRegistration[] = []): CommandRegistry {
  const registry = new CommandRegistry();
  registry.install(new Map(), new Map(entries.map(entry => [entry.name, entry])));
  return registry;
}

export function createDecoratorRegistry(entries: readonly (readonly [string, TreeDecorator])[] = []): TreeDecoratorRegistry {
  const registry = new TreeDecoratorRegistry();
  registry.install(new Map(), new Map(entries));
  return registry;
}

export class MemoryFiles implements FileGateway {
  failWrite = false;
  failRead = false;
  constructor(public readonly files = new Map<string, string>()) {}
  async read(path: string) {
    if (this.failRead) throw new Error('read failed');
    const text = this.files.get(path);
    if (text === undefined) throw new Error('missing');
    return text;
  }
  async write(path: string, content: string) {
    if (this.failWrite) throw new Error('write failed');
    this.files.set(path, content);
  }
}

export interface ReceiverEnvironment {
  readonly tree: ShapeTree;
  readonly shapes: ShapeProviderRegistry;
  readonly handlers: AttributeHandlerRegistry;
  readonly attributes: AttributeService;
  readonly editor: ShapeEditorReceiver;
  readonly document: DocumentReceiver;
  readonly query: QueryReceiver;
  readonly commands: CommandRegistry;
  readonly decorators: TreeDecoratorRegistry;
  readonly renderer: TreeRenderer;
  readonly files: FileGateway;
}

export interface ReceiverEnvironmentOptions {
  readonly initialized?: boolean;
  readonly files?: FileGateway;
  readonly commands?: readonly CommandRegistration[];
  readonly handlers?: readonly (readonly [string, AttributeHandler])[];
  readonly decorators?: readonly (readonly [string, TreeDecorator])[];
}

/**
 * Builds the shared Phase 1 object graph on top of the public Phase 2
 * contracts. `QueryReceiver` deliberately depends on a command registry; the
 * registry may be installed with fake help entries or real registrations.
 */
export function createReceiverEnvironment(options: ReceiverEnvironmentOptions = {}): ReceiverEnvironment {
  const tree = new ShapeTree();
  const shapes = createShapeRegistry();
  const handlers = createAttributeHandlerRegistry(options.handlers);
  const attributes = new AttributeService(tree, handlers);
  const editor = new ShapeEditorReceiver(tree, shapes, attributes);
  const decorators = createDecoratorRegistry(options.decorators);
  const renderer = new TreeRenderer(decorators);
  const commands = createCommandRegistry(options.commands);
  const query = new QueryReceiver(tree, renderer, commands);
  const files = options.files ?? new MemoryFiles();
  const document = new DocumentReceiver(tree, new SvgXmlCodec(shapes), files);
  if (options.initialized ?? true) {
    document.initialize();
    editor.create('rect', 'r', ['1', '2', '3', '4']);
  }
  return { tree, shapes, handlers, attributes, editor, document, query, commands, decorators, renderer, files };
}

export function createHelpCommands(): readonly CommandRegistration[] {
  return [{
    name: 'create',
    help: 'create <type> <id> [params…] [in <containerId>]',
    create() { throw new Error('help-only registration'); },
  }];
}

export function createQueryReceiver(tree: ShapeTree): QueryReceiver {
  return new QueryReceiver(tree, new TreeRenderer(createDecoratorRegistry()), createCommandRegistry());
}
