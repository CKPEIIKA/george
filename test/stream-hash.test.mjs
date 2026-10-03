import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import {streamSha256} from '../tools/stream-hash.mjs';

test('Release hashing streams an archive larger than the old 32 MB buffer', async () => {
  const chunk = Buffer.alloc(512 * 1024, 37), expected = crypto.createHash('sha256');
  const count = 96;
  for (let i = 0; i < count; i++) expected.update(chunk);
  const source = Readable.from((function* () { for (let i = 0; i < count; i++) yield chunk; })());
  assert.equal(await streamSha256(source), expected.digest('hex'));
});

test('Release hashing propagates a failed stream', async () => {
  const source = Readable.from((async function* () { yield Buffer.from('partial'); throw new Error('read failed'); })());
  await assert.rejects(streamSha256(source), /read failed/);
});
