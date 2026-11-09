import { ShapeTree } from '../../domain/tree/ShapeTree.js';
import { ShapeProvider } from '../../domain/shapes/ShapeProvider.js';
import type { Shape } from '../../domain/shapes/Shape.js';
import type { ShapeContainer } from '../../domain/tree/ShapeContainer.js';
import type { ShapePlacement } from '../../domain/tree/TreeStructureParameters.js';
import type { MoveParameters } from '../contracts/MoveParameters.js';
import type { ScaleParameters } from '../contracts/ScaleParameters.js';
import type { AttributeEditParameters, AttributeEditRequest } from '../contracts/AttributeEditParameters.js';
import type { StructureEditParameters } from '../contracts/StructureEditParameters.js';
import type { CommandResult } from '../contracts/CommandResult.js';
import type { ShapeProviderRegistry } from '../registries/ShapeProviderRegistry.js';
import type { AttributeService } from '../attributes/AttributeService.js';
import { MoveEditRecord } from '../records/MoveEditRecord.js';
import { ScaleEditRecord } from '../records/ScaleEditRecord.js';
import { AttributeEditRecord } from '../records/AttributeEditRecord.js';
import { StructureEditRecord } from '../records/StructureEditRecord.js';
import type { EditOutcome } from './EditOutcome.js';

