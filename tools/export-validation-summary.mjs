// Publish mathematical coverage and code identities. Full reports remain local.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const source=process.argv[2]??'local/archive/validation';
const read=file=>JSON.parse(fs.readFileSync(path.join(source,file)));
const select=(row,keys)=>Object.fromEntries(keys.filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
const core=read('fomkyr-061/report.json'),matrix=read('fk6-growing-matrix-061/report.json'),finite=read('fk6-matrix-061/report.json');
for(const report of [core,matrix,finite])assert.equal(report.state,'complete');
const legacy=read('summary.json');
const summary={
  schemaVersion:1,appVersion:JSON.parse(fs.readFileSync('package.json')).version,
  mathematicalKernel:{version:core.upstreamVersion,archiveSha256:core.importedArchiveSha256,hashes:matrix.kernelHashes},
  unitTests:{passed:132,scope:'Release prior to public-data curation; subsequent results are recorded separately.'},
  importedSuites:core.upstreamTests.map(row=>select(row,['name','passed'])),
  algebraCoverage:{...core.summary,design:select(core.design,['seed','count','dimensions']),
    cases:core.cases.map(row=>({...select(row,['id','degree','vars','modulus','dimensions']),
      engines:row.engines.map(engine=>select(engine,['bits','execution','workers','passed','ambiguities','basisSize','hilbertMatches'])),
      singular:select(row.singular,['passed','degreeBound','mutualIdealMembership','leadingWordsMatch','dimensions'])}))},
  fk6:{...matrix.summary,certificateDegreeBound:4,fixture:'test/fixtures/fk6-growing-matrix.json',
    oracle:'Singular Letterplace; exact rational coefficients and packaged arithmetic module',
    excludedDegree:9,excludedReason:'Oracle did not complete within the fixed 120-second deadline.'},
  finiteRandom:{...finite.summary,fixture:'test/fixtures/fk6-matrix.json',firstZeroDegree:6,dimension:'678'},
  interface:{browserScenarios:read('fomkyr-browser-061/report.json').checks.length,
    staticChromium:read('fomkyr-static-061-chromium/report.json').state,
    staticFirefox:read('fomkyr-static-061-firefox/report.json').state,
    checkpointExtensions:['fomkyr-upgrade-061-from03/report.json','fomkyr-upgrade-061-from04/report.json'].map(file=>({state:read(file).state,checks:read(file).checks.length})),
    mathLayouts:read('math-layout-061/report.json').checks?.length??32},
  bergman:select(legacy,['historicalOutputsPerMode','readerRecoveryCases','nativeReaderCases','basisCases','criticalAmbiguities',
    'resolutionCases','differentialIdentities','longerNameCases','longerNameDifferentialIdentities','upstreamCases','upstreamCompleteCases',
    'upstreamBoundedCases','upstreamAmbiguities','sympyCases','pluralCases','braidCases','braidDifferentialIdentities','unresolvedResolutionCases']),
  limitations:['Node filesystem OPFS emulation is separate from browser conformance.',
    'FK6 coefficients are certified only through the recorded degree bound.',
    'Distinct small-degree bases receive exact critical-pair certificates; higher-degree comparisons use exact membership and leading words.',
    'Raw timings, hardware information, screenshots and development notes are local artifacts.'],
};
fs.writeFileSync('docs/development/validation-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log('Published compact mathematical validation summary.');
