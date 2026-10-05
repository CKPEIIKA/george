#!/usr/bin/env python3
"""Replay an original-FK nonzero certificate by a truncated operator representation.
No assumption that the supplied star quotient IS the original star algebra.
No code path treats a nonzero remainder alone as an original-FK certificate.
"""
from pathlib import Path
from fractions import Fraction
import json,sys,subprocess,time,hashlib,argparse
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R/'tools'))
from verify_extension_algebra import run as operator_proof
from radical import read_polynomial,polynomial_hash

def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()

def replay(cert_path=None,threads=4,seconds=600,out=None,executable=None):
 cert_path=Path(cert_path or R/'certificates/representation/Q-nonzero.json');cert=json.loads(cert_path.read_text());start=time.monotonic()
 if cert.get('claim')!='FK_NONZERO_BY_TRUNCATED_OPERATOR_REPRESENTATION' or cert.get('ambientFK')!=6 or cert.get('field')!='Q' or cert.get('truncationDegree')!=15:raise ValueError('Unsupported claim/field/truncation')
 basis=R/cert['basisFile'];qcert=R/cert['polynomialFile']
 if sha(basis)!=cert['basisSHA256'] or sha(qcert)!=cert['polynomialFileSHA256']:raise ValueError('Input identity mismatch')
 qdata=json.loads(qcert.read_text());poly=read_polynomial(qdata['polynomial'],6,14)
 if polynomial_hash(poly)!=qdata['polynomialSHA256']:raise ValueError('polynomial identity mismatch')
 exe=Path(executable or R/'bin/exact-quotient-audit');reports={}
 for mode in ['critical','closure']:
  p=subprocess.run([str(exe),str(basis),mode,str(seconds),str(threads)],capture_output=True,text=True,timeout=seconds+60)
  if p.returncode:raise ValueError(f'{mode} failed or incomplete: '+p.stderr[-1000:])
  data=json.loads(p.stdout)
  if not data.get('passed') or data['checked']!=data['jobs'] or data['rules']!=cert['ruleCount']:raise ValueError('Incomplete independent audit')
  reports[mode]=data
  if out:
   stem=Path(out).with_suffix('');stem.parent.mkdir(parents=True,exist_ok=True);Path(str(stem)+'-'+mode+'.log').write_text(p.stderr)
 op=operator_proof();assert op['passed']
 reports['operatorIdentities']={k:v for k,v in op.items()if not isinstance(v,list)}
 query=f'14 {len(poly)}\n'
 for w,c in poly.items():
  v=0
  for a,b in w:v=16*v+a-1
  query+=f'{v} {c}\n'
 p=subprocess.run([str(exe),str(basis),'query',str(seconds),'1'],input=query,capture_output=True,text=True,timeout=seconds+60)
 if p.returncode:raise ValueError('NF query failed')
 lines=p.stdout.splitlines();data=json.loads(lines[0]);nf={}
 for line in lines[1:]:
  a,c=line.split();v=int(a);w=tuple((v>>(4*i))&15 for i in reversed(range(14)));nf[w]=Fraction(c)
 expected={tuple(w):Fraction(c)for w,c in cert['expectedNormalForm']}
 if not nf or nf!=expected or data['terms']!=len(nf):raise ValueError('Nonzero evaluation did not replay')
 fw=tuple(cert['functionalWord']);value=Fraction(cert['functionalValue'])
 if value==0 or nf.get(fw)!=value:raise ValueError('Functional does not detect Q')
 reports['query']={**data,'functionalWord':list(fw),'functionalValue':str(value),'normalFormExactlyEqual':True}
 result={'claim':cert['claim'],'passed':True,'originalFKNonzeroCertified':True,'polynomialSHA256':qdata['polynomialSHA256'],'basisSHA256':cert['basisSHA256'],'field':'Q','degree':14,'proof':'Verified normal form in W=T/(G+T>=15), verified S5/adjoint-stable ideal, and the proved original FK operator representation. Nonzero operator applied to unit detects the original class.','checks':reports,'seconds':time.monotonic()-start,'independentNativeVerifier':'GMP rational arithmetic; no production normal-form implementation','formalProofAssistant':False,'externalSpecialistReview':False,'doesNotAloneAssertPrimitivityOrInfinitude':True}
 if out:Path(out).write_text(json.dumps(result,indent=2)+'\n')
 return result
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--certificate',type=Path);p.add_argument('--threads',type=int,default=4);p.add_argument('--seconds',type=int,default=600);p.add_argument('--out',type=Path,default=R/'evidence/0.3/nonzero-replay.json');a=p.parse_args();r=replay(a.certificate,a.threads,a.seconds,a.out);print(json.dumps(r,indent=2))
