import type { ShapeProvider } from '../../domain/shapes/ShapeProvider.js';
import type { ShapeRegistration } from '../../domain/shapes/ShapeRegistration.js';
import type { ShapeCreationContext } from '../../domain/shapes/ShapeCreationContext.js';
import type { SvgElement } from '../../domain/representation/SvgElement.js';

export class ShapeProviderRegistry implements ShapeCreationContext {
  #entries: ReadonlyMap<string, ShapeRegistration> | undefined;

  install(
    builtin: ReadonlyMap<string, ShapeRegistration>,
    plugin: ReadonlyMap<string, ShapeRegistration>,
  ): void {
    if (this.#entries) throw new Error('shape provider registry is already installed');
    const merged = new Map<string, ShapeRegistration>();
    for (const [type, registration] of [...builtin, ...plugin]) {
      if (merged.has(type)) throw new Error(`duplicate shape registration: ${type}`);
      merged.set(type, registration);
    }
    this.#entries = merged;
  }

  get(type: string): ShapeRegistration {
    const registration = this.#entries?.get(type);
    if (!registration) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    return registration;
  }

  values(): readonly ShapeRegistration[] {
    return [...this.requireEntries().values()];
  }

  createFromArguments(
    type: string,
    id: string,
    args: readonly string[],
    quoted?: readonly boolean[],
  ): ShapeProvider {
    return this.get(type).createFromArguments(id, args, quoted, this);
  }

  createFromSvgElement(element: SvgElement): ShapeProvider {
    const entries = this.requireEntries();
    const hinted = element.attributes['data-kind'];
    const registration = (hinted !== undefined ? entries.get(hinted) : undefined) ?? entries.get(element.tag);
    if (!registration) throw new Error(`unknown shape type: ${element.tag} (is the plugin loaded?)`);
    return registration.createFromSvgElement(this.withoutDataKind(element), this);
  }

  private withoutDataKind(element: SvgElement): SvgElement {
    if (!('data-kind' in element.attributes)) return element;
    const attributes = { ...element.attributes };
    delete attributes['data-kind'];
    return Object.freeze({ ...element, attributes: Object.freeze(attributes) });
  }

  private requireEntries(): ReadonlyMap<string, ShapeRegistration> {
    if (!this.#entries) throw new Error('shape provider registry is not installed');
    return this.#entries;
  }
}
