import { ShapeProvider } from './ShapeProvider.js';
import { numericArgument, requireArgumentCount, finishLeafReadback } from './ShapeSvgReadback.js';
import type { ShapeCreationContext } from './ShapeCreationContext.js';
import type { SvgElement } from '../representation/SvgElement.js';

export class EllipseShape extends ShapeProvider {
  static readonly type = 'ellipse';
  constructor(id: string, cx: number, cy: number, rx: number, ry: number) {
    super(id, { cx, cy, rx, ry }, ['rx', 'ry']);
  }
  get tag() { return 'ellipse'; }
  static createFromArguments(
    id: string, args: readonly string[], _quoted: readonly boolean[] | undefined, _context: ShapeCreationContext,
  ): EllipseShape {
    const shape = new EllipseShape(id, numericArgument(args, 0), numericArgument(args, 1), numericArgument(args, 2), numericArgument(args, 3));
    requireArgumentCount('ellipse', args, 4, 5);
    const fill = args[4];
    if (fill !== undefined) shape.setAttribute('fill', fill);
    return shape;
  }
  static createFromSvgElement(element: SvgElement, _context: ShapeCreationContext): EllipseShape {
    return finishLeafReadback(new EllipseShape(element.attributes.id ?? '', 0, 0, 0, 0), element);
  }
  protected get xKeys() { return ['cx']; }
  protected get yKeys() { return ['cy']; }
}
