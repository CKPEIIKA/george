// Copy only the browser components needed by the local SVG renderer.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const target = 'web/vendor/mathjax';
const packages = ['node_modules/mathjax', 'node_modules/@mathjax/mathjax-newcm-font'];
const versions = packages.map(p => JSON.parse(fs.readFileSync(`${p}/package.json`, 'utf8')));
assert.equal(versions[0].version, '4.1.3');
assert.equal(versions[1].version, '4.1.3');
fs.mkdirSync(`${target}/newcm`, { recursive: true });
for (const p of ['tex-svg.js', 'LICENSE']) fs.copyFileSync(`${packages[0]}/${p}`, `${target}/${p}`);
fs.cpSync(`${packages[0]}/input/tex`, `${target}/input/tex`, { recursive: true });
// The combined v4 component initializes the SRE worker even with speech UI
// disabled. Keep its worker and rule data local so startup can finish.
fs.cpSync(`${packages[0]}/a11y`, `${target}/a11y`, { recursive: true });
fs.mkdirSync(`${target}/sre`, { recursive: true });
fs.copyFileSync(`${packages[0]}/sre/speech-worker.js`, `${target}/sre/speech-worker.js`);
fs.cpSync(`${packages[0]}/sre/mathmaps`, `${target}/sre/mathmaps`, { recursive: true });
fs.copyFileSync(`${packages[1]}/svg.js`, `${target}/newcm/svg.js`);
fs.cpSync(`${packages[1]}/svg`, `${target}/newcm/svg`, { recursive: true });
const notice = `MathJax ${versions[0].version} and MathJax New Computer Modern SVG data ${versions[1].version}.\nLicensed under Apache-2.0; see LICENSE.\nCopyright the MathJax Consortium and contributors; upstream notices remain in the component files.\nSources: https://github.com/mathjax/MathJax and https://github.com/mathjax/MathJax-fonts.\nPackage versions and integrity values are pinned in George's package-lock.json.\nThe SVG renderer and glyph data are served locally; no CDN or font binary is used.\n`;
fs.writeFileSync(`${target}/NOTICE.txt`, notice);
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]).sort();
const files = Object.fromEntries(walk(target).filter(p => !p.endsWith('/build.json')).map(p => [path.relative(target, p), {
  bytes: fs.statSync(p).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),
}]));
fs.writeFileSync(`${target}/build.json`, JSON.stringify({ mathjax: versions[0].version, svgFont: versions[1].version, files }, null, 2) + '\n');
console.log(`Packaged ${Object.keys(files).length} local MathJax files.`);
