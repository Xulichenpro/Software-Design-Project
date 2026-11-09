/** A direct child of a directory, as exposed to the `dir` command. */
export interface DirectoryEntry {
  readonly name: string;
  readonly kind: 'directory' | 'file';
}

/** Target port of the adapter; the command never touches the filesystem. */
export interface DirectoryReader {
  currentDirectory(): string;
  list(path: string): Promise<readonly DirectoryEntry[]>;
}
