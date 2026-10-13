import { ChildCollection } from './ChildCollection.js';
import type { ShapeContainer } from './ShapeContainer.js';
export class CanvasRoot implements ShapeContainer {
  #width: number; #height: number;
  readonly #children = new ChildCollection(this);
  constructor(width: number, height: number) { this.validateSize(width, height); this.#width = width; this.#height = height; }
  get children() { return this.#children; }
  get label() { return 'svg'; }
  get size() { return Object.freeze({ width: this.#width, height: this.#height }); }
  resize(width: number, height: number) { this.validateSize(width, height); this.#width = width; this.#height = height; }
  private validateSize(width: number, height: number) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('canvas dimensions must be finite and positive');
  }
}

