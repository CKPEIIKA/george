// Keep small, reviewable release evidence outside the ignored build directory.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root='build/validation',out='docs/validation';fs.mkdirSync(out,{recursive:true});
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
};
// The native-browser report has the same prefix as the UI report.
sources['browser-ui.json']=`${root}/${fs.readdirSync(root).filter(n=>/^browser-\d+$/.test(n)&&fs.existsSync(`${root}/${n}/report.json`)).sort().at(-1)}/report.json`;
const data={};for(const [name,src] of Object.entries(sources)){data[name]=JSON.parse(fs.readFileSync(src,'utf8'));fs.copyFileSync(src,`${out}/${name}`);}
const engineTime=Math.max(...['ecl.js','ecl.wasm','ecl.data'].map(n=>fs.statSync(`web/engine/${n}`).mtimeMs));
for(const [name,src] of Object.entries(sources))if(!['engine.json','ocaml-references.json'].includes(name))assert.ok(fs.statSync(src).mtimeMs>=engineTime,`${name}: rerun validation after rebuilding the engine`);
for(const p of ['web/src/app.js','web/index.html','web/style.css'])assert.ok(fs.statSync(sources['browser-ui.json']).mtimeMs>=fs.statSync(p).mtimeMs,`${p}: rerun browser UI checks after changes`);
assert.equal(data['node-regression.json'].length,2);
assert.equal(data['algebra.json'].length,51);
assert.equal(data['form-examples.json'].length,14);
assert.equal(data['original-extra.json'].length,20);
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const browserFiles=['web/src/app.js','web/src/engine.js','web/src/bergman-syntax.js','web/src/homology.js','web/engine/runner.js','web/engine/worker.js','web/index.html','web/style.css'];
const algebra=data['algebra.json'];
const summary={date:new Date().toISOString(),sources,unitTests:Number(/tests (\d+)/.exec(fs.readFileSync(`${root}/unit-tests.log`,'utf8'))[1]),
 historicalOutputsPerMode:37,extraSessions:20,expectedInvalidBackup:1,formPresets:14,ocamlUpstreamAliases:24,
 basisCases:algebra.filter(c=>c.basisSize!==undefined).length,criticalAmbiguities:algebra.reduce((s,c)=>s+(c.ambiguities||0),0),
 resolutionCases:algebra.filter(c=>c.homology).length,differentialIdentities:algebra.reduce((s,c)=>s+(c.identities||0),0),
 browserSourceHashes:Object.fromEntries(browserFiles.map(p=>[p,sha(p)])),
 vendorTreeHash:crypto.createHash('sha256').update(walk('vendor/bergman-1.001').map(p=>`${p} ${sha(p)}\n`).join('')).digest('hex')};
fs.writeFileSync(`${out}/summary.json`,JSON.stringify(summary,null,2)+'\n');console.log(summary);
for(const n of ['unit-tests.log','sbcl-legacy.log','sbcl-fixed.log'])fs.copyFileSync(`${root}/${n}`,`${out}/${n}`);
