import type { ShapeTree } from '../../domain/tree/ShapeTree.js';
import type { SvgCodec } from '../contracts/SvgCodec.js';
import type { FileGateway } from '../contracts/FileGateway.js';
import type { CommandResult } from '../contracts/CommandResult.js';
import { EditorError } from '../contracts/EditorError.js';
export class DocumentReceiver {
  #associatedPath: string | undefined;
  constructor(private readonly tree: ShapeTree, private readonly codec: SvgCodec, private readonly files: FileGateway) {}
  get associatedPath() { return this.#associatedPath; }
  initialize(width = 800, height = 600): CommandResult {
    this.tree.initialize(width, height); this.#associatedPath = undefined; return { lines: [`canvas ${width}x${height} created`] };
  }
  resizeCanvas(width: number, height: number): CommandResult { this.tree.resize(width, height); return { lines: [`canvas resized to ${width}x${height}`] }; }
  async read(path: string): Promise<CommandResult> {
    let text: string; try { text = await this.files.read(path); } catch { throw new EditorError(`cannot read file: ${path}`); }
    const imported = this.codec.decode(text); this.tree.replaceWith(imported.tree); this.#associatedPath = path;
    return { lines: [`read ${path} (${this.tree.shapes.length} elements)`], warnings: imported.warnings };
  }
  async save(path?: string): Promise<CommandResult> {
    this.tree.requireInitialized(); const target = path ?? this.#associatedPath;
    if (!target) throw new EditorError('no associated path. specify a save path');
    const text = this.codec.encode(this.tree);
    try { await this.files.write(target, text); } catch { throw new EditorError(`cannot write file: ${target}`); }
    this.#associatedPath = target; return { lines: [`saved to ${target} (${this.tree.shapes.length} elements)`] };
  }
}
