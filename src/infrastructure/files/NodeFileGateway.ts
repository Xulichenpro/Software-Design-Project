import { readFile, open, rename, unlink } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { FileGateway } from '../../application/contracts/FileGateway.js';
import { EditorError } from '../../application/contracts/EditorError.js';

export class NodeFileGateway implements FileGateway {
  async read(path: string): Promise<string> {
    try { return await readFile(path, 'utf8'); } catch { throw new EditorError(`cannot read file: ${path}`); }
  }
  async write(path: string, content: string): Promise<void> {
    const temporary = join(dirname(path), '.' + basename(path) + '.' + randomUUID() + '.tmp');
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temporary, 'wx'); await handle.writeFile(content, 'utf8'); await handle.sync(); await handle.close(); handle = undefined;
      await rename(temporary, path);
    } catch { throw new EditorError(`cannot write file: ${path}`); }
    finally { await handle?.close().catch(() => {}); await unlink(temporary).catch(() => {}); }
  }
}
