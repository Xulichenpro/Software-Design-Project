import type { Shape } from '../../domain/shapes/Shape.js';
import type { ShapeContainer } from '../../domain/tree/ShapeContainer.js';

/** Read-only document surface shared by commands and tree decorators. */
export interface DocumentView {
  requireInitialized(): void;
  readonly root: ShapeContainer;
  findShape(id: string): Shape;
}
