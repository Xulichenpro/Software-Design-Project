import { CanvasRoot } from './CanvasRoot.js';
import { GroupShape } from '../shapes/GroupShape.js';
import type { Shape } from '../shapes/Shape.js';
import type { ShapeContainer } from './ShapeContainer.js';
import type { TreeStructureParameters } from './TreeStructureParameters.js';
export class ShapeTree {
  #root: CanvasRoot | undefined;
  #index = new Map<string, Shape>();
  requireInitialized() { if (!this.#root) throw new Error("no document. use 'init' or 'read' first"); }
  get root() { this.requireInitialized(); return this.#root!; }
  get canvasSize() { return this.root.size; }
  get shapes(): readonly Shape[] { return [...this.#index.values()]; }
  initialize(width = 800, height = 600) { const root = new CanvasRoot(width, height); this.#root = root; this.#index = new Map(); }
  resize(width: number, height: number) { this.root.resize(width, height); }
  findShape(id: string): Shape { this.requireInitialized(); const shape = this.#index.get(id); if (!shape) throw new Error(`no such shape: ${id}`); return shape; }
  getContainer(id?: string): ShapeContainer {
    if (id === undefined) return this.root;
    this.requireInitialized(); const shape = this.#index.get(id);
    if (!shape) throw new Error(`no such container: ${id}`);
    if (!(shape instanceof GroupShape)) throw new Error(`not a container: ${id}`); return shape;
  }
  replaceWith(tree: ShapeTree) { const root = tree.root; this.#root = root; this.#index = new Map(tree.#index); }
  editStructure(parameters: TreeStructureParameters): void {
    const root = this.root;
    const virtual = new Map<ShapeContainer, Shape[]>();
    const children = (container: ShapeContainer) => {
      let result = virtual.get(container); if (!result) { result = [...container.children.items]; virtual.set(container, result); } return result;
    };
    const changed = new Set<Shape>();
    for (const placement of parameters.placements) {
      if (changed.has(placement.shape)) throw new Error('duplicate shape in structure plan'); changed.add(placement.shape);
      if (placement.shape.parent) {
        const siblings = children(placement.shape.parent); const index = siblings.indexOf(placement.shape);
        if (index < 0) throw new Error('inconsistent parent'); siblings.splice(index, 1);
      }
    }
    const insertions = parameters.placements.filter(p => p.parent !== undefined).toSorted((a, b) => a.index - b.index);
    for (const { shape, parent, index } of insertions) {
      const siblings = children(parent!);
      if (!Number.isInteger(index) || index < 0 || index > siblings.length) throw new Error('invalid child index');
      siblings.splice(index, 0, shape);
    }
    const nextIndex = new Map<string, Shape>(); const visited = new Set<Shape>();
    const visit = (container: ShapeContainer) => {
      for (const shape of children(container)) {
        if (visited.has(shape)) throw new Error('cycle or duplicate shape'); visited.add(shape);
        if (nextIndex.has(shape.id)) throw new Error(`id already exists: ${shape.id}`);
        nextIndex.set(shape.id, shape); if (shape instanceof GroupShape) visit(shape);
      }
    };
    visit(root);
    for (const { shape, parent } of parameters.placements) {
      if (parent && !nextIndex.has(shape.id)) throw new Error('target container is not in document');
      if (parent && parent !== root && (!(parent instanceof GroupShape) || !visited.has(parent))) throw new Error('target container is not in document');
    }
    for (const { shape } of parameters.placements) if (shape.parent) shape.parent.children.remove(shape);
    for (const { shape, parent, index } of insertions) parent!.children.insert(shape, index);
    this.#index = nextIndex;
  }
}

