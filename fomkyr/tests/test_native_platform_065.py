from pathlib import Path
import subprocess,json,hashlib,random,os,shutil,sys,io
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"tools"))
from canonical_audit import records,canonicalize,canonical_digest
R=Path(__file__).resolve().parents[1];out=R/'results/0.6.5/platform';out.mkdir(exist_ok=True);rows=[]
def command(args,timeout=90):
 p=subprocess.run(args,cwd=R,capture_output=True,text=True,timeout=timeout)
 if p.returncode:raise AssertionError((args,p.returncode,p.stdout[-3000:],p.stderr[-4000:]))
 return p
flags=['-std=c11','-O2','-fsanitize=undefined,address','-fno-sanitize-recover=all']
command(['clang',*flags,'native/support.c','tests/native_util_065.c','-o',str(out/'util')])
r=random.Random(1965)
for i,s in enumerate(['','abc','a'*1000000,'{}','{"x":[1,2,"hello"]}']+[''.join(chr(r.randrange(32,127))for _ in range(r.randrange(1,20000)))for _ in range(60)]):
 p=subprocess.run([str(out/'util'),'-'],input=s,cwd=R,capture_output=True,text=True,timeout=10)
 assert p.returncode==0,p.stderr
 assert p.stdout.splitlines()[0]==hashlib.sha256(s.encode()).hexdigest()
rows.append({'test':'SHA256-and-JSON-sanitizers','cases':65,'passed':True})
# Standalone GCC build: no clang-specific atomics or WASM/Node runtime needed.
log=[]
for cmd in [['gcc','-std=c11','-O3','-flto','-ffreestanding','-fno-builtin','-c','src/kernel.c','-o',str(out/'kernel-gcc.o')],
 ['gcc','-std=c11','-O3','-flto','native/cli.c','native/host.c','native/fixture.c','native/support.c',str(out/'kernel-gcc.o'),'-pthread','-o',str(out/'fomkyr-gcc')]]:
 p=command(cmd,180);log.append(p.stdout+p.stderr)
(out/'gcc-build.log').write_text('\n'.join(log))
job=out/'gcc-job';shutil.rmtree(job,ignore_errors=True)
p=command([str(out/'fomkyr-gcc'),'-i','fixtures/published/affine-q-serre-q2.json','-d20','--memory','512M','--workdir',str(job),'--hilbert','--quiet']);result=json.loads(p.stdout)
assert result['complete']and result['basisSize']==46
canonical,_=canonicalize(records(next(job.glob('fomkyr/*/basis.gnb')),20,2));stream=io.BytesIO();canonical_digest(canonical,['a','b'],0,20,stream)
assert stream.getvalue()==(R/'reference/q-serre-q2-degree20/canonical.jsonl').read_bytes()
rows.append({'test':'standalone-GCC-native','passed':True,'exactCanonicalReferenceEqual':True,'result':result})
# GCC worker1 finite field and free algebra; stdin and signal exit codes tested separately.
for prime in [2,101]:
 job=out/f'field-{prime}';shutil.rmtree(job,ignore_errors=True)
 p=command([str(out/'fomkyr-gcc'),'-i','fixtures/exterior.json','-d','9','-j','2','--field',str(prime),'--workdir',str(job),'--memory','128M','--hilbert','--quiet'])
 h=json.loads(next(job.glob('fomkyr/*/hilbert.json')).read_text());assert h['modulus']==prime and h['coefficients'][:5]==['1','3','3','1','0']
 rows.append({'test':'native-field','prime':prime,'passed':True})
(out/'summary.json').write_text(json.dumps({'passed':True,'cases':rows},indent=2));print('NATIVE PLATFORM PASS',flush=True)
