import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

export async function streamSha256(stream) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

export async function gitBlobSha256(ref, file) {
  const child = spawn('git', ['show', `${ref}:${file}`], {stdio: ['ignore', 'pipe', 'pipe']});
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-4096); });
  const finished = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Cannot read release file ${file}: ${stderr.trim() || signal || code}`));
    });
  });
  const [hash] = await Promise.all([streamSha256(child.stdout), finished]);
  return hash;
}
