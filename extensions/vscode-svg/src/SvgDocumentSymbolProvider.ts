import type { CancellationToken, DocumentSymbol, DocumentSymbolProvider, TextDocument } from 'vscode';
import { SvgOutlineAdapter } from './SvgOutlineAdapter.js';

export class SvgDocumentSymbolProvider implements DocumentSymbolProvider {
  constructor(private readonly adapter = new SvgOutlineAdapter()) {}

  provideDocumentSymbols(document: TextDocument, token: CancellationToken): DocumentSymbol[] {
    if (token.isCancellationRequested) return [];
    try { return this.adapter.symbols(document, token); }
    catch { return []; }
  }
}
