import test from 'node:test';
import assert from 'node:assert/strict';
import {assessBergmanRegression} from '../tools/bergman-regression.mjs';
import {powerSignature,summarizeEnvironment} from '../tools/benchmark-environment.mjs';

function comparison(ratio=1) {
  const snapshot={cpuLimitsKnown:true,policies:[{name:'synthetic-policy',governor:'baseline',limit:'baseline'}],
    power:[{name:'AC',online:0,status:null}],availableMiB:4096,swapUsedMiB:0,swapInPages:0,swapOutPages:0,majorFaults:0};
  return {state:'complete',degrees:[6],rows:[0,1,2].flatMap(trial=>['compiled-previous','compiled'].map(id=>({
    id,trial,degree:6,status:'complete',jobScriptSha256:'same script',inputFilesSha256:'same input',memoryMiB:4095,timeLimitSeconds:60,
    jobWallSeconds:id==='compiled'?10*ratio:10,coldWallSeconds:id==='compiled'?10*ratio+1:11,
    basisSha256:'same complete basis',outputHasDone:true,environment:{userAgent:'same browser'},
    hostEnvironment:summarizeEnvironment([structuredClone(snapshot),structuredClone(snapshot)])}))) };
}
test('Matched repeated Bergman timings pass or detect a slowdown',()=>{
  assert.equal(assessBergmanRegression(comparison(1.02)).state,'passed');
  assert.equal(assessBergmanRegression(comparison(1.30)).state,'regression');
});
test('Changes in CPU limits within or between runs yield an inconclusive comparison',()=>{
  const between=comparison();between.rows[1].hostEnvironment.first.policies[0].limit='changed';
  assert.equal(assessBergmanRegression(between).state,'inconclusive');
  const within=comparison();within.rows[1].hostEnvironment.stablePower=false;
  assert.equal(assessBergmanRegression(within).state,'inconclusive');
});
test('Power signatures respond to policy and power-source changes',()=>{
  const r=comparison(),a=r.rows[0].hostEnvironment.first,b=structuredClone(a);
  assert.equal(powerSignature(a),powerSignature(b));
  b.power[0].online=1;
  assert.notEqual(powerSignature(a),powerSignature(b));
});
test('Missing conditions, censored runs and duplicate trials cannot pass',()=>{
  for(const change of [r=>{delete r.rows[0].hostEnvironment;},r=>{r.rows[0].status='timeout';},
    r=>{r.rows[0].trial=1;},r=>{r.rows.pop();},r=>{r.rows[0].hostEnvironment.first.cpuLimitsKnown=false;}]){
    const r=comparison();change(r);assert.equal(assessBergmanRegression(r).state,'inconclusive');
  }
});
test('Different inputs, scripts, heaps, browsers and outputs cannot pass',()=>{
  for(const [key,value]of [['inputFilesSha256','different'],['jobScriptSha256','different'],['memoryMiB',2048],
    ['basisSha256','different'],['outputHasDone',false]]){
    const r=comparison();r.rows[1][key]=value;assert.equal(assessBergmanRegression(r).state,'inconclusive');
  }
  const r=comparison();r.rows[1].environment.userAgent='different';assert.equal(assessBergmanRegression(r).state,'inconclusive');
});
test('Excess timing spread and memory pressure cannot pass',()=>{
  const noisy=comparison();noisy.rows[1].jobWallSeconds=16;
  assert.equal(assessBergmanRegression(noisy).state,'inconclusive');
  const swapping=comparison();swapping.rows[1].hostEnvironment.swapInPages=5000;
  assert.equal(assessBergmanRegression(swapping).state,'inconclusive');
});
test('Environment summaries record changes and actual swap activity',()=>{
  const a=comparison().rows[0].hostEnvironment.first,b=structuredClone(a);
  b.swapInPages=17;b.swapOutPages=3;b.availableMiB=2048;b.policies[0].limit='changed';
  const summary=summarizeEnvironment([a,b]);
  assert.equal(summary.stablePower,false);assert.equal(summary.powerConfigurations.length,2);
  assert.equal(summary.swapInPages,17);assert.equal(summary.swapOutPages,3);assert.equal(summary.minAvailableMiB,2048);
});
