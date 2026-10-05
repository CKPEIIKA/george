#!/usr/bin/env python3
"""Replay the inherited full-radical and original-FK representation evidence.
These checks rely on the accompanying written Hopf/coideal proof argument; no
external-review or formal-assistant claim is made by this bridge.
"""
from pathlib import Path
import sys,json,time
R=Path(__file__).resolve().parents[1]
# The legacy evidence is unpacked into a user-owned run directory, never written
# into the installed package. Its exact verifier binary is supplied by our build.
legacy=Path(sys.argv[1]);out=Path(sys.argv[2]);jobs=int(sys.argv[3]);out.mkdir(parents=True,exist_ok=True)
sys.path[:0]=[str(legacy/'tools'),str(legacy/'reference')]
from radical import verify
from verify_nonzero import replay
start=time.monotonic();q=json.loads((legacy/'certificates/nichols/degree14-radical.json').read_text())
a=verify(q,independent=True);assert a['pairingRadicalCertified']
(out/'radical.json').write_text(json.dumps(a,indent=2))
b=replay(threads=min(32,jobs),seconds=86400,out=out/'nonzero.json',executable=R/'bin/exact-quotient-audit')
assert b['originalFKNonzeroCertified']
report={'passed':True,'radical':a,'nonzero':b,'seconds':time.monotonic()-start,'structuralArgument':'docs/INHERITED_PROOF.md and retained quotient/coideal extension; not externally reviewed','proofAssistantFormalized':False}
(out/'replay.json').write_text(json.dumps(report,indent=2));print(json.dumps({'passed':True,'seconds':report['seconds']}))
