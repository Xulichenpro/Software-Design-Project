import { AttributeHandler } from '../../../src/extension-api/index.js';
import type {
  AttributeEditRequest, AttributeOutcome, AttributeTransaction, ReadonlyShape,
} from '../../../src/extension-api/index.js';

/**
 * `set <box> fill|label` is composite semantics: writes go to the required
 * child parts, never to the box element itself. All writes use the shared
 * transaction so a failure can be rolled back as one unit.
 */
export class BoxAttributeHandler extends AttributeHandler {
  readonly name = 'box-attributes';

  handles(target: ReadonlyShape, attr: string): boolean {
    return target.kind === 'box' && (attr === 'fill' || attr === 'label');
  }

  apply(
    target: ReadonlyShape,
    request: AttributeEditRequest,
    transaction: AttributeTransaction,
  ): AttributeOutcome {
    const rect = target.descendants.find(
      child => child.id === `${target.id}-rect` && child.kind === 'rect',
    );
    if (!rect) throw new Error(`box ${target.id} is missing required part: ${target.id}-rect`);
    const label = target.descendants.find(
      child => child.id === `${target.id}-label` && child.kind === 'text',
    );
    if (!label) throw new Error(`box ${target.id} is missing required part: ${target.id}-label`);

    if (request.name === 'fill') {
      const before = rect.getAttribute('fill');
      transaction.setAttribute(rect.id, 'fill', request.value);
      return {
        forwardLines: [`${target.label} fill propagated to ${rect.id}`],
        inverseLines: [`${target.label} fill restored: ${before ?? '(default)'}`],
      };
    }
    if (request.name === 'label') {
      const before = label.getAttribute('text') ?? '';
      transaction.setAttribute(label.id, 'text', request.value);
      return {
        forwardLines: [`${target.label} label updated: ${JSON.stringify(request.value)}`],
        inverseLines: [`${target.label} label restored: ${JSON.stringify(before)}`],
      };
    }
    throw new Error(`unknown box attribute: ${request.name}`);
  }
}
