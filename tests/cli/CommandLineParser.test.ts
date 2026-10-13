import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CommandLineParser } from '../../src/cli/CommandLineParser.js';
const parser = new CommandLineParser();

for (const input of ['', '   ', '\t', '# comment', '  # create g ignored']) test(`parser ignores blank/comment ${JSON.stringify(input)}`, () => {
  assert.equal(parser.parse(input), undefined);
});
test('parser retains quoted flags, empty content and literal color hashes', () => {
  const parsed = parser.parse('  create\ttext title 1 2 "hello world" in scene  ')!;
  assert.equal(parsed.name,'create');
  assert.deepEqual(parsed.args.map(t => [t.value,t.quoted]), [['text',false],['title',false],['1',false],['2',false],['hello world',true],['in',false],['scene',false]]);
  assert.deepEqual(parser.parse('set r fill #3366ff')!.args.at(-1),{value:'#3366ff',quoted:false});
  assert.deepEqual(parser.parse('create text t 1 2 ""')!.args.at(-1),{value:'',quoted:true});
  assert.ok(Object.isFrozen(parsed)); assert.ok(Object.isFrozen(parsed.args)); assert.ok(Object.isFrozen(parsed.args[0]));
});
test('parser only treats leading hashes as comments', () => {
  assert.deepEqual(parser.parse('help # comment')!.args.map(t => t.value),['#','comment']);
  assert.deepEqual(parser.parse('set r fill "#abc"')!.args.at(-1),{value:'#abc',quoted:true});
});
test('parser decodes supported escapes inside quotes and preserves unquoted Windows backslashes', () => {
  const input = String.raw`create text t 1 2 "say \"hi\" and \\ path"`;
  assert.equal(parser.parse(input)!.args.at(-1)!.value,'say "hi" and \\ path');
  const path = String.raw`C:\work\drawing.svg`;
  assert.equal(parser.parse('read '+path)!.args[0]!.value,path);
  assert.equal(parser.parse(String.raw`read "C:\\work\\drawing.svg"`)!.args[0]!.value,path);
});
for (const input of [
  'create text t 1 2 "unfinished', String.raw`create text t 1 2 "bad\n"`,
  String.raw`read "C:\work\file.svg"`, 'set t text "closed"x', 'set t text pre"quoted"',
  'set t text "a""b"', '"help"', '""',
]) test(`parser rejects malformed or ambiguous quoting ${JSON.stringify(input)}`, () => {
  assert.throws(() => parser.parse(input), /quote|escape|whitespace/);
});
