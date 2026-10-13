import { ShapeStyle } from './ShapeStyle.js';
import type { ShapeContainer } from '../tree/ShapeContainer.js';
import type { SvgElement } from '../representation/SvgElement.js';
import type { ShapeDescription } from '../representation/ShapeDescription.js';
export abstract class Shape {
  readonly #id: string;
  #parent: ShapeContainer | undefined;
  readonly #style = new ShapeStyle();
  #geometry: Record<string, number>;
  constructor(id: string, geometry: Record<string, number>, private readonly nonnegative: readonly string[] = []) {
    if (!id || /\s/.test(id)) throw new Error('id must be nonempty and contain no whitespace');
    this.#id = id; this.#geometry = { ...geometry }; this.validateGeometry(geometry);
  }
  get id() { return this.#id; }
  get parent() { return this.#parent; }
  attachTo(parent: ShapeContainer | undefined) { this.#parent = parent; }
  abstract get tag(): string;
  get label() { return `${this.tag}#${this.id}`; }
  movementSummary(dx: number, dy: number, returning = false): string {
    return `moved${returning ? ' back' : ''} to (${this.#geometry[this.xKeys[0]!]},${this.#geometry[this.yKeys[0]!]})`;
  }
  attributeSummary(name: string, value: string | undefined): string { return `${name}=${value ?? '(default)'}`; }
  get descendants(): readonly Shape[] { return []; }
  protected abstract get xKeys(): readonly string[];
  protected abstract get yKeys(): readonly string[];
  protected get geometry(): Readonly<Record<string, number>> { return { ...this.#geometry }; }
  getAttribute(name: string): string | undefined {
    if (Object.hasOwn(this.#geometry, name)) return String(this.#geometry[name]);
    if (ShapeStyle.names.includes(name)) return this.#style.get(name);
    throw new Error(`unknown attribute: ${name}`);
  }
  setAttribute(name: string, value: string | undefined): void {
    if (Object.hasOwn(this.#geometry, name)) {
      if (value === undefined || !value.trim()) throw new Error(`${name} must be finite`);
      const next = { ...this.#geometry, [name]: Number(value) }; this.validateGeometry(next); this.#geometry = next;
    } else this.#style.set(name, value);
  }
  validateMove(dx: number, dy: number): void { this.moved(dx, dy); }
  move(dx: number, dy: number): void { this.#geometry = this.moved(dx, dy); }
  validateScale(factor: number): void { this.scaled(factor); }
  scale(factor: number): void { this.#geometry = this.scaled(factor); }
  private moved(dx: number, dy: number) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error('move deltas must be finite');
    const result = { ...this.#geometry };
    for (const key of this.xKeys) result[key] = result[key]! + dx;
    for (const key of this.yKeys) result[key] = result[key]! + dy;
    this.validateGeometry(result); return result;
  }
  private scaled(factor: number) {
    if (!Number.isFinite(factor) || factor <= 0) throw new Error('scale factor must be positive and finite');
    const result = Object.fromEntries(Object.entries(this.#geometry).map(([key, value]) => [key, value * factor]));
    this.validateGeometry(result); return result;
  }
  private validateGeometry(geometry: Record<string, number>) {
    for (const [key, value] of Object.entries(geometry)) {
      if (!Number.isFinite(value)) throw new Error(`${key} must be finite`);
      if (this.nonnegative.includes(key) && value < 0) throw new Error(`${key} must be non-negative`);
    }
  }
  protected get geometryDescription(): string { return Object.entries(this.#geometry).map(([k, v]) => `${k}=${v}`).join(' '); }
  describe(): ShapeDescription {
    return Object.freeze({ heading: this.label, geometry: this.geometryDescription,
      style: Object.entries(this.#style.attributes).map(([k, v]) => `${k}=${v}`).join(' ') });
  }
  toSvgElement(): SvgElement {
    return Object.freeze({ tag: this.tag, attributes: Object.freeze({ id: this.id,
      ...Object.fromEntries(Object.entries(this.#geometry).map(([k, v]) => [k, String(v)])), ...this.#style.attributes }),
      children: Object.freeze(this.descendants.map(shape => shape.toSvgElement())) });
  }
}

