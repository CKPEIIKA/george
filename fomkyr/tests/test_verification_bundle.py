#!/usr/bin/env python3
"""Completed native exports, independent verification and rejection contracts."""
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

ROOT=Path(__file__).resolve().parents[1]
def run(args,expected=0):
    p=subprocess.run(args,cwd=ROOT,text=True,capture_output=True,timeout=120)
    assert p.returncode==expected,(args,p.returncode,p.stdout,p.stderr)
    return p.stdout
with tempfile.TemporaryDirectory(prefix='fomkyr-bundle-') as temporary:
    tmp=Path(temporary)
    input_file=tmp/'exterior.bg';input_file.write_text('vars x,y; x^2,y^2,y*x+x*y;\n')
    for field in [0,2,101]:
        job=tmp/f'job-{field}';out=tmp/f'field-{field}.zip'
        args=['./dist/fomkyr','-i',str(input_file),'-d','4','-j','2','--memory','128M','--workdir',str(job),'--export','--hilbert']
        if field:args+=['--field',str(field)]
        run(args);run(['python3','tools/export-verification.py',str(job),'--out',str(out)])
        report=json.loads(run(['python3','tools/verify-computation.py',str(out)]))
        assert report['independentGroebnerCertificate'] and report['completedThroughDegree']==4
        integrity=json.loads(run(['python3','tools/verify-computation.py',str(out),'--integrity-only']))
        assert not integrity['independentGroebnerCertificate']
        # Damage a payload while preserving the manifest; it must be rejected.
        bad=tmp/'bad.zip'
        with zipfile.ZipFile(out) as source,zipfile.ZipFile(bad,'w') as destination:
            for name in source.namelist():destination.writestr(name,source.read(name)+(b' ' if name=='presentation.json' else b''))
        failed=json.loads(run(['python3','tools/verify-computation.py',str(bad)],1))
        assert not failed['independentGroebnerCertificate'] and 'hash mismatch' in failed['error']
    job=tmp/'gated';out=tmp/'gated.zip'
    run(['./dist/fomkyr','-i','fixtures/user-form.bg','-d','3','-j','2','--memory','512M','--workdir',str(job),'--fk-gate','--export'])
    run(['python3','tools/export-verification.py',str(job),'--out',str(out)])
    report=json.loads(run(['python3','tools/verify-computation.py',str(out)]))
    assert report['independentGroebnerCertificate'] and not report['verificationDependsOnImportedDimensions']
    with zipfile.ZipFile(out) as z:
        manifest=json.loads(z.read('manifest.json'))
        assert manifest['gateProfileThroughDegree']==17
        assert not manifest['verification']['profileProofReplayedHere']
    print('Q/F2/F101 native exports, gated FK6, independent certificates and payload tampering: PASS')
