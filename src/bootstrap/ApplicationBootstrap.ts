import { CliApplication } from '../cli/CliApplication.js';
import { CommandLineParser } from '../cli/CommandLineParser.js';
import { CliResultRenderer } from '../cli/CliResultRenderer.js';
import { CommandExecutor } from '../application/execution/CommandExecutor.js';
import { ShapeEditorReceiver } from '../application/receivers/ShapeEditorReceiver.js';
import { DocumentReceiver } from '../application/receivers/DocumentReceiver.js';
import { QueryReceiver } from '../application/receivers/QueryReceiver.js';
import { AttributeService } from '../application/attributes/AttributeService.js';
import { ShapeProviderRegistry } from '../application/registries/ShapeProviderRegistry.js';
import { CommandRegistry } from '../application/registries/CommandRegistry.js';
import { AttributeHandlerRegistry } from '../application/registries/AttributeHandlerRegistry.js';
import { TreeDecoratorRegistry } from '../application/registries/TreeDecoratorRegistry.js';
import { TreeRenderer } from '../application/tree/TreeRenderer.js';
import type { Terminal } from '../application/contracts/Terminal.js';
import type { FileGateway } from '../application/contracts/FileGateway.js';
import { ShapeTree } from '../domain/tree/ShapeTree.js';
import { NodeTerminal } from '../infrastructure/terminal/NodeTerminal.js';
import { NodeFileGateway } from '../infrastructure/files/NodeFileGateway.js';
import { SvgXmlCodec } from '../infrastructure/svg/SvgXmlCodec.js';
import { createBuiltinContributions } from './builtinContributions.js';
import { PluginHost } from './PluginHost.js';
import { PluginLoader } from './PluginLoader.js';
import { load as loadCodeAssembly } from './codeAssembly.js';

export class ApplicationBootstrap {
  constructor(
    private readonly terminal: Terminal = new NodeTerminal(),
    private readonly files: FileGateway = new NodeFileGateway(),
    private readonly pluginSource?: string,
  ) {}

  async run(): Promise<void> {
    const tree = new ShapeTree();
    const shapes = new ShapeProviderRegistry();
    const commands = new CommandRegistry();
    const handlers = new AttributeHandlerRegistry();
    const decorators = new TreeDecoratorRegistry();
    const attributes = new AttributeService(tree, handlers);
    const editor = new ShapeEditorReceiver(tree, shapes, attributes);
    const document = new DocumentReceiver(tree, new SvgXmlCodec(shapes), this.files);
    const renderer = new TreeRenderer(decorators);
    const query = new QueryReceiver(tree, renderer, commands);
    const builtin = createBuiltinContributions({ editor, document, query });
    const host = new PluginHost({
      shapes: [...builtin.shapes.keys()],
      commands: [...builtin.commands.keys()],
      attributes: [...builtin.attributes.keys()],
      decorators: [...builtin.decorators.keys()],
    }, this.terminal);
    if (this.pluginSource === undefined) await loadCodeAssembly(host);
    else await new PluginLoader(host, this.terminal).load(this.pluginSource);
    shapes.install(builtin.shapes, host.contributions.shapes);
    commands.install(builtin.commands, host.contributions.commands);
    handlers.install(builtin.attributes, host.contributions.attributes);
    decorators.install(builtin.decorators, host.contributions.decorators);
    const executor = new CommandExecutor(decorators, tree);
    const application = new CliApplication(this.terminal, new CommandLineParser(), commands,
      executor, new CliResultRenderer(this.terminal), { document: tree });
    await application.run();
  }
}
