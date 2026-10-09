import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOMKYR_DEFAULTS, FOMKYR_TUNING, tuningProfile, fomkyrEngineOptions } from '../web/src/fomkyr-options.js';
import { tutorialForm } from '../web/src/tutorials.js';

test('tuning profiles are recognised from option values', () => {
  assert.equal(tuningProfile({}), 'balanced');
  for (const name of Object.keys(FOMKYR_TUNING)) assert.equal(tuningProfile({ ...FOMKYR_DEFAULTS, ...FOMKYR_TUNING[name] }), name);
  assert.equal(tuningProfile({ cachePercent: 7 }), 'custom');
  // Mathematical choices and storage preferences do not change the profile.
  assert.equal(tuningProfile({ dimensionEvidence: 'fk6-20', hilbert: true, resume: false, progress: false }), 'balanced');
  assert.equal(tuningProfile(tutorialForm('fk6').fomkyrOptions), 'large');
});

test('profiles never add mathematical assumptions', () => {
  for (const profile of Object.values(FOMKYR_TUNING))
    for (const key of ['dimensionEvidence', 'dimensionText', 'hilbertGate', 'hilbertSectors', 'gateMiB', 'hilbert'])
      assert.equal(Object.hasOwn(profile, key), false, key);
});

test('new fomkyr options reach the engine in its units', () => {
  const form = { backend: 'fomkyr', field: '0', memoryMiB: 2048, nativeWorkers: 0 };
  const engine = fomkyrEngineOptions({ ...form, fomkyrOptions: { gmCriteria: 'all', checkpointIntervalSeconds: 5, diskLimitMiB: 1024, midDegreeCheckpoints: false } });
  assert.equal(engine.gmCriteria, 'all');
  assert.equal(engine.checkpointIntervalMs, 5000);
  assert.equal(engine.diskLimitBytes, 1024 * 1048576);
  assert.equal(engine.midDegreeCheckpoints, false);
  assert.equal(fomkyrEngineOptions({ ...form, fomkyrOptions: {} }).diskLimitBytes, undefined);
  assert.throws(() => fomkyrEngineOptions({ ...form, fomkyrOptions: { pairOrder: 'gateword' } }), /FK6 dimension profile/);
  assert.equal(fomkyrEngineOptions({ ...form, fomkyrOptions: { pairOrder: 'gateword', dimensionEvidence: 'fk6-20' } }).pairOrder, 'gateword');
});
