import * as vscode from 'vscode';

export class SvgFileDecorationProvider implements vscode.FileDecorationProvider {
  async provideFileDecoration(uri: vscode.Uri, token: vscode.CancellationToken): Promise<vscode.FileDecoration | undefined> {
    if (token.isCancellationRequested || !uri.path.endsWith('.svg')) return undefined;
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (token.isCancellationRequested || !(stat.type & vscode.FileType.File) || (stat.type & vscode.FileType.Directory)) return undefined;
      return { badge: '[]', tooltip: 'SVG file', propagate: false };
    } catch { return undefined; }
  }
}
