import { CreateCommand } from '../commands/editing/CreateCommand.js';
import { DeleteCommand } from '../commands/editing/DeleteCommand.js';
import { MoveCommand } from '../commands/editing/MoveCommand.js';
import { ScaleCommand } from '../commands/editing/ScaleCommand.js';
import { SetAttributeCommand } from '../commands/editing/SetAttributeCommand.js';
import { GroupCommand } from '../commands/editing/GroupCommand.js';
import { UngroupCommand } from '../commands/editing/UngroupCommand.js';
import { AddToCommand } from '../commands/editing/AddToCommand.js';
import { FrontCommand } from '../commands/editing/FrontCommand.js';
import { BackCommand } from '../commands/editing/BackCommand.js';
import { InitCommand } from '../commands/document/InitCommand.js';
import { ReadCommand } from '../commands/document/ReadCommand.js';
import { SaveCommand } from '../commands/document/SaveCommand.js';
import { ResizeCanvasCommand } from '../commands/document/ResizeCanvasCommand.js';
import { TreeCommand } from '../commands/query/TreeCommand.js';
import { ShowCommand } from '../commands/query/ShowCommand.js';
import { HelpCommand } from '../commands/query/HelpCommand.js';
import { ShowCanvasCommand } from '../commands/query/ShowCanvasCommand.js';
import { UndoCommand } from '../commands/history/UndoCommand.js';
import { RedoCommand } from '../commands/history/RedoCommand.js';
import type { Command } from '../commands/base/Command.js';
import type { HistoryControlCommand } from '../commands/base/HistoryControlCommand.js';
import type { ShapeEditorReceiver } from '../receivers/ShapeEditorReceiver.js';
import type { DocumentReceiver } from '../receivers/DocumentReceiver.js';
import type { QueryReceiver } from '../receivers/QueryReceiver.js';
import type { ParsedCommandLine } from '../contracts/ParsedCommandLine.js';
import type { ArgumentToken } from '../contracts/ArgumentToken.js';
import { EditorError } from '../contracts/EditorError.js';

export class CommandFactory {
  constructor(private readonly editor: ShapeEditorReceiver, private readonly document: DocumentReceiver,
    private readonly query: QueryReceiver) {}
  create(input: ParsedCommandLine): Command | HistoryControlCommand {
    const args = input.args;
    const value = (index: number) => args[index]!.value;
    const count = (min: number, max = min) => {
      if (args.length < min || args.length > max) throw new EditorError(`invalid parameters for ${input.name}`);
    };
    // Command name dispatch is the documented extension point for future commands.
    switch (input.name) {
      case 'init': {
        count(0, 2);
        return new InitCommand(this.document, args.length ? this.positive(value(0), 'width') : 800,
          args.length > 1 ? this.positive(value(1), 'height') : 600);
      }
      case 'read': count(1); return new ReadCommand(this.document, value(0));
      case 'save': count(0, 1); return new SaveCommand(this.document, args[0]?.value);
      case 'canvas':
        if (!args.length) return new ShowCanvasCommand(this.query);
        count(2); return new ResizeCanvasCommand(this.document, this.positive(value(0), 'width'), this.positive(value(1), 'height'));
      case 'create': {
        count(2, Number.MAX_SAFE_INTEGER);
        const { parameters, parentId } = this.createArguments(args.slice(2));
        return new CreateCommand(this.editor, value(0), value(1), parameters.map(arg => arg.value),
          parentId, parameters.map(arg => arg.quoted));
      }
      case 'delete': count(1); return new DeleteCommand(this.editor, value(0));
      case 'move': count(3); return new MoveCommand(this.editor, { id: value(0), dx: this.finite(value(1), 'dx'), dy: this.finite(value(2), 'dy') });
      case 'scale': count(2); return new ScaleCommand(this.editor, { id: value(0), factor: this.positive(value(1), 'scale factor') });
      case 'set': {
        count(3); const name = value(1);
        if (name === 'text' && !args[2]!.quoted) throw new EditorError('text content must be quoted');
        const numeric = ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'stroke-width'];
        if (numeric.includes(name)) {
          const number = this.finite(value(2), name);
          if (['width', 'height', 'r', 'rx', 'ry', 'stroke-width'].includes(name) && number < 0) throw new EditorError(`${name} must be non-negative`);
        }
        return new SetAttributeCommand(this.editor, { id: value(0), name, value: value(2) });
      }
      case 'group': count(2, Number.MAX_SAFE_INTEGER); return new GroupCommand(this.editor, value(0), args.slice(1).map(arg => arg.value));
      case 'ungroup': count(1); return new UngroupCommand(this.editor, value(0));
      case 'addto': count(2); return new AddToCommand(this.editor, value(0), value(1));
      case 'front': count(1); return new FrontCommand(this.editor, value(0));
      case 'back': count(1); return new BackCommand(this.editor, value(0));
      case 'tree': count(0, 1); return new TreeCommand(this.query, args[0]?.value);
      case 'show': count(1); return new ShowCommand(this.query, value(0));
      case 'help': count(0); return new HelpCommand(this.query);
      case 'undo': count(0); return new UndoCommand();
      case 'redo': count(0); return new RedoCommand();
      default: throw new EditorError(`unknown command: ${input.name}`);
    }
  }
  private createArguments(args: readonly ArgumentToken[]): { parameters: readonly ArgumentToken[]; parentId?: string } {
    const directive = args.at(-2);
    if (directive?.value === 'in' && !directive.quoted) {
      const parentId = args.at(-1)!.value;
      if (!parentId) throw new EditorError('in requires a container id');
      return { parameters: args.slice(0, -2), parentId };
    }
    if (args.at(-1)?.value === 'in' && !args.at(-1)!.quoted) throw new EditorError('in requires a container id');
    return { parameters: args };
  }
  private finite(value: string, name: string): number {
    const number = Number(value);
    if (!value.trim() || !Number.isFinite(number)) throw new EditorError(`${name} must be finite`);
    return number;
  }
  private positive(value: string, name: string): number {
    const number = this.finite(value, name);
    if (number <= 0) throw new EditorError(`${name} must be positive`);
    return number;
  }
}
