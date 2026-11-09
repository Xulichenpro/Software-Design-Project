import type { ShapeTree } from '../../domain/tree/ShapeTree.js';
import type { Shape } from '../../domain/shapes/Shape.js';
import { AttributeEditRecord } from '../records/AttributeEditRecord.js';
import { EditorError } from '../contracts/EditorError.js';
import type { AttributeEditRequest, AttributePatch, AttributeWrite } from '../contracts/AttributeEditParameters.js';
import type { EditOutcome } from '../receivers/EditOutcome.js';
import type { AttributeHandlerRegistry } from '../registries/AttributeHandlerRegistry.js';
import type { AttributeHandler } from './AttributeHandler.js';
import type { AttributeOutcome } from './AttributeOutcome.js';
import type { AttributeTransaction } from './AttributeTransaction.js';
import type { ReadonlyShape } from './ReadonlyShape.js';

const numericAttributes: readonly string[] = [
  'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'stroke-width',
];
const nonnegativeAttributes: readonly string[] = ['width', 'height', 'r', 'rx', 'ry', 'stroke-width'];

interface RecordedWrite {
  readonly shapeId: string;
  readonly name: string;
  readonly before: string | undefined;
  readonly value: string | undefined;
}

export class AttributeService {
  constructor(
    private readonly tree: ShapeTree,
    private readonly handlers: AttributeHandlerRegistry,
  ) {}

  setAttribute(request: AttributeEditRequest): EditOutcome<AttributeEditRecord> {
    const target = this.tree.findShape(request.id);
    const readonlyTarget: ReadonlyShape = target;
    const matching: AttributeHandler[] = [];
    for (const handler of this.handlers.values()) {
      if (handler.handles(readonlyTarget, request.name)) matching.push(handler);
    }
    if (matching.length > 1) {
      throw new EditorError(`attribute handler conflict: ${request.name} on ${request.id}`);
    }
    if (matching.length === 1) return this.applyHandler(matching[0]!, readonlyTarget, request);
    return this.applyDefault(target, request);
  }

  private applyDefault(target: Shape, request: AttributeEditRequest): EditOutcome<AttributeEditRecord> {
    if (request.name === 'text' && !request.quoted) throw new EditorError('text content must be quoted');
    this.validateDefaultValue(request.name, request.value);
    const before = target.getAttribute(request.name);
    target.setAttribute(request.name, request.value);
    const forward = freezePatch(
      [{ shapeId: target.id, name: request.name, value: request.value }],
      [`${target.label} updated: ${target.attributeSummary(request.name, request.value)}`],
    );
    const inverse = freezePatch(
      [{ shapeId: target.id, name: request.name, value: before }],
      [`${target.label} updated: ${target.attributeSummary(request.name, before)}`],
    );
    return { record: new AttributeEditRecord(forward, inverse), result: { lines: forward.lines } };
  }

  private applyHandler(
    handler: AttributeHandler,
    target: ReadonlyShape,
    request: AttributeEditRequest,
  ): EditOutcome<AttributeEditRecord> {
    const writes: RecordedWrite[] = [];
    const transaction: AttributeTransaction = {
      setAttribute: (shapeId, name, value) => {
        const shape = this.tree.findShape(shapeId);
        const before = shape.getAttribute(name);
        shape.setAttribute(name, value);
        writes.push({ shapeId, name, before, value });
      },
    };
    let outcome: AttributeOutcome;
    try {
      outcome = handler.apply(target, request, transaction);
    } catch (error) {
      this.rollback(writes);
      throw error;
    }
    const forward = freezePatch(
      writes.map(write => ({ shapeId: write.shapeId, name: write.name, value: write.value })),
      outcome.forwardLines,
    );
    const inverse = freezePatch(
      [...writes].reverse().map(write => ({ shapeId: write.shapeId, name: write.name, value: write.before })),
      outcome.inverseLines,
    );
    return { record: new AttributeEditRecord(forward, inverse), result: { lines: forward.lines } };
  }

  private rollback(writes: readonly RecordedWrite[]): void {
    for (const write of [...writes].reverse()) {
      try {
        this.tree.findShape(write.shapeId).setAttribute(write.name, write.before);
      } catch {
        // Keep rolling back the remaining writes; the original failure wins.
      }
    }
  }

  private validateDefaultValue(name: string, value: string): void {
    if (!numericAttributes.includes(name)) return;
    const number = Number(value);
    if (!value.trim() || !Number.isFinite(number)) throw new EditorError(`${name} must be finite`);
    if (nonnegativeAttributes.includes(name) && number < 0) throw new EditorError(`${name} must be non-negative`);
  }
}

function freezePatch(writes: readonly AttributeWrite[], lines: readonly string[]): AttributePatch {
  return Object.freeze({
    writes: Object.freeze(writes.map(write => Object.freeze({ ...write }))),
    lines: Object.freeze([...lines]),
  });
}
