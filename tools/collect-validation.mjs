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
 'resolution-limits.json':`${root}/anick-braid-diagnostic/record.json`,
};
// The native-browser report has the same prefix as the UI report.
sources['browser-ui.json']=`${root}/${fs.readdirSync(root).filter(n=>/^browser-\d+$/.test(n)&&fs.existsSync(`${root}/${n}/report.json`)).sort().at(-1)}/report.json`;
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
assert.ok(data['resolution-names.json'].every(c=>c.nativeEquality && c.renamingEquality));
assert.equal(data['ui.json'].examples.length,8);
assert.deepEqual(data['ui.json'].mounts.map(m=>m.mount),['/','/george/']);
assert.deepEqual(data['ui.json'].errors,[]);
assert.deepEqual(data['ui.json'].externalRequests,[]);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const browserFiles=['web/src/app.js','web/src/engine.js','web/src/bergman-syntax.js','web/src/homology.js','web/src/resolution-data.js','web/src/i18n.js','web/src/guide.js','web/src/math.js','web/src/preferences.js','web/src/tutorials.js','web/engine/runner.js','web/engine/worker.js','web/index.html','web/style.css','web/vendor/mathjax/build.json'];
const algebra=data['algebra.json'];
const unitLog=fs.readFileSync(`${root}/unit-tests.log`,'utf8');
const unitTests=Number(/tests (\d+)/.exec(unitLog)[1]);
assert.ok(unitTests>=40,'The actual unit assertions must run, not just test-file processes.');
assert.match(unitLog,/fail 0\b/);
const summary={date:new Date().toISOString(),sources,unitTests:Number(/tests (\d+)/.exec(fs.readFileSync(`${root}/unit-tests.log`,'utf8'))[1]),
 historicalOutputsPerMode:37,extraSessions:20,expectedInvalidBackup:1,formPresets:14,ocamlUpstreamAliases:24,
 basisCases:algebra.filter(c=>c.basisSize!==undefined).length,criticalAmbiguities:algebra.reduce((s,c)=>s+(c.ambiguities||0),0),
 resolutionCases:algebra.filter(c=>c.homology).length,differentialIdentities:algebra.reduce((s,c)=>s+(c.identities||0),0),
 longerNameCases:data['resolution-names.json'].length,longerNameDifferentialIdentities:data['resolution-names.json'].reduce((s,c)=>s+c.identities,0),
 longerNameAmbiguities:data['resolution-names.json'].reduce((s,c)=>s+c.ambiguities,0),unresolvedResolutionCases:1,
 guidedExamples:data['ui.json'].examples.length,staticMounts:data['ui.json'].mounts.map(m=>m.mount),localMathJax:'4.1.3',
 browserSourceHashes:Object.fromEntries(browserFiles.map(p=>[p,sha(p)])),
 vendorTreeHash:crypto.createHash('sha256').update(walk('vendor/bergman-1.001').map(p=>`${p} ${sha(p)}\n`).join('')).digest('hex')};
for(const [name,src] of Object.entries(sources))fs.copyFileSync(src,`${out}/${name}`);
for(const n of ['unit-tests.log','sbcl-legacy.log','sbcl-fixed.log'])fs.copyFileSync(`${root}/${n}`,`${out}/${n}`);
fs.writeFileSync(`${out}/summary.json`,JSON.stringify(summary,null,2)+'\n');console.log(summary);
