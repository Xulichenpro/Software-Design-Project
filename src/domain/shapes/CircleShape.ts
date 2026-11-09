import { ShapeProvider } from './ShapeProvider.js';
import { numericArgument, requireArgumentCount, finishLeafReadback } from './ShapeSvgReadback.js';
import type { ShapeCreationContext } from './ShapeCreationContext.js';
import type { SvgElement } from '../representation/SvgElement.js';

export class CircleShape extends ShapeProvider {
  static readonly type = 'circle';
  constructor(id: string, cx: number, cy: number, r: number) { super(id, { cx, cy, r }, ['r']); }
  get tag() { return 'circle'; }
  static createFromArguments(
    id: string, args: readonly string[], _quoted: readonly boolean[] | undefined, _context: ShapeCreationContext,
  ): CircleShape {
    const shape = new CircleShape(id, numericArgument(args, 0), numericArgument(args, 1), numericArgument(args, 2));
    requireArgumentCount('circle', args, 3, 4);
    const fill = args[3];
    if (fill !== undefined) shape.setAttribute('fill', fill);
    return shape;
  }
  static createFromSvgElement(element: SvgElement, _context: ShapeCreationContext): CircleShape {
    return finishLeafReadback(new CircleShape(element.attributes.id ?? '', 0, 0, 0), element);
  }
  protected get xKeys() { return ['cx']; }
  protected get yKeys() { return ['cy']; }
}
