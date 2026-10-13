import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PassThrough } from 'node:stream';
import { once } from 'node:events';
import { NodeTerminal } from '../../../src/infrastructure/terminal/NodeTerminal.js';

function setup() {
  const input=new PassThrough(); const output=new PassThrough(); let text='';
  output.setEncoding('utf8'); output.on('data',chunk => {text+=chunk;});
  return { input, output, terminal:new NodeTerminal(input,output), text:() => text };
}
test('terminal buffers CRLF scripts through EOF and returns final unterminated Unicode line', async () => {
  const f=setup(); const ended=once(f.input,'end'); f.input.end('first\r\n\r\n处理数据'); await ended;
  assert.equal(await f.terminal.readLine('svg> '),'first');
  assert.equal(await f.terminal.readLine('svg> '),'');
  assert.equal(await f.terminal.readLine('svg> '),'处理数据');
  assert.equal(await f.terminal.readLine('svg> '),undefined);
  f.terminal.writeLine('finished'); assert.equal(f.text(),'svg> svg> svg> svg> finished\n'); f.terminal.close();
});
test('terminal retains every line arriving while caller awaits other work', async () => {
  const f=setup(); const ended=once(f.input,'end'); const lines=Array.from({length:200},(_,i) => 'line '+i);
  f.input.end(lines.join('\n')); await ended;
  for(const line of lines) assert.equal(await f.terminal.readLine(''),line);
  assert.equal(await f.terminal.readLine(''),undefined); f.terminal.close();
});
test('terminal waits for new input, handles split Unicode buffers and closes pending reads', async () => {
  const f=setup(); const pending=f.terminal.readLine('svg> '); const bytes=Buffer.from('开始\n');
  f.input.write(bytes.subarray(0,1)); f.input.write(bytes.subarray(1));
  assert.equal(await pending,'开始'); const next=f.terminal.readLine('svg> '); f.terminal.close();
  assert.equal(await next,undefined); assert.equal(f.input.listenerCount('data'),0);
  assert.equal(await f.terminal.readLine(''),undefined); f.terminal.close();
});
test('terminal propagates input errors to waiting reads and releases its reader', async () => {
  const f=setup(); const pending=f.terminal.readLine(''); f.input.destroy(new Error('input failed'));
  await assert.rejects(pending,/input failed/); f.terminal.close(); assert.equal(f.input.listenerCount('data'),0);
});
