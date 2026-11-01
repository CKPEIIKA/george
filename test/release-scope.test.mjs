import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {validationSnapshot, phaseProtocol} from '../tools/release-support.mjs';
import {georgeSourceArchive} from '../tools/source-archives.mjs';

test('George release inputs and source download exclude investigative Kircracker', () => {
  const inputs = Object.keys(validationSnapshot());
  assert.ok(inputs.includes('fomkyr/src/kernel.c'));
  assert.ok(inputs.every(file => !file.startsWith('kircracker/')));
  const paths = execFileSync('tar', ['-tzf', '-'], {
    input: georgeSourceArchive(), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  }).trim().split('\n');
  assert.ok(paths.includes('fomkyr/src/kernel.c'));
  assert.ok(paths.every(file => !file.startsWith('kircracker/')));
});

test('old reports without protocol metadata cannot match current release evidence', () => {
  const current = {schema: 2, appVersion: '0.7.7', previousEngine: {directory: 'saved'}};
  for (const old of [undefined, null, 'legacy', []]) {
    assert.equal(phaseProtocol(old, 'matrix'), null);
    assert.notDeepEqual(phaseProtocol(old, 'matrix'), phaseProtocol(current, 'matrix'));
  }
  assert.deepEqual(phaseProtocol(current, 'matrix'), {schema: 2, appVersion: '0.7.7'});
  assert.deepEqual(phaseProtocol(current, 'upgrade'), current);
  assert.equal(current.previousEngine.directory, 'saved');
});
