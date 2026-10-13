import type { Shape } from '../shapes/Shape.js';
import type { ShapeContainer } from './ShapeContainer.js';
export class ChildCollection {
  #items: Shape[] = [];
  constructor(private readonly owner: ShapeContainer) {}
  get items(): readonly Shape[] { return [...this.#items]; }
  insert(shape: Shape, index: number): void {
    if (shape.parent || this.#items.includes(shape)) throw new Error('shape already has a parent');
    if (!Number.isInteger(index) || index < 0 || index > this.#items.length) throw new Error('invalid child index');
    this.#items.splice(index, 0, shape); shape.attachTo(this.owner);
  }
  remove(shape: Shape): void {
    const index = this.#items.indexOf(shape);
    if (index < 0) throw new Error('shape is not a child');
    this.#items.splice(index, 1); shape.attachTo(undefined);
  }
}

