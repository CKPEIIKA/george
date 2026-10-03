// Mathematical references survive candidate engine upgrades. Failed jobs are not cached.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {digest, stableJSON, inventory, writeJSON} from './release-support.mjs';

export function singularIdentity(root) {
  return {kind:'Singular', files:inventory([path.join(root, 'usr/bin/Singular'),
    path.join(root, 'usr/share/singular/LIB'), path.join(root, 'usr/lib'), 'tools/oracle-packages.json'])};
}
export function bergmanIdentity() {
  return {kind:'Bergman compiled', files:inventory(['web/engine/compiled', 'web/engine/runner.js',
    'test/support/backend-worker.mjs', 'test/support/backend-client.mjs', 'test/support/regression.mjs', 'web/src/bergman-syntax.js'],
  file => !file.endsWith('/build.json'))};
}
export class OracleCache {
  constructor({directory='local/oracle-cache', refresh=false} = {}) {
    this.directory = path.resolve(directory); this.refresh = refresh;
    this.hits = 0; this.misses = 0;
  }
  async obtain(kind, input, oracle, compute, validate) {
    const contract = {schema:1, kind, input, oracle};
    const key = digest(stableJSON(contract)), file = path.join(this.directory, kind, key + '.json');
    if (!this.refresh && fs.existsSync(file)) {
      const record = JSON.parse(fs.readFileSync(file));
      assert.equal(record.key, key, 'Oracle cache identity mismatch: ' + file);
      assert.deepEqual(record.contract, contract);
      assert.equal(record.valueSha256, digest(stableJSON(record.value)), 'Oracle cache is damaged: ' + file);
      assert.equal(record.state, 'complete'); validate(record.value);
      this.hits++; return {value:record.value, reused:true, key};
    }
    this.misses++;
    const start = performance.now(), value = await compute();
    validate(value);
    writeJSON(file, {key, contract, state:'complete', createdAt:new Date().toISOString(),
      elapsedSeconds:(performance.now() - start) / 1000, valueSha256:digest(stableJSON(value)), value});
    return {value, reused:false, key};
  }
}
