import {
  ChildCollection, EditorError, ShapeProvider, UndoableCommand,
} from '../../../src/extension-api/index.js';
import type {
  CommandResult, DocumentView, ShapeContainer,
} from '../../../src/extension-api/index.js';
import { EditRecord } from '../../../src/application/records/EditRecord.js';

/**
 * Structural test doubles for the public `DocumentView` contract. Stats must
 * work against the read-only view, so these do not import any receiver or
 * bootstrap module.
 */
export class TestShape extends ShapeProvider {
  readonly #kind: string;

  constructor(id: string, kind: string) {
    super(id, {});
    this.#kind = kind;
  }

  override get kind(): string { return this.#kind; }
  get tag(): string { return this.#kind === 'box' ? 'g' : this.#kind; }
  protected get xKeys(): readonly string[] { return []; }
  protected get yKeys(): readonly string[] { return []; }
}

export class TestContainer extends TestShape implements ShapeContainer {
  readonly #children = new ChildCollection(this);

  constructor(id: string, kind = 'g') { super(id, kind); }

  get children(): ChildCollection { return this.#children; }
  override asContainer(): ShapeContainer { return this; }
  override get descendants(): readonly TestShape[] { return this.#children.items as readonly TestShape[]; }

  add(...shapes: readonly TestShape[]): this {
    for (const shape of shapes) this.#children.insert(shape, this.#children.items.length);
    return this;
  }
}

export class TestRoot implements ShapeContainer {
  readonly #children = new ChildCollection(this);
  readonly label = 'svg';

  get children(): ChildCollection { return this.#children; }

  add(...shapes: readonly TestShape[]): this {
    for (const shape of shapes) this.#children.insert(shape, this.#children.items.length);
    return this;
  }
}

export class TestDocument implements DocumentView {
  initialized = true;
  readonly #index = new Map<string, TestShape>();
  readonly root: TestRoot;

  constructor(root = new TestRoot()) {
    this.root = root;
    this.#collect(root.children.items as readonly TestShape[]);
  }

  requireInitialized(): void {
    if (!this.initialized) throw new EditorError("no document. use 'init' or 'read' first");
  }

  findShape(id: string): TestShape {
    const shape = this.#index.get(id);
    if (!shape) throw new EditorError(`no such shape: ${id}`);
    return shape;
  }

  #collect(shapes: readonly TestShape[]): void {
    for (const shape of shapes) {
      this.#index.set(shape.id, shape);
      this.#collect(shape.descendants as readonly TestShape[]);
    }
  }
}

let nextLeafId = 0;

export function leaf(kind: string, id = `${kind}-${++nextLeafId}`): TestShape {
  return new TestShape(id, kind);
}

export function container(id: string, ...children: readonly TestShape[]): TestContainer {
  return new TestContainer(id).add(...children);
}

export function documentWith(...shapes: readonly TestShape[]): TestDocument {
  return new TestDocument(new TestRoot().add(...shapes));
}

class ProbeRecord extends EditRecord<'undo' | 'redo'> {}

/** A minimal undoable command used to prove a query keeps both stacks intact. */
export class ProbeEditCommand extends UndoableCommand<'undo' | 'redo'> {
  constructor(private readonly replayLog: string[]) { super(); }

  protected firstExecute() {
    return {
      result: { lines: ['probe edited'] } satisfies CommandResult,
      record: new ProbeRecord('redo', 'undo'),
    };
  }

  protected replay(parameters: 'undo' | 'redo'): CommandResult {
    this.replayLog.push(parameters);
    return { lines: [`probe ${parameters}`] };
  }
}
