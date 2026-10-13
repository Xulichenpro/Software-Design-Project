import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApplicationBootstrap } from '../../src/bootstrap/ApplicationBootstrap.js';
import type { Terminal } from '../../src/application/contracts/Terminal.js';
import { SvgXmlCodec } from '../../src/infrastructure/svg/SvgXmlCodec.js';
import { ShapeFactory } from '../../src/domain/factory/ShapeFactory.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const entry=fileURLToPath(new URL('../../src/bootstrap/main.ts',import.meta.url));
function runScript(lines: readonly string[], npm=false): Promise<{code:number|null;out:string;err:string}> {
  const executable=npm && process.platform==='win32' ? process.env.ComSpec ?? 'cmd.exe' : npm ? 'npm' : process.execPath;
  const args=npm ? process.platform==='win32' ? ['/d','/s','/c','npm run cli'] : ['run','cli'] : ['--import','tsx',entry];
  const child=spawn(executable,args,{cwd:root,stdio:'pipe',windowsHide:true});
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
  let out='',err=''; child.stdout.on('data',chunk => {out+=chunk;}); child.stderr.on('data',chunk => {err+=chunk;});
  return new Promise((resolve,reject) => {
    const timeout=setTimeout(() => {child.kill();reject(new Error('CLI process timed out'));},15000);
    child.on('error',error => {clearTimeout(timeout);reject(error);});
    child.on('close',code => {clearTimeout(timeout);resolve({code,out,err});});
    child.stdin.end(lines.join('\n'));
  });
}
function decode(text:string){return new SvgXmlCodec(new ShapeFactory()).decode(text).tree;}

test('bootstrap supports injected terminal while composing shared receivers and real IO', async () => {
  const lines=['init','create g parent','create rect r 1 2 3 4 in parent','move parent 10 20','show r','undo','show r'];
  const output:string[]=[]; let index=0; let closed=false;
  const terminal:Terminal={async readLine(){return lines[index++];},writeLine(text){output.push(text);},close(){closed=true;}};
  await new ApplicationBootstrap(terminal).run();
  assert.ok(output.includes('g#parent moved by (10,20)')); assert.ok(output.includes('  x=11 y=22 w=3 h=4'));
  assert.ok(output.includes('  x=1 y=2 w=3 h=4')); assert.ok(output.includes('rect#r  parent=g#parent')); assert.equal(closed,true);
});

