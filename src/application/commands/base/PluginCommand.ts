import { Command } from './Command.js';

/** Base class for every command supplied through the command registry. */
export abstract class PluginCommand<TInput = void> extends Command<TInput> {}
