import { EditorError, QueryCommand } from '../../../src/extension-api/index.js';
import type { CommandResult } from '../../../src/extension-api/index.js';
import type { DirectoryEntry, DirectoryReader } from './DirectoryReader.js';

const kindRank = (kind: DirectoryEntry['kind']): number => kind === 'directory' ? 0 : 1;

function compareEntries(left: DirectoryEntry, right: DirectoryEntry): number {
  const rank = kindRank(left.kind) - kindRank(right.kind);
  if (rank !== 0) return rank;
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  return 0;
}

/** Read-only listing of the reader's current directory, sorted stably. */
export class DirCommand extends QueryCommand {
  constructor(private readonly reader: DirectoryReader) { super(); }

  async execute(): Promise<CommandResult> {
    const directory = this.reader.currentDirectory();
    let entries: readonly DirectoryEntry[];
    try {
      entries = await this.reader.list(directory);
    } catch {
      throw new EditorError(`cannot read directory: ${directory}`);
    }
    if (entries.length === 0) return { lines: ['(empty directory)'] };
    const lines = entries.toSorted(compareEntries).map(entry =>
      `${entry.kind === 'directory' ? '[DIR]' : '[FILE]'}  ${entry.name}`);
    return { lines };
  }
}
