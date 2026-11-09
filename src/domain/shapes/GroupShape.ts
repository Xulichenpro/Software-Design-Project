import { ShapeProvider } from './ShapeProvider.js';
import { requireArgumentCount, finishGroupReadback } from './ShapeSvgReadback.js';
import { ChildCollection } from '../tree/ChildCollection.js';
import type { ShapeContainer } from '../tree/ShapeContainer.js';
import type { ShapeCreationContext } from './ShapeCreationContext.js';
import type { SvgElement } from '../representation/SvgElement.js';

export class GroupShape extends ShapeProvider implements ShapeContainer {
  static readonly type = 'g';
  readonly #children: ChildCollection = new ChildCollection(this);
  constructor(id: string) { super(id, {}); }
  get tag() { return 'g'; }
  get children(): ChildCollection { return this.#children; }
  override asContainer(): ShapeContainer { return this; }
  static createFromArguments(
    id: string, args: readonly string[], _quoted: readonly boolean[] | undefined, _context: ShapeCreationContext,
  ): GroupShape {
    requireArgumentCount('g', args, 0, 0);
    return new GroupShape(id);
  }
  static createFromSvgElement(element: SvgElement, context: ShapeCreationContext): GroupShape {
    return finishGroupReadback(new GroupShape(element.attributes.id ?? ''), element, context);
  }
  protected get xKeys() { return []; }
  protected get yKeys() { return []; }
  override get descendants() { return this.#children.items; }
  override movementSummary(dx: number, dy: number, returning = false) { return `moved${returning ? ' back' : ''} by (${dx},${dy})`; }
  override validateMove(dx: number, dy: number) { super.validateMove(dx, dy); for (const shape of this.descendants) shape.validateMove(dx, dy); }
  override move(dx: number, dy: number) { this.validateMove(dx, dy); for (const shape of this.descendants) shape.move(dx, dy); }
  override validateScale(factor: number) { super.validateScale(factor); for (const shape of this.descendants) shape.validateScale(factor); }
  override scale(factor: number) { this.validateScale(factor); for (const shape of this.descendants) shape.scale(factor); }
}
