#!/usr/bin/env python3
import json, pathlib, sys
p=pathlib.Path(__file__).resolve().parents[1]
d=json.loads((p/'profiles/fk6-exact-through17.json').read_text())
expected={14:346652740,15:850296030,16:2031123484,17:4735557180}
dims=d.get('dimensions')
if not isinstance(dims,list) or len(dims)<=17:
    raise SystemExit('bad dimensions array')
for k,v in expected.items():
    if int(dims[k])!=v: raise SystemExit(f'degree {k}: {dims[k]} != {v}')
print(json.dumps({'passed':True,'throughDegree':17,'totals':expected},sort_keys=True))
