// Serve the independent checker and exact imported profile with the browser engine.
import fs from 'node:fs';
import path from 'node:path';
const assets={
  'verify.py':'fomkyr/tools/verify-computation.py',
  'LICENSE.txt':'fomkyr/LICENSE',
  ...Object.fromEntries(['fk6-exact-through17.json','fk6_q.h','fk6_sectors.h','proof-provenance.json'].map(name=>[name,'fomkyr/fk_gate/profiles/'+name])),
};
const readme=`Fomkyr computation verification bundle

Unpack all files into one directory. Python 3 and its standard library suffice:

  python3 verify.py computation.zip --out verification.json
  python3 verify.py computation.zip --integrity-only

Pass the original downloaded ZIP, not the extracted directory.
The default independent check has a 120-second time allowance and a two-million
term allowance. Larger checks can use --time-limit 0 --max-terms 0. An exhausted
allowance reports INCOMPLETE and never produces a mathematical certificate.

The full check establishes both directions of defining-ideal membership, all
overlap and inclusion compositions through the stated degree, and independently
counts the Hilbert prefix. It can cost much more than the original computation.
Its result is degree-bounded; it does not assert unrestricted termination.

manifest.json binds every payload by SHA-256, the exact presentation, field,
order, checkpoint prefix, engine settings and final scalar recount. File hashes
and a solver recount alone do not certify a Groebner basis. The independent
check starts with status not-run. Only a successful full checker report sets
independentGroebnerCertificate to true.

The optional FK6 profile contains dimensions through degree 17 and the digest
of its external computational proof. That proof archive is not included or
replayed here. A full independent basis check does not rely on these dimensions.
The Python checker is intended for independent auditing; its scalability differs
from the C solver. Retain verification.json with the original ZIP when sharing.
`;
for(const directory of ['fomkyr/web/verification','web/engine/fomkyr/verification']){
  fs.mkdirSync(directory,{recursive:true});
  for(const [name,source] of Object.entries(assets))fs.copyFileSync(source,path.join(directory,name));
  fs.writeFileSync(path.join(directory,'README.txt'),readme);
}
