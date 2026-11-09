import { ShapeTree } from '../../../src/domain/tree/ShapeTree.js';
import { RectShape } from '../../../src/domain/shapes/RectShape.js';
import { CircleShape } from '../../../src/domain/shapes/CircleShape.js';
import { EllipseShape } from '../../../src/domain/shapes/EllipseShape.js';
import { LineShape } from '../../../src/domain/shapes/LineShape.js';
import { TextShape } from '../../../src/domain/shapes/TextShape.js';
import { GroupShape } from '../../../src/domain/shapes/GroupShape.js';
import type { Shape } from '../../../src/domain/shapes/Shape.js';
import type { ShapeRegistration } from '../../../src/domain/shapes/ShapeRegistration.js';
import type { ShapeTopology } from '../../../src/domain/tree/ShapeTopology.js';
import { ShapeProviderRegistry } from '../../../src/application/registries/ShapeProviderRegistry.js';
import { AttributeHandlerRegistry } from '../../../src/application/registries/AttributeHandlerRegistry.js';
import { TreeDecoratorRegistry } from '../../../src/application/registries/TreeDecoratorRegistry.js';
import { AttributeService } from '../../../src/application/attributes/AttributeService.js';
import { ShapeEditorReceiver } from '../../../src/application/receivers/ShapeEditorReceiver.js';
import { DocumentReceiver } from '../../../src/application/receivers/DocumentReceiver.js';
import { SvgXmlCodec } from '../../../src/infrastructure/svg/SvgXmlCodec.js';
import { TreeRenderer } from '../../../src/application/tree/TreeRenderer.js';
import { CommandExecutor } from '../../../src/application/execution/CommandExecutor.js';
import type { AttributeHandler } from '../../../src/application/attributes/AttributeHandler.js';
import type { TreeDecorator } from '../../../src/application/tree/TreeDecorator.js';
import type { DocumentEvent, DocumentObserver } from '../../../src/application/contracts/DocumentEvent.js';
import type { FileGateway } from '../../../src/application/contracts/FileGateway.js';
import { BoxShape } from '../../../plugins/box/src/BoxShape.js';
import { BoxAttributeHandler } from '../../../plugins/box/src/BoxAttributeHandler.js';
import { BoxTypeDecorator } from '../../../plugins/box/src/BoxTypeDecorator.js';

const builtinShapeEntries: readonly (readonly [string, ShapeRegistration])[] = [
  ['rect', RectShape], ['circle', CircleShape], ['ellipse', EllipseShape],
  ['line', LineShape], ['text', TextShape], ['g', GroupShape],
];

/** The six Phase 1 providers without the box plugin. */
export function builtinShapeMap(): Map<string, ShapeRegistration> {
  return new Map(builtinShapeEntries.map(([type, registration]) => [type, registration]));
}

/** Phase 1 providers plus the box plugin registration. */
export function boxShapeMap(): Map<string, ShapeRegistration> {
  return new Map([...builtinShapeMap(), ['box', BoxShape]]);
}

export function createBuiltinRegistry(): ShapeProviderRegistry {
  const registry = new ShapeProviderRegistry();
  registry.install(builtinShapeMap(), new Map());
  return registry;
}

export function createBoxRegistry(): ShapeProviderRegistry {
  const registry = new ShapeProviderRegistry();
  registry.install(builtinShapeMap(), new Map([['box', BoxShape]]));
  return registry;
}

export function boxArguments(
  x = 120, y = 100, width = 160, height = 60, title = '开始',
): string[] {
  return [String(x), String(y), String(width), String(height), title];
}

export const boxQuoted: readonly boolean[] = [false, false, false, false, true];

/** Creates a detached box through the registered provider and the real context. */
export function standaloneBox(
  id = 'n1', x = 120, y = 100, width = 160, height = 60, title = '开始',
): BoxShape {
  return createBoxRegistry().createFromArguments(
    'box', id, boxArguments(x, y, width, height, title), [...boxQuoted],
  ) as BoxShape;
}

export class MemoryFiles implements FileGateway {
  constructor(public readonly files = new Map<string, string>()) {}
  async read(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error('missing');
    return content;
  }
  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }
}

