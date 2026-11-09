import { ShapeProvider } from './ShapeProvider.js';
import { numericArgument, requireArgumentCount, finishTextReadback } from './ShapeSvgReadback.js';
import type { ShapeCreationContext } from './ShapeCreationContext.js';
import type { SvgElement } from '../representation/SvgElement.js';

export class TextShape extends ShapeProvider {
  static readonly type = 'text';
  #text: string;
  constructor(id: string, x: number, y: number, text: string) { super(id, { x, y }); this.#text = text; }
  get tag() { return 'text'; }
  static createFromArguments(
    id: string, args: readonly string[], quoted: readonly boolean[] | undefined, _context: ShapeCreationContext,
  ): TextShape {
    if (quoted && !quoted[2]) throw new Error('text content must be quoted');
    const shape = new TextShape(id, numericArgument(args, 0), numericArgument(args, 1), args[2] ?? '');
    requireArgumentCount('text', args, 3, 3);
    return shape;
  }
  static createFromSvgElement(element: SvgElement, _context: ShapeCreationContext): TextShape {
    return finishTextReadback(new TextShape(element.attributes.id ?? '', 0, 0, element.text ?? ''), element);
  }
  protected get xKeys() { return ['x']; }
  protected get yKeys() { return ['y']; }
  override getAttribute(name: string) { return name === 'text' ? this.#text : super.getAttribute(name); }
  override attributeSummary(name: string, value: string | undefined) {
    return name === 'text' ? `text=${JSON.stringify(value)}` : super.attributeSummary(name, value);
  }
  override setAttribute(name: string, value: string | undefined) {
    if (name === 'text') { if (value === undefined) throw new Error('text must be provided'); this.#text = value; }
    else super.setAttribute(name, value);
  }
  protected override get geometryDescription() { return `(${this.geometry.x},${this.geometry.y}) "${this.#text}"`; }
  override toSvgElement() { return Object.freeze({ ...super.toSvgElement(), text: this.#text }); }
}
