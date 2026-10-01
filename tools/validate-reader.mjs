// Exercise the real bridge repeatedly after failed reads; no console guards.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {wasmRuntime} from '../test/support/regression.mjs';

const out=process.argv[2]||`build/validation/reader-${Date.now()}`;
fs.mkdirSync(out,{recursive:true});
const native=path.resolve(process.env.BERGMAN_SBCL||'build/sbcl-reader-02-v2-20260930/bin/clisp/unix/bergman');
const nativeSource=`
(PROGN
 (DOLIST (legacy '(T NIL))
  (SETLEGACYMODE legacy)
  (DOLIST (command '(RATOM ALGFORMINPUT ADDALGFORMINPUT REDANDALGIN))
   (LET ((table CL:*READTABLE*) (case (CL:READTABLE-CASE CL:*READTABLE*))
         (raised *RAISE) (CL:*STANDARD-INPUT* (CL:MAKE-STRING-INPUT-STREAM "")))
    (CL:ASSERT (CL:HANDLER-CASE (PROGN (CL:FUNCALL command) NIL)
                (CL:END-OF-FILE () T)))
    (CL:ASSERT (CL:EQ table CL:*READTABLE*))
    (CL:ASSERT (CL:EQ case (CL:READTABLE-CASE CL:*READTABLE*)))
    (CL:ASSERT (CL:EQ raised *RAISE))))
  (CL:ASSERT (= (+ 1 2) 3)))
 (CL:FORMAT T "~&READER-NATIVE:8 PASS~%"))
(QUIT)
`;
const n=spawnSync(native,[],{input:nativeSource,encoding:'utf8',timeout:30000,maxBuffer:2e6});
fs.writeFileSync(`${out}/native.log`,(n.stdout||'')+(n.stderr||''));
assert.ifError(n.error);assert.equal(n.status,0);assert.match(n.stdout,/READER-NATIVE:8 PASS/);

const enginePath=path.resolve(process.env.GEORGE_ENGINE_DIR||'web/engine');
const manifest=[path.join(enginePath,'build.json'),path.join(enginePath,'../build.json')].find(p=>fs.existsSync(p));
const engine=manifest?JSON.parse(fs.readFileSync(manifest,'utf8')):{files:Object.fromEntries(['ecl.js','ecl.wasm','ecl.data'].map(name=>[name,{sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(enginePath,name))).digest('hex')}]))};
const report={engine,nativeCases:8,modes:[],sourceHashes:{}};
for(const legacy of [false,true]){
 let output='';const rt=await wasmRuntime({onOutput:s=>{output+=s+'\n';}});
 const evaluate=(source)=>{output='';const status=rt.m.ccall('george_eval','number',['string','number'],[source,1]);return {status,stdout:output};};
 const expect=(source,re)=>{const r=evaluate(source);assert.equal(r.status,0,source+'\n'+r.stdout);if(re)assert.match(r.stdout,re,source);return r;};
 assert.equal(expect('t').stdout.trim(),'T','no startup value leaks into first result');
 expect(`(setlegacymode ${legacy?'t':'nil'})`);
 expect('(setq reader-marker 123)');
 expect('(setmaxdeg 6)');expect('(noncommify)');
 rt.m.FS.writeFile('/work/preserved.txt','keep this file');
 rt.m.FS.writeFile('/work/empty.txt','');
 rt.m.FS.writeFile('/work/broken.bg','(algforminput)\nvars x,y; x*');
 const cases=[
  ['(simple)',/Keyboard input is unavailable/],
  ['(simple "missing.bg" "out.gb")',/Cannot open "missing.bg"/],
  ['(progn (simple "missing.bg" "out.gb"))',/Cannot open/],
  ['(eval \'(simple))',/Keyboard input is unavailable/],
  ['(anick)',/Keyboard input is unavailable/],
  ['(anick "missing.bg" "out.gb")',/Cannot open/],
  ['(hilbert)',/Keyboard input is unavailable/],
  ['(hilbert "missing.bg" "out.gb" "out.hs")',/Cannot open/],
  ['(rabbit "missing.bg" "out.gb")',/Cannot open/],
  ['(modulebettinumbers "missing.bg" "out.gb")',/Cannot open/],
  ['(ncpbhgroebner "missing.bg" "out.gb" "out.pb" "out.hs")',/Cannot open/],
  ['(read)',/Keyboard input is unavailable/],
  ['(ratom)',/Keyboard input is unavailable/],
  ['(algforminput)',/Keyboard input is unavailable/],
  ['(addalgforminput)',/Keyboard input is unavailable/],
  ['(redandalgin)',/Keyboard input is unavailable/],
  ['(progn (rds nil) (ratom))',/Keyboard input is unavailable/],
  ['(with-open-file (s "empty.txt") (rds s) (ratom))',/end of file/i],
  ['(with-open-file (s "redirected.txt" :direction :output :if-exists :supersede) (wrs s) (cl:error "redirect recovery"))',/redirect recovery/],
  ['(with-input-from-string (s "") (let ((cl:*standard-input* s)) (ratom)))',/end of file/i],
  ['(simple "broken.bg" "out.gb")',/end of file/i],
  ['(+ 1',/end of file/i],
  ['(progn (off raise) (cl:error "raise recovery"))',/raise recovery/],
 ];
 const rows=[];
 for(const [source,error]of cases){
  const r=evaluate(source);assert.equal(r.status,1,source+' should fail');assert.match(r.stdout,error,source);
  fs.appendFileSync(`${out}/${legacy?'legacy':'fixed'}.log`,source+'\n'+r.stdout);
  expect('(list reader-marker (+ 1 2))',/\(123 3\)/);
  assert.equal(rt.m.FS.readFile('/work/preserved.txt',{encoding:'utf8'}),'keep this file');
  rows.push({source,recovered:true});
 }
 // Reset partially parsed algebra input, then compute in the same runtime.
 expect('(clearring)');
 rt.m.FS.writeFile('/work/input.bg','(noncommify)\n(setmaxdeg 6)\n(algforminput)\nvars x,y; x*y, x^2-y^2;\n');
 expect('(simple "input.bg" "out.gb")');
 expect('(clearring)');
 assert.match(rt.m.FS.readFile('/work/out.gb',{encoding:'utf8'}),/x\^3/);
 expect('(list reader-marker (+ 1 2))',/\(123 3\)/);
 expect('(ext:gc)');expect('(list reader-marker (+ 1 2))',/\(123 3\)/);
 report.modes.push({legacy,cases:rows,successfulComputationAfterErrors:true,gcRecovery:true});
 console.log(`${legacy?'legacy':'fixed'}: ${rows.length} sequential errors recovered; same-session computation and GC passed`);
}
for(const p of ['ports/common/reader-patches.py','ports/ecl/boot.lisp','ports/ecl/bridge.c','tools/validate-reader.mjs'])report.sourceHashes[p]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
console.log(out);
