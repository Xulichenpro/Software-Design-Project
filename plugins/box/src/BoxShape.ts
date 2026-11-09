import { ChildCollection, ShapeProvider, ShapeStyle } from '../../../src/extension-api/index.js';
import type {
  Shape, ShapeContainer, ShapeCreationContext, ShapeTopology, SvgElement,
} from '../../../src/extension-api/index.js';

/** Phase 1 numeric argument rule for the five template parameters. */
function numericArgument(args: readonly string[], index: number): number {
  const value = args[index];
  if (value === undefined || !value.trim() || !Number.isFinite(Number(value))) {
    throw new Error('geometry must be finite');
  }
  return Number(value);
}

/**
 * Composite shape made of a rectangle and a text label. It is also a
 * container: extra children (including nested boxes) may join it.
 */
export class BoxShape extends ShapeProvider implements ShapeContainer {
  static readonly type = 'box';
  readonly #children: ChildCollection = new ChildCollection(this);

  constructor(id: string) { super(id, {}); }

  override get kind() { return 'box'; }
  get tag() { return 'g'; }
  get children(): ChildCollection { return this.#children; }
  override asContainer(): ShapeContainer { return this; }
  override canUngroup(): boolean { return false; }
  override get descendants(): readonly Shape[] { return this.#children.items; }

  protected get xKeys(): readonly string[] { return []; }
  protected get yKeys(): readonly string[] { return []; }

  static createFromArguments(
    id: string,
    args: readonly string[],
    quoted: readonly boolean[] | undefined,
    context: ShapeCreationContext,
  ): BoxShape {
    if (args.length !== 5) throw new Error('invalid parameters for box');
    if (quoted && !quoted[4]) throw new Error('box title must be quoted');
    const x = numericArgument(args, 0);
    const y = numericArgument(args, 1);
    const width = numericArgument(args, 2);
    const height = numericArgument(args, 3);
    const title = args[4] ?? '';

    const rect = context.createFromArguments('rect', `${id}-rect`, [
      String(x), String(y), String(width), String(height), '#4a90d9',
    ]);
    const label = context.createFromArguments('text', `${id}-label`, [
      String(x + 20), String(y + 35), title,
    ]);

    const box = new BoxShape(id);
    box.#children.insert(rect, box.#children.items.length);
    box.#children.insert(label, box.#children.items.length);
    box.requireRequiredParts(box.#children.items);
    return box;
  }

  static createFromSvgElement(element: SvgElement, context: ShapeCreationContext): BoxShape {
    if (element.tag !== 'g') throw new Error(`box must be a g element: ${element.tag}`);
    const box = new BoxShape(element.attributes.id ?? '');
    for (const [name, value] of Object.entries(element.attributes)) {
      if (name === 'id') continue;
      if (!ShapeStyle.names.includes(name)) throw new Error(`unknown attribute: ${name}`);
      box.setAttribute(name, value);
    }
    if (element.text?.trim()) throw new Error('unexpected text in container');
    for (const child of element.children) {
      box.#children.insert(context.createFromSvgElement(child), box.#children.items.length);
    }
    box.requireRequiredParts(box.#children.items);
    return box;
  }

  override validateStructure(finalTopology: ShapeTopology): void {
    this.requireRequiredParts(finalTopology.childrenOf(this));
  }

  override movementSummary(dx: number, dy: number, returning = false): string {
    return `moved${returning ? ' back' : ''} by (${dx},${dy})`;
  }

  override validateMove(dx: number, dy: number): void {
    super.validateMove(dx, dy);
    for (const shape of this.descendants) shape.validateMove(dx, dy);
  }

  override move(dx: number, dy: number): void {
    this.validateMove(dx, dy);
    for (const shape of this.descendants) shape.move(dx, dy);
  }

  override validateScale(factor: number): void {
    super.validateScale(factor);
    for (const shape of this.descendants) shape.validateScale(factor);
  }

  override scale(factor: number): void {
    this.validateScale(factor);
    for (const shape of this.descendants) shape.scale(factor);
  }

  private requireRequiredParts(children: readonly Shape[]): void {
    const rect = children.find(child => child.id === `${this.id}-rect`);
    if (!rect || rect.kind !== 'rect') throw new Error(`box ${this.id} is missing required part: ${this.id}-rect`);
    const label = children.find(child => child.id === `${this.id}-label`);
    if (!label || label.kind !== 'text') throw new Error(`box ${this.id} is missing required part: ${this.id}-label`);
  }
}
