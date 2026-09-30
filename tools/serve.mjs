// Minimal static file server for local development.  Like GitHub Pages it
// sends no special headers (no COOP/COEP), so what works here works there.
//
//   node tools/serve.mjs [dir=web] [port=8000]

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.data': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8',
};

export function staticServer(directory = 'web', mount = '/') {
  const root = path.resolve(directory);
  if (!mount.startsWith('/') || !mount.endsWith('/')) throw new Error('The mount path must start and end with /.');
  return http.createServer((req, res) => {
    let url;
    try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { res.writeHead(400).end(); return; }
    if (mount !== '/' && url === mount.slice(0, -1)) { res.writeHead(301, { location: mount }).end(); return; }
    if (!url.startsWith(mount)) { res.writeHead(404).end(); return; }
    let file = path.resolve(root, './' + url.slice(mount.length));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(data);
    });
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || 'web', port = Number(process.argv[3] || 8000), mount = process.argv[4] || '/';
  staticServer(root, mount).listen(port, '127.0.0.1', () => console.log(`George at http://127.0.0.1:${port}${mount} (serving ${path.resolve(root)})`));
}
