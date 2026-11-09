import { ShapeProvider } from './ShapeProvider.js';
import { numericArgument, requireArgumentCount, finishLeafReadback } from './ShapeSvgReadback.js';
import type { ShapeCreationContext } from './ShapeCreationContext.js';
import type { SvgElement } from '../representation/SvgElement.js';

export class LineShape extends ShapeProvider {
  static readonly type = 'line';
  constructor(id: string, x1: number, y1: number, x2: number, y2: number) {
    super(id, { x1, y1, x2, y2 }, []);
  }
  get tag() { return 'line'; }
  static createFromArguments(
    id: string, args: readonly string[], _quoted: readonly boolean[] | undefined, _context: ShapeCreationContext,
  ): LineShape {
    const shape = new LineShape(id, numericArgument(args, 0), numericArgument(args, 1), numericArgument(args, 2), numericArgument(args, 3));
    requireArgumentCount('line', args, 4, 5);
    const stroke = args[4];
    if (stroke !== undefined) shape.setAttribute('stroke', stroke);
    return shape;
  }
  static createFromSvgElement(element: SvgElement, _context: ShapeCreationContext): LineShape {
    return finishLeafReadback(new LineShape(element.attributes.id ?? '', 0, 0, 0, 0), element);
  }
  protected get xKeys() { return ['x1', 'x2']; }
  protected get yKeys() { return ['y1', 'y2']; }
  protected override get geometryDescription() {
    return `(${this.geometry.x1},${this.geometry.y1}) -> (${this.geometry.x2},${this.geometry.y2})`;
  }
}
