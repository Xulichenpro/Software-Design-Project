import type { Shape } from '../shapes/Shape.js';
import type { ShapeContainer } from './ShapeContainer.js';
export interface ShapePlacement { readonly shape: Shape; readonly parent?: ShapeContainer; readonly index: number; }
export interface TreeStructureParameters { readonly placements: readonly ShapePlacement[]; }
