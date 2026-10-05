#!/usr/bin/env python3
"""One-time packaging conversion. No certificate rank is strengthened by conversion."""
from pathlib import Path
import json,sys,hashlib
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from app.records import EDGE,write_minor
from app.util import atomic_json,sha
old=Path(sys.argv[1]);catalogs=[]
base=json.loads((old/'certificates/base-through13.json').read_text())
for d in range(19):
 if d<=13:c=base['freshLowerCertificates'][d];blocks=c['blocks']
 elif d<=16:c=json.loads((old/f'certificates/relative-lower-{d}.json').read_text());blocks=c['blocks']
 else:
  src=old/(f'work{d}/minors{d}');c=json.loads((src/('catalog.json' if (src/'catalog.json').exists() else 'validation.json')).read_text());blocks=[json.loads((src/x['blockFile']).read_text()) for x in c['blocks']]
 out=ROOT/'data/minors'/f'd{d:02d}';out.mkdir(parents=True,exist_ok=True);rows=[]
 for i,b in enumerate(blocks):
  us=[bytes(EDGE[tuple(e)] for e in w) for w in b['words']];vs=[bytes(EDGE[tuple(e)] for e in w) for w in b['dualWords']]
  m={'degree':d,'rank':len(us),'prime':1000003,'grade':b['permutationDegree'],'transports':b.get('transports',[list(range(1,7))]),'determinant':b['determinantModPrime'],'origin':'frontier-0.5.0 inherited witness; independent replay required'}
  fn=out/f'block-{i:02d}.kcb';h=write_minor(fn,m,us,vs);rows.append({'file':fn.name,'sha256':h,'rank':len(us),'grade':m['grade'],'coveredGrades':len(m['transports']),'contribution':len(us)*len(m['transports'])})
 meta={'degree':d,'prime':1000003,'blocks':rows,'rankLowerBound':sum(x['contribution'] for x in rows),'storedMatrices':False}
 assert meta['rankLowerBound']==c['rankLowerBound'];atomic_json(out/'catalog.json',meta);catalogs.append(meta);print(d,meta['rankLowerBound'],len(rows),flush=True)
atomic_json(ROOT/'data/minors/index.json',{'format':'minor-series-v1','throughDegree':18,'degrees':[{'degree':d,'path':f'd{d:02d}/catalog.json','sha256':sha(ROOT/'data/minors'/f'd{d:02d}/catalog.json')} for d in range(19)]})
