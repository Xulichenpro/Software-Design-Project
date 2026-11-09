import type { Element } from '@xmldom/xmldom';
import * as vscode from 'vscode';
import { XmlParser } from '../../../src/infrastructure/svg/XmlParser.js';
import { SourceRangeIndex } from './SourceRangeIndex.js';

export class SvgOutlineAdapter {
  constructor(
    private readonly xml = new XmlParser(),
    private readonly locations = new SourceRangeIndex(),
  ) {}

  symbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.DocumentSymbol[] {
    const text = document.getText();
    const dom = this.xml.parse(text);
    const root = dom.documentElement;
    if (!root || root.localName !== 'svg') return [];
    const locations = this.locations.build(text, dom);
    const range = (start: number, end: number) => new vscode.Range(document.positionAt(start), document.positionAt(end));
    const symbol = (element: Element): vscode.DocumentSymbol => {
      if (token.isCancellationRequested) throw new Error('Symbol request cancelled');
      const location = locations.get(element);
      if (!location) throw new Error('Missing SVG source range');
      const id = element.getAttribute('id');
      const result = new vscode.DocumentSymbol(
        id ? `${element.tagName}#${id}` : element.tagName,
        '',
        vscode.SymbolKind.Object,
        range(location.start, location.end),
        range(location.nameStart, location.nameEnd),
      );
      for (let child = element.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 1) result.children.push(symbol(child as Element));
      }
      return result;
    };
    return [symbol(root)];
  }
}
