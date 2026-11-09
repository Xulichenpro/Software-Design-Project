import type { ShapeProvider } from './ShapeProvider.js';
import type { ShapeCreationContext } from './ShapeCreationContext.js';
import type { SvgElement } from '../representation/SvgElement.js';

/**
 * Static side of a concrete shape class. The registry stores class objects
 * themselves, not provider instances.
 */
export interface ShapeRegistration {
  readonly type: string;
  readonly prototype: ShapeProvider;
  createFromArguments(
    id: string,
    args: readonly string[],
    quoted: readonly boolean[] | undefined,
    context: ShapeCreationContext,
  ): ShapeProvider;
  createFromSvgElement(element: SvgElement, context: ShapeCreationContext): ShapeProvider;
}
