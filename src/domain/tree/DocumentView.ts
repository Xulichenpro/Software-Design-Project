import type { Shape } from '../shapes/Shape.js';
import type { ShapeContainer } from './ShapeContainer.js';

/** Read-only document surface shared by receivers, commands and decorators. */
export interface DocumentView {
  requireInitialized(): void;
  readonly root: ShapeContainer;
  findShape(id: string): Shape;
}
