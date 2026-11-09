import {
  ChildCollection, EditorError, UndoableCommand,
} from '../../../src/extension-api/index.js';
import type {
  CommandResult, DocumentView, ShapeContainer,
} from '../../../src/extension-api/index.js';
import { EditRecord } from '../../../src/application/records/EditRecord.js';
import type { DirectoryEntry, DirectoryReader } from '../../../plugins/dir/src/DirectoryReader.js';

/** A configurable stand-in for the filesystem-facing `DirectoryReader` port. */
export class FakeDirectoryReader implements DirectoryReader {
  readonly requested: string[] = [];

  constructor(
    private readonly directory: string,
    private readonly entries: readonly DirectoryEntry[] | Error,
  ) {}

  currentDirectory(): string { return this.directory; }

  async list(path: string): Promise<readonly DirectoryEntry[]> {
    this.requested.push(path);
    if (this.entries instanceof Error) throw this.entries;
    return this.entries;
  }
}

export function entries(...items: readonly (readonly [string, 'directory' | 'file'])[]): readonly DirectoryEntry[] {
  return items.map(([name, kind]) => ({ name, kind }));
}

class EmptyRoot implements ShapeContainer {
  readonly #children = new ChildCollection(this);
  readonly label = 'svg';
  get children(): ChildCollection { return this.#children; }
}

/** An initialized document that dir must not touch in any way. */
export class ExistingDocument implements DocumentView {
  readonly root = new EmptyRoot();
  requireInitialized(): void {}
  findShape(id: string): never { throw new EditorError(`no such shape: ${id}`); }
}

class ProbeRecord extends EditRecord<'undo' | 'redo'> {}

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
