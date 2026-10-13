import { Shape } from '../shapes/Shape.js';
import { RectShape } from '../shapes/RectShape.js';
import { CircleShape } from '../shapes/CircleShape.js';
import { EllipseShape } from '../shapes/EllipseShape.js';
import { LineShape } from '../shapes/LineShape.js';
import { TextShape } from '../shapes/TextShape.js';
import { GroupShape } from '../shapes/GroupShape.js';
import { ShapeStyle } from '../shapes/ShapeStyle.js';
import type { SvgElement } from '../representation/SvgElement.js';
export class ShapeFactory {
  // Name dispatch is the documented extension point for future shape providers.
  createFromArguments(type: string, id: string, args: readonly string[]): Shape {
    const numeric = (index: number) => {
      const value = args[index]; if (value === undefined || !value.trim() || !Number.isFinite(Number(value))) throw new Error('geometry must be finite');
      return Number(value);
    };
    let shape: Shape; let min: number; let max: number; let style: string | undefined;
    switch (type) {
      case 'rect': min = 4; max = 5; shape = new RectShape(id, numeric(0), numeric(1), numeric(2), numeric(3)); style = 'fill'; break;
      case 'circle': min = 3; max = 4; shape = new CircleShape(id, numeric(0), numeric(1), numeric(2)); style = 'fill'; break;
      case 'ellipse': min = 4; max = 5; shape = new EllipseShape(id, numeric(0), numeric(1), numeric(2), numeric(3)); style = 'fill'; break;
      case 'line': min = 4; max = 5; shape = new LineShape(id, numeric(0), numeric(1), numeric(2), numeric(3)); style = 'stroke'; break;
      case 'text': min = 3; max = 3; shape = new TextShape(id, numeric(0), numeric(1), args[2] ?? ''); break;
      case 'g': min = 0; max = 0; shape = new GroupShape(id); break;
      default: throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    }
    if (args.length < min || args.length > max) throw new Error(`invalid parameters for ${type}`);
    if (style && args[min] !== undefined) shape.setAttribute(style, args[min]);
    return shape;
  }
  createFromSvgElement(element: SvgElement): Shape {
    const { tag, attributes: a } = element;
    const defaults: Record<string, readonly string[]> = { rect: ['0','0','0','0'], circle: ['0','0','0'],
      ellipse: ['0','0','0','0'], line: ['0','0','0','0'], text: ['0','0',element.text ?? ''], g: [] };
    if (!Object.hasOwn(defaults, tag)) throw new Error(`unknown shape type: ${tag} (is the plugin loaded?)`);
    const shape = this.createFromArguments(tag, a.id ?? '', defaults[tag]!);
    const allowed = new Set([...Object.keys(shape.toSvgElement().attributes), ...ShapeStyle.names]);
    for (const [name, value] of Object.entries(a)) {
      if (!allowed.has(name)) throw new Error(`unknown attribute: ${name}`);
      if (name !== 'id') shape.setAttribute(name, value);
    }
    if (shape instanceof GroupShape) {
      if (element.text?.trim()) throw new Error('unexpected text in container');
      for (const child of element.children) shape.children.insert(this.createFromSvgElement(child), shape.children.items.length);
    } else if (element.children.length) throw new Error('leaf shape cannot contain elements');
    else if (!(shape instanceof TextShape) && element.text?.trim()) throw new Error('unexpected text in leaf shape');
    return shape;
  }
}

