import type { ShapeProvider } from './ShapeProvider.js';
import type { SvgElement } from '../representation/SvgElement.js';

/**
 * Recursive creation surface passed to composite shape providers. Composites
 * create children without importing another plugin's implementation.
 */
export interface ShapeCreationContext {
  createFromArguments(
    type: string,
    id: string,
    args: readonly string[],
    quoted?: readonly boolean[],
  ): ShapeProvider;
  createFromSvgElement(element: SvgElement): ShapeProvider;
}
