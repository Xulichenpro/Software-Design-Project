import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { SvgDocumentSymbolProvider } from '../src/SvgDocumentSymbolProvider.js';
import { SvgFileDecorationProvider } from '../src/SvgFileDecorationProvider.js';

const cases: Array<{ name: string; action: () => Promise<void> }> = [];
function check(name: string, action: () => Promise<void>) { cases.push({ name, action }); }
function assetPath(name: string) {
  assert.ok(process.env.SVG_TEST_ASSETS, 'SVG_TEST_ASSETS must identify the shared tests/assets directory');
  return join(process.env.SVG_TEST_ASSETS, name);
}
const uri = (name: string) => vscode.Uri.file(assetPath(name));
const activeCancellation = new vscode.CancellationTokenSource();
const noCancellation = activeCancellation.token;
async function open(name: string) { return vscode.workspace.openTextDocument(uri(name)); }
async function nativeSymbols(document: vscode.TextDocument) {
  const result = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
    'vscode.executeDocumentSymbolProvider', document.uri,
  );
  assert.ok(result === undefined || Array.isArray(result), 'symbol command must return symbols or no result');
  return result ?? [];
}
function hierarchy(symbol: vscode.DocumentSymbol): unknown {
  return { name: symbol.name, children: symbol.children.map(hierarchy) };
}
function names(symbols: readonly vscode.DocumentSymbol[]): string[] {
  return symbols.flatMap(symbol => [symbol.name, ...names(symbol.children)]);
}
async function replace(document: vscode.TextDocument, text: string) {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), text);
  assert.equal(await vscode.workspace.applyEdit(edit), true);
}
async function withUnsavedDocument(name: string, action: (document: vscode.TextDocument) => Promise<void>) {
  const document = await open(name);
  const original = await readFile(assetPath(name), 'utf8');
  await vscode.window.showTextDocument(document);
  try { await action(document); }
  finally {
    await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand('workbench.action.files.revert');
    assert.equal(await readFile(assetPath(name), 'utf8'), original, 'outline processing must not write source files');
  }
}

check('extension registers and activates in the real Extension Development Host', async () => {
  const extension = vscode.extensions.getExtension('svg-cli.svg-outline');
  assert.ok(extension, 'extension manifest must be discoverable');
  await extension.activate();
  assert.equal(extension.isActive, true);
});

check('native Outline preserves root, nested groups, leaf elements and absent ids', async () => {
  const roots = await nativeSymbols(await open('outline.svg'));
  assert.deepEqual(roots.map(hierarchy), [{ name: 'svg#canvas', children: [
    { name: 'defs', children: [{ name: 'linearGradient#paint', children: [{ name: 'stop', children: [] }] }] },
    { name: 'g#flow', children: [
      { name: 'rect#start', children: [] },
      { name: 'g#nested', children: [{ name: 'path', children: [] }, { name: 'text', children: [] }] },
    ] },
  ] }]);
});

check('native Outline exposes complete element ranges and opening-name selections', async () => {
  const document = await open('outline.svg');
  const roots = await nativeSymbols(document);
  const rect = roots[0]!.children[1]!.children[0]!;
  assert.equal(document.getText(rect.selectionRange), 'rect');
  assert.equal(document.getText(rect.range), '<rect id="start" x="1" y="2" width="30" height="40" data-note="keep this attribute"/>');
  assert.ok(rect.range.contains(rect.selectionRange));
  assert.ok(roots[0]!.range.contains(rect.range));
});

check('native Outline uses changed text before the document is saved', async () => {
  await withUnsavedDocument('outline.svg', async document => {
    const before = document.version;
    await replace(document, document.getText().replace('id="start"', 'id="unsaved"'));
    assert.ok(document.version > before);
    assert.equal(document.isDirty, true);
    assert.ok(names(await nativeSymbols(document)).includes('rect#unsaved'));
    assert.ok(!names(await nativeSymbols(document)).includes('rect#start'));
  });
});

check('native Outline returns empty for incomplete XML', async () => {
  const document = await open('incomplete.svg');
  assert.deepEqual(await new SvgDocumentSymbolProvider().provideDocumentSymbols(document, noCancellation), []);
  assert.deepEqual(await nativeSymbols(document), []);
});

