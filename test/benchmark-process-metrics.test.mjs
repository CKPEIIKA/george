import test from 'node:test';
import assert from 'node:assert/strict';
import {processMetrics} from '../tools/benchmark-process-metrics.mjs';

const sampled={cpuSeconds:360,peakRssMiB:355,peakPssMiB:351};

test('successful child retains GNU time CPU and peak RSS',()=>{
 const m=processMetrics([200,20,400*1024],sampled,0,100);
 assert.equal(m.cpuSeconds,220);assert.equal(m.averageCpuPercent,220);
 assert.equal(m.peakRssMiB,400);assert.equal(m.peakPssMiB,351);
 assert.equal(m.rssSource,'gnu-time');assert.equal(m.sampledPeaksAreLowerBounds,false);
});

test('forced timeout uses process samples even when wrapper rusage is nonzero',()=>{
 const m=processMetrics([0.01,0,2200],sampled,137,120);
 assert.equal(m.cpuSeconds,360);assert.equal(m.averageCpuPercent,300);
 assert.equal(m.peakRssMiB,355);assert.equal(m.peakPssMiB,351);
 assert.equal(m.rssSource,'sampled-process-tree');assert.equal(m.sampledPeaksAreLowerBounds,true);
 assert.equal(m.gnuTimePeakRssMiB,2200/1024);
});

test('missing time output uses samples',()=>{
 const m=processMetrics([],sampled,0,100);
 assert.equal(m.cpuSeconds,360);assert.equal(m.peakRssMiB,355);
 assert.equal(m.gnuTimePeakRssMiB,null);
});