export class RecordingObserver implements DocumentObserver {
  readonly events: DocumentEvent[] = [];
  onCommitted(event: DocumentEvent): void { this.events.push(event); }
}

export interface BoxEnvironment {
  readonly tree: ShapeTree;
  readonly shapes: ShapeProviderRegistry;
  readonly handlerRegistry: AttributeHandlerRegistry;
  readonly attributes: AttributeService;
  readonly editor: ShapeEditorReceiver;
  readonly document: DocumentReceiver;
  readonly decorators: TreeDecoratorRegistry;
  readonly renderer: TreeRenderer;
  readonly files: MemoryFiles;
  readonly handler: AttributeHandler;
}

export interface BoxEnvironmentOptions {
  readonly initialized?: boolean;
  readonly handlers?: readonly AttributeHandler[];
  readonly decorators?: readonly TreeDecorator[];
  readonly files?: MemoryFiles;
}

/** Builds the shared domain/application graph with box registered as an optional plugin. */
export function createBoxEnvironment(options: BoxEnvironmentOptions = {}): BoxEnvironment {
  const tree = new ShapeTree();
  const shapes = createBoxRegistry();
  const handlers = options.handlers ?? [new BoxAttributeHandler()];
  const decoratorList = options.decorators ?? [new BoxTypeDecorator()];
  const handlerRegistry = new AttributeHandlerRegistry();
  handlerRegistry.install(new Map(), new Map(handlers.map(handler => [handler.name, handler])));
  const decorators = new TreeDecoratorRegistry();
  decorators.install(new Map(), new Map(decoratorList.map(decorator => [decorator.name, decorator])));
  const attributes = new AttributeService(tree, handlerRegistry);
  const editor = new ShapeEditorReceiver(tree, shapes, attributes);
  const files = options.files ?? new MemoryFiles();
  const document = new DocumentReceiver(tree, new SvgXmlCodec(shapes), files);
  const renderer = new TreeRenderer(decorators);
  if (options.initialized ?? true) document.initialize(800, 600);
  return {
    tree, shapes, handlerRegistry, attributes, editor, document, decorators, renderer, files,
    handler: handlers[0]!,
  };
}

export function createExecutor(environment: BoxEnvironment, observer?: DocumentObserver): CommandExecutor {
  return new CommandExecutor(observer, environment.tree);
}

/** Creates a box through the receiver, using the same quoted flags as the CLI token stream. */
export function addBox(
  environment: BoxEnvironment,
  id: string,
  x = 120, y = 100, width = 160, height = 60, title = '开始', parentId?: string,
): BoxShape {
  environment.editor.create('box', id, boxArguments(x, y, width, height, title), parentId, [...boxQuoted]);
  return environment.tree.findShape(id) as BoxShape;
}

export function childIds(shape: Shape): readonly string[] {
  return shape.descendants.map(child => child.id);
}

export function allShapeIds(tree: ShapeTree): readonly string[] {
  return tree.shapes.map(shape => shape.id).sort();
}

/** A consistent immutable topology for a standalone box and its direct children. */
export function topologyFor(box: BoxShape, children: readonly Shape[] = box.descendants): ShapeTopology {
  return {
    parentOf: shape => (children as readonly Shape[]).includes(shape) ? box : undefined,
    childrenOf: container => container === box ? children : [],
    contains: shape => shape === box || (children as readonly Shape[]).includes(shape),
  };
}

export function boxSvg(
  id = 'n1', x = 120, y = 100, width = 160, height = 60, title = '开始',
  extraAttributes = '', extraChildren = '',
): string {
  return `<g id="${id}" data-kind="box"${extraAttributes}>` +
    `<rect id="${id}-rect" x="${x}" y="${y}" width="${width}" height="${height}" fill="#4a90d9"/>` +
    `<text id="${id}-label" x="${x + 20}" y="${y + 35}">${title}</text>` +
    `${extraChildren}</g>`;
}

export function svgDocument(...children: readonly string[]): string {
  return '<?xml version="1.0"?>' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">' +
    `${children.join('')}</svg>`;
}