check('native Outline recovers when incomplete XML becomes valid without saving', async () => {
  await withUnsavedDocument('incomplete.svg', async document => {
    assert.deepEqual(await nativeSymbols(document), []);
    await replace(document, await readFile(assetPath('outline.svg'), 'utf8'));
    assert.ok(names(await nativeSymbols(document)).includes('rect#start'));
  });
});

check('native Outline preserves repeated ids and unnamed nodes independently', async () => {
  const symbols = await nativeSymbols(await open('duplicate-ids.svg'));
  assert.deepEqual(names(symbols), ['svg', 'g#same', 'rect#same', 'rect']);
  const first = symbols[0]!.children[0]!.children[0]!;
  const second = symbols[0]!.children[1]!;
  assert.ok(first.range.end.isBefore(second.range.start));
});

check('native Outline positions remain correct through CRLF, Unicode and multiline tags', async () => {
  const document = await open('source-ranges.svg');
  const symbols = await nativeSymbols(document);
  const group = symbols[0]!.children[1]!;
  const rect = group.children[0]!;
  assert.equal(document.getText(group.selectionRange), 'g');
  assert.equal(document.getText(rect.range), '<rect id="actual" data-note="quoted > delimiter"/>');
  assert.equal(rect.range.start.line, 4);
  assert.equal(document.offsetAt(rect.range.start), document.getText().indexOf('<rect id="actual"'));
});

check('cancelled symbol requests return no symbols', async () => {
  const cancellation = new vscode.CancellationTokenSource();
  cancellation.cancel();
  try {
    assert.deepEqual(await new SvgDocumentSymbolProvider().provideDocumentSymbols(await open('outline.svg'), cancellation.token), []);
  } finally { cancellation.dispose(); }
});

check('SVG file decoration is [] and never propagates to parent directories', async () => {
  const decoration = await new SvgFileDecorationProvider().provideFileDecoration(uri('outline.svg'), noCancellation);
  assert.ok(decoration);
  assert.equal(decoration.badge, '[]');
  assert.equal(decoration.propagate, false);
});

check('non-SVG files receive no decoration', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'svg-decoration-'));
  try {
    const path = join(folder, 'notes.txt');
    await writeFile(path, 'plain text');
    assert.equal(await new SvgFileDecorationProvider().provideFileDecoration(vscode.Uri.file(path), noCancellation), undefined);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

check('a directory whose name ends in .svg receives no decoration', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'svg-decoration-'));
  try {
    const path = join(folder, 'icons.svg');
    await mkdir(path);
    assert.equal(await new SvgFileDecorationProvider().provideFileDecoration(vscode.Uri.file(path), noCancellation), undefined);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

check('missing SVG paths receive no decoration instead of rejecting', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'svg-decoration-'));
  try {
    assert.equal(await new SvgFileDecorationProvider().provideFileDecoration(vscode.Uri.file(join(folder, 'missing.svg')), noCancellation), undefined);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

check('cancelled decoration requests return no decoration', async () => {
  const cancellation = new vscode.CancellationTokenSource();
  cancellation.cancel();
  try {
    assert.equal(await new SvgFileDecorationProvider().provideFileDecoration(uri('outline.svg'), cancellation.token), undefined);
  } finally { cancellation.dispose(); }
});

check('decoration and outline preserve file names and exact file bytes', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'svg-immutable-'));
  try {
    const path = join(folder, 'unchanged.svg');
    await copyFile(assetPath('outline.svg'), path);
    const before = await readFile(path);
    const resource = vscode.Uri.file(path);
    await new SvgFileDecorationProvider().provideFileDecoration(resource, noCancellation);
    await new SvgDocumentSymbolProvider().provideDocumentSymbols(await vscode.workspace.openTextDocument(resource), noCancellation);
    assert.deepEqual(await readFile(path), before);
    assert.equal(resource.path.split('/').at(-1), 'unchanged.svg');
  } finally { await rm(folder, { recursive: true, force: true }); }
});

export async function run(): Promise<void> {
  const failures: Error[] = [];
  for (const { name, action } of cases) {
    try { await action(); console.log(`PASS ${name}`); }
    catch (error) {
      console.error(`FAIL ${name}`, error);
      failures.push(error instanceof Error ? error : new Error(String(error)));
    }
  }
  console.log(`SVG host tests: ${cases.length - failures.length}/${cases.length} passed`);
  activeCancellation.dispose();
  if (failures.length) throw new AggregateError(failures, `${failures.length} SVG host tests failed`);
}
