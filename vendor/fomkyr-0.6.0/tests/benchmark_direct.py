"""Paired fresh-process direct-exact benchmarks; run without competing tests.

FOMKYR_BASELINE must identify a separately built, pristine 0.5.0 source tree.
Startup, local table construction and checkpoints are all included.
"""
import hashlib,json,os,statistics,subprocess,time
from pathlib import Path
R=Path(__file__).resolve().parents[1];os.chdir(R)
base=Path(os.environ['FOMKYR_BASELINE']).resolve()
assert base!=R and (base/'dist/fomkyr32.wasm').is_file()
out=R/'results/0.6/benchmarks';out.mkdir(parents=True,exist_ok=True)
settings=[('FK6',R/'fixtures/fk6.json',9),('FK6',R/'fixtures/fk6.json',10),('P6',R/'fixtures/modular-stress-0.json',12)]
rows=[]
for name,f,D in settings:
 for repeat in range(3):
  order=[('baseline-0.5',base,{}),('direct-0.6',R,{})]
  if repeat%2:order.reverse()
  for label,source,options in order:
   tag=f'{name}-d{D}-{label}-{repeat}';j=out/(tag+'.json');record=out/(tag+'.gnb')
   env={**os.environ,'FOMKYR_SOURCE':str(source),'TRIAL_OPTIONS':json.dumps(options)}
   p=subprocess.run(['node','--experimental-wasm-memory64','tests/direct_trial.mjs',str(f),str(D),str(j),str(record)],env=env,capture_output=True,text=True,timeout=120)
   assert p.returncode==0,(p.stdout,p.stderr)
   r=json.loads(j.read_text());assert not r.get('error');r.update(label=label,case=name,repeat=repeat,recordSha256=hashlib.sha256(record.read_bytes()).hexdigest());rows.append(r);print(tag,round(r['endToEndMs'],2),flush=True)
# Same current source: mechanism ablations and progress overhead.
for repeat in range(3):
 for label,options in [('pin-only',{'compiledRewrites':False}),('rewrites-only',{'sharedReducerCacheBytes':0}),('with-progress',{'progress':True})]:
  tag=f'FK6-d10-{label}-{repeat}';j=out/(tag+'.json');record=out/(tag+'.gnb')
  env={**os.environ,'FOMKYR_SOURCE':str(R),'TRIAL_OPTIONS':json.dumps(options)}
  p=subprocess.run(['node','--experimental-wasm-memory64','tests/direct_trial.mjs','fixtures/fk6.json','10',str(j),str(record)],env=env,capture_output=True,text=True,timeout=120)
  assert p.returncode==0,(p.stdout,p.stderr)
  r=json.loads(j.read_text());r.update(label=label,case='FK6',repeat=repeat,recordSha256=hashlib.sha256(record.read_bytes()).hexdigest());rows.append(r);print(tag,round(r['endToEndMs'],2),flush=True)
summary=[]
for case,D,label in dict.fromkeys((r['case'],r['degree'],r['label']) for r in rows):
 rs=[r for r in rows if (r['case'],r['degree'],r['label'])==(case,D,label)];v=[r['endToEndMs'] for r in rs]
 assert len({r['recordSha256'] for r in rs})==1,('nondeterministic output',case,D,label)
 summary.append({'case':case,'degree':D,'mode':label,'trials':len(v),'medianMs':statistics.median(v),'minMs':min(v),'maxMs':max(v),'recordSha256':rs[0]['recordSha256']})
conditions={'description':'Fresh-process actual shared WASM32, four CPU lanes, Node filesystem adapter for OPFS; startup, table construction and checkpoints included; no text export or Hilbert; progress off except explicit ablation. Default 128 MiB budget, 32 MiB scratch, hashBits=16. Baseline separately built from supplied 0.5.0 with same Clang/flags. Sequential trials, alternating order for main pairs.','baseline':str(base),'compiler':subprocess.check_output(['clang','--version'],text=True).splitlines()[0]}
(out/'summary.json').write_text(json.dumps({'conditions':conditions,'summary':summary,'runs':rows},indent=2))
print('PAIRED BENCHMARKS COMPLETE',flush=True)
