import { CreateCommand } from '../application/commands/editing/CreateCommand.js';
import { DeleteCommand } from '../application/commands/editing/DeleteCommand.js';
import { MoveCommand } from '../application/commands/editing/MoveCommand.js';
import { ScaleCommand } from '../application/commands/editing/ScaleCommand.js';
import { SetAttributeCommand } from '../application/commands/editing/SetAttributeCommand.js';
import { GroupCommand } from '../application/commands/editing/GroupCommand.js';
import { UngroupCommand } from '../application/commands/editing/UngroupCommand.js';
import { AddToCommand } from '../application/commands/editing/AddToCommand.js';
import { FrontCommand } from '../application/commands/editing/FrontCommand.js';
import { BackCommand } from '../application/commands/editing/BackCommand.js';
import { InitCommand } from '../application/commands/document/InitCommand.js';
import { ReadCommand } from '../application/commands/document/ReadCommand.js';
import { SaveCommand } from '../application/commands/document/SaveCommand.js';
import { ResizeCanvasCommand } from '../application/commands/document/ResizeCanvasCommand.js';
import { TreeCommand } from '../application/commands/query/TreeCommand.js';
import { ShowCommand } from '../application/commands/query/ShowCommand.js';
import { HelpCommand } from '../application/commands/query/HelpCommand.js';
import { ShowCanvasCommand } from '../application/commands/query/ShowCanvasCommand.js';
import { UndoCommand } from '../application/commands/history/UndoCommand.js';
import { RedoCommand } from '../application/commands/history/RedoCommand.js';
import { EditorError } from '../application/contracts/EditorError.js';
import type { ArgumentToken } from '../application/contracts/ArgumentToken.js';
import type { CommandRegistration } from '../application/contracts/CommandRegistration.js';
import type { CommandServices } from '../application/contracts/CommandServices.js';
import type { Command } from '../application/commands/base/Command.js';
import type { AttributeHandler } from '../application/attributes/AttributeHandler.js';
import type { TreeDecorator } from '../application/tree/TreeDecorator.js';
import type { ShapeRegistration } from '../domain/shapes/ShapeRegistration.js';
import { RectShape } from '../domain/shapes/RectShape.js';
import { CircleShape } from '../domain/shapes/CircleShape.js';
import { EllipseShape } from '../domain/shapes/EllipseShape.js';
import { LineShape } from '../domain/shapes/LineShape.js';
import { TextShape } from '../domain/shapes/TextShape.js';
import { GroupShape } from '../domain/shapes/GroupShape.js';
import type { ShapeEditorReceiver } from '../application/receivers/ShapeEditorReceiver.js';
import type { DocumentReceiver } from '../application/receivers/DocumentReceiver.js';
import type { QueryReceiver } from '../application/receivers/QueryReceiver.js';

export interface BuiltinServices {
  readonly editor: ShapeEditorReceiver;
  readonly document: DocumentReceiver;
  readonly query: QueryReceiver;
}

export interface BuiltinContributions {
  readonly shapes: ReadonlyMap<string, ShapeRegistration>;
  readonly commands: ReadonlyMap<string, CommandRegistration>;
  readonly attributes: ReadonlyMap<string, AttributeHandler>;
  readonly decorators: ReadonlyMap<string, TreeDecorator>;
}

const shapeEntries: readonly (readonly [string, ShapeRegistration])[] = [
  ['rect', RectShape], ['circle', CircleShape], ['ellipse', EllipseShape],
  ['line', LineShape], ['text', TextShape], ['g', GroupShape],
];

function count(name: string, args: readonly ArgumentToken[], min: number, max = min): void {
  if (args.length < min || args.length > max) throw new EditorError(`invalid parameters for ${name}`);
}

function value(args: readonly ArgumentToken[], index: number): string {
  return args[index]!.value;
}

function finite(text: string, name: string): number {
  const number = Number(text);
  if (!text.trim() || !Number.isFinite(number)) throw new EditorError(`${name} must be finite`);
  return number;
}

function positive(text: string, name: string): number {
  const number = finite(text, name);
  if (number <= 0) throw new EditorError(`${name} must be positive`);
  return number;
}

function command(
  name: string,
  help: string,
  create: (args: readonly ArgumentToken[], services: CommandServices) => Command,
): CommandRegistration {
  return Object.freeze({ name, help, create });
}

