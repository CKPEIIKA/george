import json,sys,io
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools')]
from canonical_audit import canonicalize,records,canonical_digest
ref=(R/'reference/q-serre-q2-degree20/canonical.jsonl').read_bytes()
reports=[]
for row in json.loads(Path(sys.argv[1]).read_text()):
 b,checks=canonicalize(records(Path(row['record']),20,2));out=io.BytesIO();sha=canonical_digest(b,['a','b'],0,20,out)
 assert out.getvalue()==ref,(row['mode'],'canonical mismatch')
 reports.append({'mode':row['mode'],'exactStreamEqual':True,'sha256':sha,**checks})
(R/'results/0.6.7/cooperative-q2-golden-audit.json').write_text(json.dumps({'passed':True,'cases':reports},indent=2))
print('PASSED exact canonical comparison to independent degree-20 reference:',len(reports))
