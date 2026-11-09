/**
 * The only public import surface for plugin packages. Re-exports kernel types
 * and abstract extension points; no logic lives here.
 */
export { Shape } from '../domain/shapes/Shape.js';
export { ShapeProvider } from '../domain/shapes/ShapeProvider.js';
export { ShapeStyle } from '../domain/shapes/ShapeStyle.js';
export { ChildCollection } from '../domain/tree/ChildCollection.js';
export { AttributeHandler } from '../application/attributes/AttributeHandler.js';
export { TreeDecorator } from '../application/tree/TreeDecorator.js';
export { Command } from '../application/commands/base/Command.js';
export { PluginCommand } from '../application/commands/base/PluginCommand.js';
export { QueryCommand } from '../application/commands/base/QueryCommand.js';
export { UndoableCommand } from '../application/commands/base/UndoableCommand.js';
export { BarrierCommand } from '../application/commands/base/BarrierCommand.js';
export { HistoryControlCommand } from '../application/commands/base/HistoryControlCommand.js';
export { EditorError } from '../application/contracts/EditorError.js';

export type { ShapeRegistration } from '../domain/shapes/ShapeRegistration.js';
export type { ShapeCreationContext } from '../domain/shapes/ShapeCreationContext.js';
export type { ShapeContainer } from '../domain/tree/ShapeContainer.js';
export type { ShapeTopology } from '../domain/tree/ShapeTopology.js';
export type { ShapeDescription } from '../domain/representation/ShapeDescription.js';
export type { SvgElement } from '../domain/representation/SvgElement.js';
export type { ArgumentToken } from '../application/contracts/ArgumentToken.js';
export type { CommandResult } from '../application/contracts/CommandResult.js';
export type { CommandRegistration } from '../application/contracts/CommandRegistration.js';
export type { CommandServices } from '../application/contracts/CommandServices.js';
export type { DocumentView } from '../application/contracts/DocumentView.js';
export type {
  DocumentEvent, DocumentEventKind, DocumentObserver, ShapeSnapshot,
} from '../application/contracts/DocumentEvent.js';
export type {
  AttributeEditParameters, AttributeEditRequest, AttributePatch, AttributeWrite,
} from '../application/contracts/AttributeEditParameters.js';
export type { AttributeOutcome } from '../application/attributes/AttributeOutcome.js';
export type { AttributeTransaction } from '../application/attributes/AttributeTransaction.js';
export type { ReadonlyShape } from '../application/attributes/ReadonlyShape.js';
export type { TreeRow } from '../application/tree/TreeRow.js';
export type {
  PluginContext, PluginManifest, PluginModule, PluginContributes,
} from '../bootstrap/PluginHost.js';
