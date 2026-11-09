import { Shape } from './Shape.js';
import type { ShapeContainer } from '../tree/ShapeContainer.js';
import type { ShapeTopology } from '../tree/ShapeTopology.js';
import type { SvgElement } from '../representation/SvgElement.js';

/**
 * A shape supplied by the kernel or by a plugin. Kernel code only depends on
 * this abstraction; concrete classes are registered as class objects.
 */
export abstract class ShapeProvider extends Shape {
  asContainer(): ShapeContainer | undefined { return undefined; }
  canUngroup(): boolean { return true; }
  validateStructure(_finalTopology: ShapeTopology): void {}
  override toSvgElement(): SvgElement {
    const element = super.toSvgElement();
    if (this.kind === this.tag) return element;
    return Object.freeze({
      ...element,
      attributes: Object.freeze({ ...element.attributes, 'data-kind': this.kind }),
    });
  }
}
