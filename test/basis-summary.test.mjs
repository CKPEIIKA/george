import test from 'node:test';
import assert from 'node:assert/strict';
import {basisSummary} from '../web/src/basis-summary.js';
import {elapsedSeconds} from '../web/src/elapsed-time.js';
import {nextBasisPreview} from '../web/src/basis-preview.js';

test('truncated text cannot change full basis totals or completed degree', () => {
  const groups = [{deg:2,polys:Array(100).fill('a^2')},{deg:9,polys:Array(1055).fill('a^9')}];
  const summary = basisSummary(groups, false, {fomkyr:{basisSize:2155,completedThroughDegree:10,complete:true,previewTruncated:true,
    basisByDegree:[{degree:2,count:100},{degree:9,count:1351},{degree:10,count:704}]}});
  assert.equal(summary.total,2155);assert.equal(summary.shown,1155);
  assert.equal(summary.completedThroughDegree,10);assert.equal(summary.complete,true);
  assert.deepEqual(summary.degrees,[2,9,10]);assert.equal(summary.groups[2].polys.length,0);
  assert.equal(summary.groups[2].count,704);assert.equal(summary.truncated,true);
});
test('Bergman text and interrupted computations retain their completion semantics', () => {
  const groups=[{deg:2,polys:['a^2','b^2']}];
  assert.equal(basisSummary(groups,true).total,2);
  assert.equal(basisSummary(groups,true).complete,true);
  assert.equal(basisSummary(groups,false).complete,false);
  assert.equal(basisSummary(groups,true,{interrupted:true,fomkyr:{complete:true}}).complete,false);
});
test('elapsed counter has fixed decimals and stays in seconds across thresholds', () => {
  for (const value of [0,1,999,1000,9999,10000,59999,60000,800000]) {
    assert.match(elapsedSeconds(value,'en'),/^\d+\.\d$/);
    assert.match(elapsedSeconds(value,'ru'),/^\d+,\d$/);
  }
  assert.equal(elapsedSeconds(1000),'1.0');assert.equal(elapsedSeconds(60000),'60.0');
});
test('successive disk preview pages reconstruct all polynomials without splitting powers', async () => {
  const source='% 2\na^2,\nb^2,\n\n% 3\na*b*c,\nc*b*a,\nDone\n', file=new Blob([source]);
  let offset=0, text='',pages=0, truncated=true;
  while(truncated) {
    const next=await nextBasisPreview(file,offset,12);
    assert.ok(next.offset>offset);offset=next.offset;text+=next.text;truncated=next.truncated;pages++;
  }
  assert.equal(text,source);assert.ok(pages>1);assert.equal(offset,file.size);
});
