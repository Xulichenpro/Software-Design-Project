import { Shape } from './Shape.js';
export class TextShape extends Shape {
  #text: string;
  constructor(id: string, x: number, y: number, text: string) { super(id, { x, y }); this.#text = text; }
  get tag() { return 'text'; }
  protected get xKeys() { return ['x']; }
  protected get yKeys() { return ['y']; }
  override getAttribute(name: string) { return name === 'text' ? this.#text : super.getAttribute(name); }
  override attributeSummary(name: string, value: string | undefined) { return name === 'text' ? `text=${JSON.stringify(value)}` : super.attributeSummary(name, value); }
  override setAttribute(name: string, value: string | undefined) {
    if (name === 'text') { if (value === undefined) throw new Error('text must be provided'); this.#text = value; }
    else super.setAttribute(name, value);
  }
  protected override get geometryDescription() { return `(${this.geometry.x},${this.geometry.y}) "${this.#text}"`; }
  override toSvgElement() { return Object.freeze({ ...super.toSvgElement(), text: this.#text }); }
}

