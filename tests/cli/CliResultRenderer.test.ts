import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CliResultRenderer } from '../../src/cli/CliResultRenderer.js';
import type { Terminal } from '../../src/application/contracts/Terminal.js';
function setup() {
  const output: string[] = [];
  const terminal: Terminal = { async readLine() { return undefined; }, writeLine(text) { output.push(text); }, close() {} };
  return { output, renderer: new CliResultRenderer(terminal) };
}
test('renderer prefixes warnings once and preserves result lines', () => {
  const { output,renderer }=setup();
  renderer.render({lines:['svg (800x600)','└── rect#r  x=1'],warnings:['assigned id rect1','warning: existing','warning: warning: duplicate\r\nextra']});
  assert.deepEqual(output,['warning: assigned id rect1','warning: existing','warning: duplicate extra','svg (800x600)','└── rect#r  x=1']);
});
test('renderer emits exactly one sanitized error line for errors and non-Error values', () => {
  const { output,renderer }=setup();
  renderer.renderError(new Error('bad\r\nnext\nline')); renderer.renderError('error: already'); renderer.renderError(42);
  assert.deepEqual(output,['error: bad next line','error: already','error: 42']);
  assert.ok(output.every(line => !/[\r\n]/.test(line)));
});
