import { CliApplication } from '../cli/CliApplication.js';
import { CommandLineParser } from '../cli/CommandLineParser.js';
import { CliResultRenderer } from '../cli/CliResultRenderer.js';
import { CommandFactory } from '../application/factory/CommandFactory.js';
import { CommandExecutor } from '../application/execution/CommandExecutor.js';
import { ShapeEditorReceiver } from '../application/receivers/ShapeEditorReceiver.js';
import { DocumentReceiver } from '../application/receivers/DocumentReceiver.js';
import { QueryReceiver } from '../application/receivers/QueryReceiver.js';
import type { Terminal } from '../application/contracts/Terminal.js';
import type { FileGateway } from '../application/contracts/FileGateway.js';
import { ShapeTree } from '../domain/tree/ShapeTree.js';
import { ShapeFactory } from '../domain/factory/ShapeFactory.js';
import { NodeTerminal } from '../infrastructure/terminal/NodeTerminal.js';
import { NodeFileGateway } from '../infrastructure/files/NodeFileGateway.js';
import { SvgXmlCodec } from '../infrastructure/svg/SvgXmlCodec.js';

export class ApplicationBootstrap {
  constructor(private readonly terminal: Terminal = new NodeTerminal(), private readonly files: FileGateway = new NodeFileGateway()) {}
  run(): Promise<void> {
    const tree = new ShapeTree(); const shapes = new ShapeFactory();
    const editor = new ShapeEditorReceiver(tree, shapes);
    const document = new DocumentReceiver(tree, new SvgXmlCodec(shapes), this.files);
    const query = new QueryReceiver(tree);
    const application = new CliApplication(this.terminal, new CommandLineParser(),
      new CommandFactory(editor, document, query), new CommandExecutor(), new CliResultRenderer(this.terminal));
    return application.run();
  }
}
