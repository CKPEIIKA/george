#!/usr/bin/env python3
"""Imported runtime authority is a byte binding, NOT a mathematical proof."""
from pathlib import Path
import hashlib,json,re
R=Path(__file__).resolve().parents[1];p=R/'fk_gate/profiles'
files=['fk6_q.h','fk6_sectors.h','proof-provenance.json']
digest=hashlib.sha256(b''.join((p/x).read_bytes() for x in files)).hexdigest()
native=re.search(r'#define FKG_AUTHORITY_ID "([a-f0-9]{64})"',(p/'runtime-identity.h').read_text()).group(1)
js=re.search(r"FK_GATE_PROFILE_ID='([a-f0-9]{64})'",(R/'web/fk-gate.js').read_text()).group(1)
assert native==js==digest,(native,js,digest)
proof=json.loads((p/'proof-provenance.json').read_text());assert 'pending' in proof['proofStatus']
assert proof['presentationIdentity']=='17c5a3b13bbae1fd6e03ece75139f297d437bda2ae062b093d77a92f091b88bf'
report={'passed':True,'byteBinding':digest,'files':files,'proofBundleReplayed':False,'upstreamProofStatus':proof['proofStatus']}
o=R/'results/0.6.8/profile-identity.json';o.parent.mkdir(parents=True,exist_ok=True);o.write_text(json.dumps(report,indent=2));print(json.dumps(report))
