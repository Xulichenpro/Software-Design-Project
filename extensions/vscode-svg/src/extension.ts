import * as vscode from 'vscode';
import { SvgDocumentSymbolProvider } from './SvgDocumentSymbolProvider.js';
import { SvgFileDecorationProvider } from './SvgFileDecorationProvider.js';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(new SvgFileDecorationProvider()),
    vscode.languages.registerDocumentSymbolProvider(
      { pattern: '**/*.svg' },
      new SvgDocumentSymbolProvider(),
      { label: 'SVG Outline' },
    ),
  );
}