test('real entry replays complete phase 6 transcript, imports unnamed nodes and saves/reads again', async () => {
  const dir=await mkdtemp(join(tmpdir(),'svg-phase6-'));
  try {
    const demo=join(dir,'demo.svg'), other=join(dir,'other.svg'), copied=join(dir,'copied.svg');
    await writeFile(other,'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect x="0" y="0" width="400" height="300" fill="#ffffff"/><text id="t1" x="10" y="290">imported</text><circle id="c1" cx="50" cy="50" r="10"/><g id="g1"><rect id="r2" x="0" y="0" width="10" height="10"/><circle id="c2" cx="5" cy="5" r="2"/></g><ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/></svg>');
    const result=await runScript([
      'init 800 600','create rect bg 0 0 800 600 #ffffff','create text title 20 40 "My Diagram"',
      'create circle c1 100 100 20 red','create rect box 200 80 60 60 #3366ff','group markers c1 box','tree',
      'move c1 30 0','undo','redo','set title text "My Diagram v2"','undo','group bad c1 markers',
      'delete box','undo','save '+JSON.stringify(demo),'undo','read '+JSON.stringify(other),'tree',
      'save '+JSON.stringify(copied),'read '+JSON.stringify(copied),'tree g1',
    ]);
    assert.equal(result.code,0,result.err); assert.equal(result.err,'');
    for(const text of ['g#markers created with 2 children','circle#c1 moved to (130,100)',
      'circle#c1 moved back to (100,100)','text#title updated: text="My Diagram v2"',
      'text#title updated: text="My Diagram"','error: cannot group a container into its own descendant: markers',
      'rect#box restored into g#markers','error: undo not allowed after io command',
      'warning: assigned id rect1 to unnamed <rect>','svg (400x300)','ellipse#e1  cx=1 cy=2 rx=3 ry=4'])
      assert.ok(result.out.includes(text),text);
    assert.equal((result.out.match(/error:/g)??[]).length,2);
    const saved=decode(await readFile(demo,'utf8')); assert.equal(saved.shapes.length,5);
    assert.equal(saved.findShape('c1').getAttribute('cx'),'130'); assert.equal(saved.findShape('title').getAttribute('text'),'My Diagram');
    const reimported=decode(await readFile(copied,'utf8')); assert.equal(reimported.shapes.length,7);
    assert.equal(reimported.findShape('r2').parent,reimported.findShape('g1'));
    assert.match(result.out,/g#g1\r?\n├── rect#r2/);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('real entry replays phase 6.1 version A flowchart with eight nested elements and Unicode', async () => {
  const dir=await mkdtemp(join(tmpdir(),'svg-flowchart-'));
  try {
    const path=join(dir,'flowchart.svg');
    const result=await runScript([
      'init 800 600','create g flowchart','create g node1 in flowchart','create rect start 120 100 160 60 #4a90d9 in node1',
      'create text start-label 155 135 "开始" in node1','create g node2 in flowchart',
      'create rect process 520 100 160 60 #f5a623 in node2','create text process-label 545 135 "处理数据" in node2',
      'create line arrow1 280 130 520 130 black in flowchart','tree','move node2 0 100','undo',
      'set process-label text "处理数据 v2"','save '+JSON.stringify(path),'read '+JSON.stringify(path),'tree',
    ]);
    assert.equal(result.code,0,result.err); assert.equal(result.err,''); assert.ok(!result.out.includes('error:'));
    assert.ok(result.out.includes('g#node2 moved by (0,100)')); assert.ok(result.out.includes('g#node2 moved back by (0,-100)'));
    assert.ok(result.out.includes('text#process-label updated: text="处理数据 v2"'));
    assert.ok(result.out.includes('(8 elements)')); assert.ok(result.out.includes('line#arrow1  (280,130) -> (520,130)'));
    const tree=decode(await readFile(path,'utf8')); assert.equal(tree.shapes.length,8);
    assert.equal(tree.findShape('process').getAttribute('y'),'100'); assert.equal(tree.findShape('process-label').getAttribute('y'),'135');
    assert.equal(tree.findShape('start-label').getAttribute('text'),'开始');
    assert.equal(tree.findShape('process-label').getAttribute('text'),'处理数据 v2');
    assert.equal(tree.findShape('node2').parent,tree.findShape('flowchart'));
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('real npm run cli consumes all piped lines, recovers from errors and executes final commands', async () => {
  const dir=await mkdtemp(join(tmpdir(),'svg-npm-cli-'));
  try {
    const path=join(dir,'saved.svg');
    const result=await runScript([
      'help','undo','redo','read '+JSON.stringify(join(dir,'missing.svg')),'init','create box bad',
      'create rect alive 1 2 3 4','move alive 1 2','save '+JSON.stringify(join(dir,'missing-dir','bad.svg')),
      'undo','save '+JSON.stringify(path),'undo','create g after','tree',
    ],true);
    assert.equal(result.code,0,result.err); assert.equal(result.err,'');
    assert.ok(result.out.includes("svg-editor 0.1 — type 'help' for commands"));
    assert.equal((result.out.match(/error:/g)??[]).length,6);
    assert.ok(result.out.includes("error: no document. use 'init' or 'read' first"));
    assert.ok(result.out.includes('unknown shape type: box')); assert.ok(result.out.includes('cannot write file:'));
    assert.ok(result.out.includes('rect#alive moved back to (1,2)')); assert.ok(result.out.includes('error: undo not allowed after io command'));
    assert.ok(result.out.includes('g#after created')); assert.match(result.out,/└── g#after/);
    const tree=decode(await readFile(path,'utf8')); assert.equal(tree.shapes.length,1); assert.equal(tree.findShape('alive').getAttribute('x'),'1');
  } finally {await rm(dir,{recursive:true,force:true});}
});
