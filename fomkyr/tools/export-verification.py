#!/usr/bin/env python3
"""Export a completed native job and optional gate profile as a verification ZIP."""
import argparse
import fcntl
import hashlib
import json
from pathlib import Path
import zipfile

ROOT=Path(__file__).resolve().parents[1]
def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1048576),b''):h.update(b)
    return h.hexdigest()
def encoded(value):return (json.dumps(value,indent=2)+'\n').encode()
def export(job,out):
    # Use the same POSIX record lock as the native CLI; a live job is not altered.
    with (job/'cli.lock').open('a+') as lock:
        fcntl.lockf(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        runs=[p for p in (job/'fomkyr').iterdir() if (p/'native-result.json').exists()]
        if len(runs)!=1:raise ValueError('Specify a job containing one completed native computation')
        run=runs[0];result=json.loads((run/'native-result.json').read_text())
        if not result.get('complete'):raise ValueError('The computation is incomplete')
        degree=result['completedThroughDegree'];cp=json.loads((run/f'checkpoint-{degree%2}.json').read_text());payload=cp['payload']
        if payload['completedThroughDegree']!=degree or payload['partial'] or payload['basisSize']!=result['basisSize'] or payload['diskBytes']!=(run/'basis.gnb').stat().st_size:raise ValueError('Checkpoint no longer matches the result')
        fixture=json.loads((job/'fixture.json').read_text())
        fixture=dict(variables=fixture['variables'],relations=fixture['relations'],modulus=result.get('modulus',0),order='degleftlex')
        # Native metadata historically omits modulus; the saved input metadata
        # records it alongside the canonical fixture.
        for name in ['job.json','input.json']:
            if (job/name).exists():fixture['modulus']=json.loads((job/name).read_text()).get('modulus',fixture['modulus'])
        identity=hashlib.sha256(json.dumps(dict(semantics='fomkyr-homogeneous-degleftlex-v1',variables=fixture['variables'],relations=fixture['relations'],modulus=fixture['modulus']),separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
        cp_digest=hashlib.sha256(json.dumps(payload,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
        if cp.get('schema')!=2 or cp_digest!=cp.get('sha256') or identity!=result['identity'] or payload['identity']!=identity:raise ValueError('Saved presentation/checkpoint identity mismatch')
        files={'presentation.json':encoded(fixture),'checkpoint.json':encoded(cp),'basis.gnb':run/'basis.gnb','fomkyr-result.json':run/'native-result.json'}
        for name in ['result.gb','hilbert.json']:
            if (run/name).exists():files[name]=run/name
        files.update({'verify.py':ROOT/'tools/verify-computation.py','LICENSE.txt':ROOT/'LICENSE'})
        for name in ['fk6-exact-through17.json','fk6_q.h','fk6_sectors.h','proof-provenance.json']:files[name]=ROOT/'fk_gate/profiles'/name
        readme=ROOT/'web/verification/README.txt'
        files['README.txt']=readme if readme.exists() else b'Run: python3 verify.py computation.zip --out verification.json\n'
        hashes={n:{'bytes':v.stat().st_size if isinstance(v,Path) else len(v),'sha256':digest(v) if isinstance(v,Path) else hashlib.sha256(v).hexdigest()} for n,v in files.items()}
        gate=result.get('fkGate',{});profile=json.loads((ROOT/'fk_gate/profiles/fk6-exact-through17.json').read_text());expected=str(profile['dimensions'][degree]) if result.get('fkGateProfileId') and degree<=17 else None
        recounted=str(gate['upper']) if gate.get('status')==3 and gate.get('degree')==degree and gate['upper']==gate['lower'] else None
        source='gate fresh scalar recount' if recounted is not None else 'not requested'
        if recounted is None and 'hilbert.json' in files:
            coefficients=json.loads(files['hilbert.json'].read_text()).get('coefficients',[])
            if len(coefficients)>degree:recounted=str(coefficients[degree]);source='completed-basis Hilbert calculation'
        if expected is not None and recounted is not None and expected!=recounted:raise ValueError('Gate scalar recount mismatch')
        provenance=json.loads((ROOT/'fk_gate/profiles/proof-provenance.json').read_text())
        manifest=dict(schema=1,kind='fomkyr-computation-verification-bundle',engineVersion=result['version'],field='Q' if not fixture['modulus'] else 'F_'+str(fixture['modulus']),modulus=fixture['modulus'],order='degleftlex',completedThroughDegree=degree,presentationSHA256=result['identity'],basisSHA256=hashes['basis.gnb']['sha256'],basisSize=result['basisSize'],unrestrictedBasisComplete=False,settings={k:result.get(k) for k in ['workers','budgetBytes','cooperative','cachePercent','sharedCacheBytes','bigRowMaxTerms']},gateProfileId=result.get('fkGateProfileId'),gateProfileThroughDegree=17 if result.get('fkGateProfileId') else None,gateCertificateSHA256=provenance['proofBundleDigestSHA256'] if result.get('fkGateProfileId') else None,finalScalarRecount=dict(degree=degree,value=recounted,expected=expected,passed=recounted is not None and (expected is None or recounted==expected),source=source),verification=dict(independentGroebnerCertificate=False,independentCheckStatus='not-run',profileProofReplayedHere=False,conditionalOnImportedFkDimensions=result.get('conditionalOnImportedFkDimensions',False),conditionalOnExternalDimensions=result.get('conditionalOnExternalDimensions',False)),files=hashes)
        out.parent.mkdir(parents=True,exist_ok=True)
        with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED,allowZip64=True) as z:
            z.writestr('manifest.json',encoded(manifest))
            for name,value in files.items():
                if isinstance(value,Path):z.write(value,name)
                else:z.writestr(name,value)
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('job',type=Path);p.add_argument('--out',type=Path,required=True);a=p.parse_args();export(a.job,a.out);print(a.out)
if __name__=='__main__':main()
