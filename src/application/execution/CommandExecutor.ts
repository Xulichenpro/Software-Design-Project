import type { Command } from '../commands/base/Command.js';
import { UndoableCommand } from '../commands/base/UndoableCommand.js';
import { BarrierCommand } from '../commands/base/BarrierCommand.js';
import { QueryCommand } from '../commands/base/QueryCommand.js';
import { HistoryControlCommand } from '../commands/base/HistoryControlCommand.js';
import type { CommandResult } from '../contracts/CommandResult.js';
import type { DocumentObserver, DocumentEvent, DocumentEventKind, ShapeSnapshot } from '../contracts/DocumentEvent.js';
import type { DocumentView } from '../contracts/DocumentView.js';
import { EditorError } from '../contracts/EditorError.js';
import { createDocumentEvent } from '../contracts/DocumentEvent.js';
import { snapshotDocument } from './DocumentSnapshot.js';

export class CommandExecutor {
  readonly #undoStack: UndoableCommand[] = [];
  readonly #redoStack: UndoableCommand[] = [];
  #historyBlocked = false;
  #documentEstablished = false;
  readonly #observer: DocumentObserver | undefined;
  readonly #document: DocumentView | undefined;

  constructor(observer?: DocumentObserver, document?: DocumentView) {
    this.#observer = observer;
    this.#document = document;
  }

  async execute(command: Command | HistoryControlCommand): Promise<CommandResult> {
    if (command instanceof HistoryControlCommand) {
      if (this.#document) this.#document.requireInitialized();
      else if (!this.#documentEstablished) throw new EditorError("no document. use 'init' or 'read' first");
      const direction = command.getDirection();
      if (this.#historyBlocked) throw new EditorError(`${direction} not allowed after io command`);
      const source = direction === 'undo' ? this.#undoStack : this.#redoStack;
      const destination = direction === 'undo' ? this.#redoStack : this.#undoStack;
      const target = source.at(-1);
      if (!target) throw new EditorError(`nothing to ${direction}`);
      const before = this.snapshot();
      const result = await command.execute(target);
      source.pop(); destination.push(target);
      this.notify('history', before);
      return result;
    }
    if (!(command instanceof UndoableCommand || command instanceof BarrierCommand || command instanceof QueryCommand)) {
      throw new EditorError('unsupported command category');
    }
    if (command instanceof UndoableCommand) {
      const before = this.snapshot();
      const result = await command.execute();
      this.#documentEstablished = true;
      this.#undoStack.push(command);
      this.#redoStack.length = 0;
      this.#historyBlocked = false;
      this.notify('edited', before);
      return result;
    }
    const result = await command.execute();
    if (command instanceof BarrierCommand) {
      this.#documentEstablished = true;
      this.#undoStack.length = 0;
      this.#redoStack.length = 0;
      this.#historyBlocked = true;
      if (result.documentEvent) this.dispatch(result.documentEvent);
    }
    return result;
  }

  private snapshot(): ReadonlyMap<string, ShapeSnapshot> {
    return this.#document ? snapshotDocument(this.#document) : new Map();
  }

  private notify(kind: DocumentEventKind, before: ReadonlyMap<string, ShapeSnapshot>): void {
    this.dispatch(createDocumentEvent(kind, before, this.snapshot()));
  }

  private dispatch(event: DocumentEvent): void {
    if (!this.#observer) return;
    try {
      this.#observer.onCommitted(event);
    } catch {
      // Observers cannot break an already committed command.
    }
  }
}
