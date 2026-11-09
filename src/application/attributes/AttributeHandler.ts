import type { AttributeOutcome } from './AttributeOutcome.js';
import type { AttributeTransaction } from './AttributeTransaction.js';
import type { ReadonlyShape } from './ReadonlyShape.js';
import type { AttributeEditRequest } from '../contracts/AttributeEditParameters.js';

/** Attribute semantics extension point. Selection happens in `AttributeService`. */
export abstract class AttributeHandler {
  abstract readonly name: string;
  abstract handles(target: ReadonlyShape, attr: string): boolean;
  abstract apply(
    target: ReadonlyShape,
    request: AttributeEditRequest,
    transaction: AttributeTransaction,
  ): AttributeOutcome;
}