export class ShapeEditorReceiver {
  constructor(
    private readonly tree: ShapeTree,
    private readonly shapes: ShapeProviderRegistry,
    private readonly attributes: AttributeService,
  ) {}
  move(parameters: MoveParameters): EditOutcome<MoveEditRecord> {
    const shape = this.tree.findShape(parameters.id);
    const record = new MoveEditRecord({ ...parameters }, { id: parameters.id, dx: -parameters.dx, dy: -parameters.dy, returning: !parameters.returning });
    shape.move(parameters.dx, parameters.dy);
    return { record, result: { lines: [`${shape.label} ${shape.movementSummary(parameters.dx, parameters.dy, parameters.returning)}`] } };
  }
  scale(parameters: ScaleParameters): EditOutcome<ScaleEditRecord> {
    const shape = this.tree.findShape(parameters.id);
    if (parameters.factor <= 0) throw new Error('scale factor must be positive');
    if (!Number.isFinite(1 / parameters.factor)) throw new Error('scale inverse must be finite');
    const record = new ScaleEditRecord({ ...parameters }, { id: parameters.id, factor: 1 / parameters.factor });
    shape.scale(parameters.factor);
    return { record, result: { lines: [`${shape.label} scaled by ${parameters.factor}`] } };
  }
  setAttribute(request: AttributeEditRequest): EditOutcome<AttributeEditRecord>;
  setAttribute(patch: AttributeEditParameters): CommandResult;
  setAttribute(parameters: AttributeEditRequest | AttributeEditParameters): EditOutcome<AttributeEditRecord> | CommandResult {
    if ('writes' in parameters) return this.replayAttributePatch(parameters);
    return this.attributes.setAttribute(parameters);
  }
  editStructure(parameters: StructureEditParameters): CommandResult {
    this.tree.editStructure({ placements: parameters.placements }); return { lines: [parameters.message] };
  }
  create(type: string, id: string, args: readonly string[], parentId?: string, quoted?: readonly boolean[]): EditOutcome<StructureEditRecord> {
    const parent = this.tree.getContainer(parentId); this.requireAvailableId(id);
    const shape = this.shapes.createFromArguments(type, id, args, quoted);
    const created = this.createMessage(shape);
    return this.applyPlan([{ shape, parent, index: parent.children.items.length }],
      `${created}${parentId ? ' in ' + parent.label : ''}`, `${shape.label} deleted`);
  }
  delete(id: string): EditOutcome<StructureEditRecord> {
    const shape = this.tree.findShape(id);
    return this.applyPlan([{ shape, index: 0 }], `${shape.label} deleted`, `${shape.label} restored into ${shape.parent!.label}`);
  }
  group(id: string, ids: readonly string[]): EditOutcome<StructureEditRecord> {
    this.tree.requireInitialized(); this.requireAvailableId(id);
    if (!ids.length) throw new Error('group requires at least one shape');
    if (new Set(ids).size !== ids.length) throw new Error('duplicate group member');
    const shapes = ids.map(member => this.tree.findShape(member));
    for (const shape of shapes) {
      for (const other of shapes) if (shape !== other && this.isAncestor(shape, other))
        throw new Error(`cannot group a container into its own descendant: ${shape.id}`);
    }
    const first = shapes[0]!; const parent = first.parent!;
    const ordered = this.tree.shapes.filter(shape => shapes.includes(shape));
    const remaining = parent.children.items.filter(shape => !shapes.includes(shape));
    const originalIndex = parent.children.items.indexOf(first);
    const index = remaining.filter(shape => parent.children.items.indexOf(shape) < originalIndex).length;
    const group = this.shapes.createFromArguments('g', id, []);
    const container = group.asContainer();
    if (!container) throw new Error(`shape type g is not a container: ${id}`);
    return this.applyPlan([{ shape: group, parent, index }, ...ordered.map((shape, index) => ({ shape, parent: container, index }))],
      `${group.label} created with ${shapes.length} children`, `${group.label} grouping undone`);
  }
  ungroup(id: string): EditOutcome<StructureEditRecord> {
    const group = this.tree.findShape(id);
    const container = group instanceof ShapeProvider ? group.asContainer() : undefined;
    if (!container) throw new Error(`not a container: ${id}`);
    if (group instanceof ShapeProvider && !group.canUngroup()) throw new Error(`cannot ungroup composite shape: ${id}`);
    const parent = group.parent!;
    if (parent === this.tree.root) throw new Error(`cannot ungroup top-level container: ${id}`);
    const start = parent.children.items.indexOf(group);
    return this.applyPlan([{ shape: group, index: 0 }, ...container.children.items.map((shape, index) => ({ shape, parent, index: start + index }))],
      `${group.label} ungrouped`, `${group.label} restored`);
  }
  addTo(groupId: string, id: string): EditOutcome<StructureEditRecord> {
    const parent = this.tree.getContainer(groupId); const shape = this.tree.findShape(id);
    if ((parent instanceof ShapeProvider && shape === parent) || (parent instanceof ShapeProvider && this.isAncestor(shape, parent))) {
      throw new Error('cannot move a container into its own descendant');
    }
    const index = parent.children.items.filter(child => child !== shape).length;
    return this.applyPlan([{ shape, parent, index }], `${shape.label} added to ${parent.label}`, `${shape.label} restored into ${shape.parent!.label}`);
  }
  front(id: string) { return this.reorder(id, true); }
  back(id: string) { return this.reorder(id, false); }
  private reorder(id: string, front: boolean): EditOutcome<StructureEditRecord> {
    const shape = this.tree.findShape(id); const parent = shape.parent!;
    return this.applyPlan([{ shape, parent, index: front ? parent.children.items.length - 1 : 0 }],
      `${shape.label} moved to ${front ? 'front' : 'back'}`, `${shape.label} order restored`);
  }
  private createMessage(shape: Shape): string {
    const children = shape.descendants;
    if (!children.length) return `${shape.label} created`;
    return `${shape.label} created (${[shape.describe().heading, ...children.map(child => child.label)].join(' + ')})`;
  }
  private replayAttributePatch(patch: AttributeEditParameters): CommandResult {
    const applied: { shape: Shape; name: string; before: string | undefined }[] = [];
    try {
      for (const write of patch.writes) {
        const shape = this.tree.findShape(write.shapeId);
        const before = shape.getAttribute(write.name);
        shape.setAttribute(write.name, write.value);
        applied.push({ shape, name: write.name, before });
      }
      return { lines: [...patch.lines] };
    } catch (error) {
      for (const write of applied.reverse()) {
        try {
          write.shape.setAttribute(write.name, write.before);
        } catch {
          // Keep restoring the remaining writes; the original failure wins.
        }
      }
      throw error;
    }
  }
  private requireAvailableId(id: string) {
    if (this.tree.shapes.some(shape => shape.id === id)) throw new Error(`id already exists: ${id}`);
  }
  private isAncestor(ancestor: Shape, shape: Shape) {
    let container: ShapeContainer | undefined = shape.parent;
    while (container) {
      if (container instanceof ShapeProvider && container === ancestor) return true;
      container = container instanceof ShapeProvider ? container.parent : undefined;
    }
    return false;
  }
  private applyPlan(placements: readonly ShapePlacement[], message: string, inverseMessage: string): EditOutcome<StructureEditRecord> {
    const inverse = placements.map(({ shape }) => Object.freeze({ shape, parent: shape.parent, index: shape.parent?.children.items.indexOf(shape) ?? 0 }));
    const record = new StructureEditRecord(
      { placements: Object.freeze(placements.map(p => Object.freeze({ ...p }))), message },
      { placements: Object.freeze(inverse), message: inverseMessage });
    const result = this.editStructure(record.forward); return { record, result };
  }
}
