import type { ShapeTree } from '../../domain/tree/ShapeTree.js';
import type { SvgImportResult } from './SvgImportResult.js';
export interface SvgCodec { decode(text: string): SvgImportResult; encode(tree: ShapeTree): string; }
