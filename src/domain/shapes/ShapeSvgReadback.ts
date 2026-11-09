import { ShapeStyle } from './ShapeStyle.js';
import type { ShapeProvider } from './ShapeProvider.js';
import type { ShapeContainer } from '../tree/ShapeContainer.js';
import type { ShapeCreationContext } from './ShapeCreationContext.js';
import type { SvgElement } from '../representation/SvgElement.js';

/** Phase 1 numeric argument rule, shared by every built-in provider. */
export function numericArgument(args: readonly string[], index: number): number {
  const value = args[index];
  if (value === undefined || !value.trim() || !Number.isFinite(Number(value))) {
    throw new Error('geometry must be finite');
  }
  return Number(value);
}

/** Phase 1 argument-count rule, shared by every built-in provider. */
export function requireArgumentCount(type: string, args: readonly string[], min: number, max: number): void {
  if (args.length < min || args.length > max) throw new Error(`invalid parameters for ${type}`);
}

/**
 * Applies the Phase 1 attribute whitelist and rejections shared by the
 * per-class `createFromSvgElement` implementations.
 */
export function applySvgAttributes(shape: ShapeProvider, element: SvgElement): void {
  const allowed = new Set([...Object.keys(shape.toSvgElement().attributes), ...ShapeStyle.names]);
  for (const [name, value] of Object.entries(element.attributes)) {
    if (!allowed.has(name)) throw new Error(`unknown attribute: ${name}`);
    if (name !== 'id') shape.setAttribute(name, value);
  }
}

export function finishLeafReadback<T extends ShapeProvider>(shape: T, element: SvgElement): T {
  applySvgAttributes(shape, element);
  if (element.children.length) throw new Error('leaf shape cannot contain elements');
  if (element.text?.trim()) throw new Error('unexpected text in leaf shape');
  return shape;
}

export function finishTextReadback<T extends ShapeProvider>(shape: T, element: SvgElement): T {
  applySvgAttributes(shape, element);
  if (element.children.length) throw new Error('leaf shape cannot contain elements');
  return shape;
}

export function finishGroupReadback<T extends ShapeProvider & ShapeContainer>(
  shape: T,
  element: SvgElement,
  context: ShapeCreationContext,
): T {
  applySvgAttributes(shape, element);
  if (element.text?.trim()) throw new Error('unexpected text in container');
  for (const child of element.children) {
    shape.children.insert(context.createFromSvgElement(child), shape.children.items.length);
  }
  return shape;
}
