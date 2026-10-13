import type { ShapeTree } from '../../domain/tree/ShapeTree.js';
export interface SvgImportResult { readonly tree: ShapeTree; readonly warnings: readonly string[]; }

