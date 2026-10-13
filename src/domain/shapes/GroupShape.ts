import { Shape } from './Shape.js';
import { ChildCollection } from '../tree/ChildCollection.js';
import type { ShapeContainer } from '../tree/ShapeContainer.js';
export class GroupShape extends Shape implements ShapeContainer {
  readonly #children = new ChildCollection(this);
  constructor(id: string) { super(id, {}); }
  get tag() { return 'g'; }
  get children() { return this.#children; }
  protected get xKeys() { return []; }
  protected get yKeys() { return []; }
  override get descendants() { return this.#children.items; }
  override movementSummary(dx: number, dy: number, returning = false) { return `moved${returning ? ' back' : ''} by (${dx},${dy})`; }
  override validateMove(dx: number, dy: number) { super.validateMove(dx, dy); for (const shape of this.descendants) shape.validateMove(dx, dy); }
  override move(dx: number, dy: number) { this.validateMove(dx, dy); for (const shape of this.descendants) shape.move(dx, dy); }
  override validateScale(factor: number) { super.validateScale(factor); for (const shape of this.descendants) shape.validateScale(factor); }
  override scale(factor: number) { this.validateScale(factor); for (const shape of this.descendants) shape.scale(factor); }
}