function createArguments(args: readonly ArgumentToken[]): { parameters: readonly ArgumentToken[]; parentId?: string } {
  const directive = args.at(-2);
  if (directive?.value === 'in' && !directive.quoted) {
    const parentId = args.at(-1)!.value;
    if (!parentId) throw new EditorError('in requires a container id');
    return { parameters: args.slice(0, -2), parentId };
  }
  if (args.at(-1)?.value === 'in' && !args.at(-1)!.quoted) throw new EditorError('in requires a container id');
  return { parameters: args };
}

/** Phase 1 kernel contributions, built in source order. */
export function createBuiltinContributions(services: BuiltinServices): BuiltinContributions {
  const { editor, document, query } = services;
  const commands = new Map<string, CommandRegistration>([
    ['init', command('init', 'init [w] [h]', args => {
      count('init', args, 0, 2);
      return new InitCommand(document, args.length ? positive(value(args, 0), 'width') : 800,
        args.length > 1 ? positive(value(args, 1), 'height') : 600);
    })],
    ['read', command('read', 'read <file.svg>', args => {
      count('read', args, 1); return new ReadCommand(document, value(args, 0));
    })],
    ['save', command('save', 'save [file.svg]', args => {
      count('save', args, 0, 1); return new SaveCommand(document, args[0]?.value);
    })],
    ['canvas', command('canvas', 'canvas [w] [h]', args => {
      if (!args.length) return new ShowCanvasCommand(query);
      count('canvas', args, 2);
      return new ResizeCanvasCommand(document, positive(value(args, 0), 'width'), positive(value(args, 1), 'height'));
    })],
    ['create', command('create', 'create <type> <id> [params…] [in <containerId>]', args => {
      count('create', args, 2, Number.MAX_SAFE_INTEGER);
      const { parameters, parentId } = createArguments(args.slice(2));
      return new CreateCommand(editor, value(args, 0), value(args, 1), parameters.map(argument => argument.value),
        parentId, parameters.map(argument => argument.quoted));
    })],
    ['delete', command('delete', 'delete <id>', args => {
      count('delete', args, 1); return new DeleteCommand(editor, value(args, 0));
    })],
    ['move', command('move', 'move <id> <dx> <dy>', args => {
      count('move', args, 3);
      return new MoveCommand(editor, { id: value(args, 0), dx: finite(value(args, 1), 'dx'), dy: finite(value(args, 2), 'dy') });
    })],
    ['scale', command('scale', 'scale <id> <factor>', args => {
      count('scale', args, 2);
      return new ScaleCommand(editor, { id: value(args, 0), factor: positive(value(args, 1), 'scale factor') });
    })],
    ['set', command('set', 'set <id> <attr> <value>', args => {
      count('set', args, 3);
      return new SetAttributeCommand(editor, {
        id: value(args, 0), name: value(args, 1), value: value(args, 2), quoted: args[2]!.quoted,
      });
    })],
    ['group', command('group', 'group <newGid> <id1> <id2>…', args => {
      count('group', args, 2, Number.MAX_SAFE_INTEGER);
      return new GroupCommand(editor, value(args, 0), args.slice(1).map(argument => argument.value));
    })],
    ['ungroup', command('ungroup', 'ungroup <gid>', args => {
      count('ungroup', args, 1); return new UngroupCommand(editor, value(args, 0));
    })],
    ['addto', command('addto', 'addto <gid> <id>', args => {
      count('addto', args, 2); return new AddToCommand(editor, value(args, 0), value(args, 1));
    })],
    ['front', command('front', 'front <id>', args => {
      count('front', args, 1); return new FrontCommand(editor, value(args, 0));
    })],
    ['back', command('back', 'back <id>', args => {
      count('back', args, 1); return new BackCommand(editor, value(args, 0));
    })],
    ['tree', command('tree', 'tree [id]', args => {
      count('tree', args, 0, 1); return new TreeCommand(query, args[0]?.value);
    })],
    ['show', command('show', 'show <id>', args => {
      count('show', args, 1); return new ShowCommand(query, value(args, 0));
    })],
    ['help', command('help', 'help', args => {
      count('help', args, 0); return new HelpCommand(query);
    })],
    ['undo', command('undo', 'undo', args => {
      count('undo', args, 0); return new UndoCommand() as unknown as Command;
    })],
    ['redo', command('redo', 'redo', args => {
      count('redo', args, 0); return new RedoCommand() as unknown as Command;
    })],
  ]);
  return Object.freeze({
    shapes: new Map(shapeEntries),
    commands,
    attributes: new Map<string, AttributeHandler>(),
    decorators: new Map<string, TreeDecorator>(),
  });
}
