import sys,json,tempfile,struct
from pathlib import Path
from fractions import Fraction
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tools'),str(R/'tests')]
from canonical_audit import canonicalize,canonical_digest,AuditError,records
from oracle import certify
from native import Engine,parse
from field_oracle import ModularOracle
checks=[]
def mark(name):checks.append({'test':name,'passed':True})
left=[{(1,0):1,(0,0):-1},{(1,1):1,(1,0):-1}]
right=[{(1,0):1,(0,0):-1},{(1,1):1,(0,0):-1}]
a,_=canonicalize(left);b,_=canonicalize(right);assert a==b;mark('different-unreduced-tails-same-canonical-basis')
wrong=[{(1,0):1,(0,0):-2},{(1,1):1,(0,0):-1}];c,_=canonicalize(wrong)
assert canonical_digest(a,['a','b'],0,2)!=canonical_digest(c,['a','b'],0,2);mark('same-leading-words-not-enough')
for p in (2,5,101):
 a,_=canonicalize(left,p);b,_=canonicalize(right,p);assert a==b
mark('canonical-normalization-in-Q-and-prime-fields')
try:canonicalize([{(1,1):1},{(1,0,1):1,(0,1,1):1}])
except AuditError:mark('reject-proper-subword-precondition-failure')
else:raise AssertionError('Failed to reject reducible proper tail')
notgb=[{(0,1):1},{(1,0):1,(0,0):-1}]
canonicalize(notgb)
try:certify(notgb,[],3)
except AssertionError:mark('canonical-digest-is-not-a-Groebner-certificate')
else:raise AssertionError('Independent critical-pair check failed to detect bad basis')
names,rels=parse('a,b','3*a*b+2*b*a,a*a')
f={'variables':names,'relations':rels}
leading=[]
for p in (0,2,5):
 e=Engine(f,4,modulus=p);e.run();assert e.stats()['modulus']==p;leading.append({max(x) for x in e.basis()})
assert leading[0]!=leading[1];mark('field-identity-and-characteristic-dependent-leading-words')
with tempfile.TemporaryDirectory() as tmp:
 path=Path(tmp)/'b.gnb';e=Engine(f,4,modulus=0,disk=str(path));e.run();list(records(path,4,2))
 data=bytearray(path.read_bytes());data[35]^=1;path.write_bytes(data)
 try:list(records(path,4,2))
 except AuditError:mark('independent-record-checksum-rejects-corruption')
 else:raise AssertionError('Corrupted record accepted')
# Explicitly imported mathematical test presentations; executable oracles are separate.
fixture=json.loads((R/'fixtures/george-supported.json').read_text());rows=[]
for case in fixture['cases']:
 for p in fixture['fields']:
  names,rels=parse(','.join(case['vars']),','.join(case['rels']));f={'name':case['id'],'variables':names,'relations':rels};D=case['maxdeg']
  e=Engine(f,D,modulus=p);e.run();gb=e.basis();assert e.stats()['modulus']==p
  if p:o=ModularOracle(p);g=o.complete(rels,D);critical=o.certify(gb,rels,D);nf=o.normal
  else:
   from oracle import complete,normal
   g=complete(rels,D);critical=certify(gb,rels,D);nf=normal
  assert all(not nf(x,g) for x in gb) and all(not nf(x,gb) for x in g)
  a,_=canonicalize(gb,p);b,_=canonicalize(g,p);assert a==b
  if 'expectedBasis' in case:
   _,expected=parse(','.join(names),','.join(case['expectedBasis']))
   from oracle import poly
   expected=[poly(x) for x in expected]
   if p:expected=[{w:int(c)%p for w,c in row.items() if int(c)%p} for row in expected]
   if p:o.certify(expected,rels,D)
   else:certify(expected,rels,D)
   assert all(not nf(x,expected) for x in gb) and all(not nf(x,gb) for x in expected)
  rows.append({'case':case['id'],'modulus':p,'degree':D,'passed':True,'basisSize':len(gb),'independentCriticalCompositions':critical,'canonicalEqual':True,'externalEngineExecuted':False})
report={'passed':True,'checks':checks,'georgeHomogeneousCases':rows,'scope':'Independent exact completion of adapted presentations, not fresh Singular/Bergman execution.'}
(R/'results/0.6.1/audit-tests.json').write_text(json.dumps(report,indent=2));print(json.dumps({'passed':True,'checks':len(checks),'adaptedCaseFieldCombinations':len(rows)}))
