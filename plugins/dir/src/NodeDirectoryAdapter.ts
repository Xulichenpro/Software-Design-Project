import { readdir } from 'node:fs/promises';
import type { DirectoryEntry, DirectoryReader } from './DirectoryReader.js';

/**
 * Adapter over the Node filesystem. `readdir(..., { withFileTypes: true })`
 * lists direct children only; hidden entries are included and symbolic links
 * or special entries are reported as `file` without following their target.
 */
export class NodeDirectoryAdapter implements DirectoryReader {
  readonly #directory: string;

  constructor(directory: string = process.cwd()) {
    this.#directory = directory;
  }

  currentDirectory(): string { return this.#directory; }

  async list(path: string): Promise<readonly DirectoryEntry[]> {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      kind: entry.isDirectory() ? 'directory' : 'file',
    }));
  }
}
