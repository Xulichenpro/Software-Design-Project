import type { Shape } from '../shapes/Shape.js';
import type { ShapeContainer } from './ShapeContainer.js';

/**
 * Immutable view of the document structure computed by `ShapeTree` before a
 * structural edit is committed. Providers validate the final layout here.
 */
export interface ShapeTopology {
  parentOf(shape: Shape): ShapeContainer | undefined;
  childrenOf(container: ShapeContainer): readonly Shape[];
  contains(shape: Shape): boolean;
}
