// Keep small, reviewable release evidence outside the ignored build directory.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root='build/validation',out='docs/development/validation';fs.mkdirSync(out,{recursive:true});
const latest=prefix=>fs.readdirSync(root).filter(n=>n.startsWith(prefix)&&fs.existsSync(`${root}/${n}/report.json`)).sort((a,b)=>fs.statSync(`${root}/${b}/report.json`).mtimeMs-fs.statSync(`${root}/${a}/report.json`).mtimeMs)[0];
const sources={
 'engine.json':'web/engine/build.json',
 'node-regression.json':`${root}/final-regression/report.json`,
 'algebra.json':`${root}/final-algebra/report.json`,
 'browser-regression.json':`${root}/${latest('browser-native-')}/report.json`,
 'browser-ui.json':`${root}/${latest('browser-')}/report.json`,
 'original-extra.json':`${root}/${latest('extra-')}/report.json`,
 'form-examples.json':`${root}/${latest('examples-')}/report.json`,
 'ocaml-references.json':`${root}/ocaml/references.json`,
 'ui.json':`${root}/${latest('ui-')}/report.json`,
 'resolution-names.json':`${root}/${latest('resolution-names-')}/report.json`,
 'upstream.json':`${root}/${latest('upstream-')}/report.json`,
 'braid.json':`${root}/${latest('braid-')}/report.json`,
 'reader.json':`${root}/${latest('reader-')}/report.json`,
 'resolution-limits.json':`${root}/anick-braid-diagnostic/record.json`,
};
// The native-browser report has the same prefix as the UI report.
sources['browser-ui.json']=`${root}/${fs.readdirSync(root).filter(n=>/^browser-\d+$/.test(n)&&fs.existsSync(`${root}/${n}/report.json`)).sort().at(-1)}/report.json`;
// An isolated release can select its exact reports when other workspace
// sessions are validating a different, unfinished interface concurrently.
if(process.argv[2]){
 const selected=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 for(const [name,src]of Object.entries(selected)){assert.ok(Object.hasOwn(sources,name),name);sources[name]=src;}
}
const data={};for(const [name,src] of Object.entries(sources))data[name]=JSON.parse(fs.readFileSync(src,'utf8'));
const engineTime=Math.max(...['ecl.js','ecl.wasm','ecl.data'].map(n=>fs.statSync(`web/engine/${n}`).mtimeMs));
for(const [name,src] of Object.entries(sources))if(!['engine.json','ocaml-references.json'].includes(name))assert.ok(fs.statSync(src).mtimeMs>=engineTime,`${name}: rerun validation after rebuilding the engine`);
for(const p of ['web/src/app.js','web/index.html','web/style.css'])assert.ok(fs.statSync(sources['browser-ui.json']).mtimeMs>=fs.statSync(p).mtimeMs,`${p}: rerun browser UI checks after changes`);
for(const p of ['web/src/app.js','web/src/bergman-syntax.js','web/src/homology.js','web/src/resolution-data.js','web/engine/runner.js','web/src/i18n.js','web/src/guide.js','web/src/math.js','web/src/preferences.js','web/src/tutorials.js','web/index.html','web/style.css'])assert.ok(fs.statSync(sources['ui.json']).mtimeMs>=fs.statSync(p).mtimeMs,`${p}: rerun guide/preferences/project-path checks after changes`);
assert.equal(data['node-regression.json'].length,2);
assert.equal(data['algebra.json'].length,51);
assert.equal(data['form-examples.json'].length,14);
assert.equal(data['original-extra.json'].length,20);
assert.equal(data['resolution-names.json'].length,20);
assert.equal(data['braid.json'].length,20);
assert.ok(data['braid.json'].every(c=>c.nativeEquality && c.augmentationModuleProjective));
assert.equal(data['resolution-limits.json'].status,'resolved');
assert.ok(data['resolution-names.json'].every(c=>c.nativeEquality && c.renamingEquality));
assert.equal(data['ui.json'].examples.length,8);
assert.equal(data['browser-regression.json'].additional.length,6);
assert.ok(data['browser-regression.json'].additional.every(c=>c.nativeEquality));
assert.deepEqual(data['ui.json'].mounts.map(m=>m.mount),['/','/george/']);
assert.deepEqual(data['ui.json'].errors,[]);
assert.deepEqual(data['ui.json'].externalRequests,[]);
assert.equal(data['ui.json'].debuggerDuringCalculations,false);
assert.equal(data['ui.json'].console.length,2);
assert.deepEqual(data['ui.json'].engine,data['engine.json']);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const reader=data['reader.json'];
assert.deepEqual(reader.engine,data['engine.json']);
assert.equal(reader.nativeCases,8);
assert.deepEqual(reader.modes.map(m=>m.legacy),[false,true]);
for(const mode of reader.modes){assert.equal(mode.cases.length,23);assert.ok(mode.cases.every(c=>c.recovered));assert.ok(mode.successfulComputationAfterErrors&&mode.gcRecovery);}
for(const [p,digest]of Object.entries(reader.sourceHashes))assert.equal(sha(p),digest,p+': rerun reader verification after changes');
for(const [p,digest]of Object.entries(data['ui.json'].sourceHashes))assert.equal(sha(p),digest,p+': UI report sources');
const upstream=data['upstream.json'],fixture=JSON.parse(fs.readFileSync('test/fixtures/upstream-cases.json','utf8'));
assert.equal(upstream.cases.length,90);
assert.equal(upstream.fixtureSha256,sha('test/fixtures/upstream-cases.json'));
assert.deepEqual(upstream.engine,data['engine.json']);
assert.deepEqual(upstream.sources,fixture.sources);
assert.equal(upstream.sympyReference.passed,10);
assert.equal(upstream.sympyReference.sourceSha256,fixture.sources.find(s=>s.repository==='sympy/sympy').sha256);
assert.deepEqual(upstream.engineIdentity,{fixed:'bergman-1.001-fix',legacy:'Bergman 1.001'});
assert.deepEqual(upstream.cases.map(c=>c.id),fixture.cases.flatMap(c=>c.fields.map(p=>c.id+'-F'+p)));
assert.ok(upstream.cases.every(c=>c.nativeEquality&&c.idealEquality&&c.oracleBasisReduction));
assert.equal(upstream.cases.filter(c=>c.sympy?.criticalPairs&&c.sympy?.idealEquality).length,39);
assert.equal(upstream.cases.filter(c=>c.pluralIdealEquality).length,6);
for(const [p,digest]of Object.entries(upstream.validatorHashes))assert.equal(sha(p),digest,p+': rerun upstream validation after changes');
for(const mode of ['legacy','fixed'])assert.match(fs.readFileSync(`${root}/sbcl-${mode}.log`,'utf8'),new RegExp('37 exact outputs passed'));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const browserFiles=[...fs.readdirSync('web/src').filter(n=>n.endsWith('.js')).map(n=>'web/src/'+n),'web/engine/runner.js','web/engine/worker.js','web/index.html','web/style.css','web/vendor/mathjax/build.json'];
const algebra=data['algebra.json'];
const unitLog=fs.readFileSync(`${root}/unit-tests.log`,'utf8');
const unitTests=Number(/tests (\d+)/.exec(unitLog)[1]);
assert.ok(unitTests>=43,'The actual unit assertions, including weighted homology certification, must run, not just test-file processes.');
assert.match(unitLog,/fail 0\b/);
const summary={date:new Date().toISOString(),sources,unitTests:Number(/tests (\d+)/.exec(fs.readFileSync(`${root}/unit-tests.log`,'utf8'))[1]),
 appVersion:JSON.parse(fs.readFileSync('package.json','utf8')).version,
 readerRecoveryCases:reader.modes.reduce((s,m)=>s+m.cases.length,0),nativeReaderCases:reader.nativeCases,consoleMounts:data['ui.json'].console.map(c=>c.mount),
 historicalOutputsPerMode:37,extraSessions:20,expectedInvalidBackup:1,formPresets:14,ocamlUpstreamAliases:24,
 basisCases:algebra.filter(c=>c.basisSize!==undefined).length,criticalAmbiguities:algebra.reduce((s,c)=>s+(c.ambiguities||0),0),
 resolutionCases:algebra.filter(c=>c.homology).length,differentialIdentities:algebra.reduce((s,c)=>s+(c.identities||0),0),
 longerNameCases:data['resolution-names.json'].length,longerNameDifferentialIdentities:data['resolution-names.json'].reduce((s,c)=>s+c.identities,0),
 longerNameAmbiguities:data['resolution-names.json'].reduce((s,c)=>s+c.ambiguities,0),
 upstreamCases:upstream.cases.length,upstreamSources:upstream.sources.length,
 upstreamCompleteCases:upstream.cases.filter(c=>c.scope==='complete').length,
 upstreamBoundedCases:upstream.cases.filter(c=>c.scope==='degree-bound').length,
 upstreamAmbiguities:upstream.cases.reduce((s,c)=>s+c.ambiguities,0),sympyCases:39,sympyOriginalTests:10,pluralCases:6,
 upstreamValidatorHashes:upstream.validatorHashes,
 braidCases:data['braid.json'].length,braidDifferentialIdentities:data['braid.json'].reduce((s,c)=>s+c.identities,0),
 braidAmbiguities:data['braid.json'].reduce((s,c)=>s+c.ambiguities,0),unresolvedResolutionCases:0,
 additionalBrowserCases:data['browser-regression.json'].additional.length,
 guidedExamples:data['ui.json'].examples.length,staticMounts:data['ui.json'].mounts.map(m=>m.mount),localMathJax:'4.1.3',
 browserSourceHashes:Object.fromEntries(browserFiles.map(p=>[p,sha(p)])),
 vendorTreeHash:crypto.createHash('sha256').update(walk('vendor/bergman-1.001').map(p=>`${p} ${sha(p)}\n`).join('')).digest('hex')};
for(const [name,src] of Object.entries(sources))fs.copyFileSync(src,`${out}/${name}`);
for(const n of ['unit-tests.log','sbcl-legacy.log','sbcl-fixed.log'])fs.copyFileSync(`${root}/${n}`,`${out}/${n}`);
fs.writeFileSync(`${out}/summary.json`,JSON.stringify(summary,null,2)+'\n');console.log(summary);
