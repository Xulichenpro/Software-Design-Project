import { ShapeProvider } from './ShapeProvider.js';
import { numericArgument, requireArgumentCount, finishLeafReadback } from './ShapeSvgReadback.js';
import type { ShapeCreationContext } from './ShapeCreationContext.js';
import type { SvgElement } from '../representation/SvgElement.js';

export class RectShape extends ShapeProvider {
  static readonly type = 'rect';
  constructor(id: string, x: number, y: number, width: number, height: number) {
    super(id, { x, y, width, height }, ['width', 'height']);
  }
  get tag() { return 'rect'; }
  static createFromArguments(
    id: string, args: readonly string[], _quoted: readonly boolean[] | undefined, _context: ShapeCreationContext,
  ): RectShape {
    const shape = new RectShape(id, numericArgument(args, 0), numericArgument(args, 1), numericArgument(args, 2), numericArgument(args, 3));
    requireArgumentCount('rect', args, 4, 5);
    const fill = args[4];
    if (fill !== undefined) shape.setAttribute('fill', fill);
    return shape;
  }
  static createFromSvgElement(element: SvgElement, _context: ShapeCreationContext): RectShape {
    return finishLeafReadback(new RectShape(element.attributes.id ?? '', 0, 0, 0, 0), element);
  }
  protected get xKeys() { return ['x']; }
  protected get yKeys() { return ['y']; }
  protected override get geometryDescription() {
    return `x=${this.geometry.x} y=${this.geometry.y} w=${this.geometry.width} h=${this.geometry.height}`;
  }
}
