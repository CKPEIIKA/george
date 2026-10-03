"""Paired fresh-process benchmarks; includes every startup and verification.
No warmed exact engine versus cold modular engine comparisons.
"""
import subprocess,json,os,time,statistics,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1];os.chdir(R)
out=R/'results/0.5/benchmarks-final';out.mkdir(parents=True,exist_ok=True)
rows=[]
settings=[('FK6',R/'fixtures/fk6.json',9,3),('P6',R/'fixtures/modular-stress-0.json',12,3),('FK6',R/'fixtures/fk6.json',10,3)]
for name,f,D,trials in settings:
 for repeat in range(trials):
  for label,mode,p in [('baseline-0.4','exact',2),('exact-rational-heap','exact',2),('modular-default','modular',2)]:
   target=out/f'{name}-d{D}-{label}-{repeat}.json';record=out/f'{name}-d{D}-{label}-{repeat}.gnb' if repeat==0 else None
   args=['node','--experimental-wasm-memory64','tests/modular_trial.mjs',mode,str(f),str(D),str(target)]+([str(record)] if record else [])
   env={**os.environ,'MIN_PRIMES':str(p),'TIMEOUT_MS':'60000','RATIONAL_HEAP':'off' if label=='baseline-0.4' else 'on'}
   if label=='baseline-0.4':env['FOMKYR_SOURCE']=os.environ.get('FOMKYR_BASELINE',str(R))
   try:run=subprocess.run(args,env=env,capture_output=True,text=True,timeout=80);v=json.loads(target.read_text());v.update(label=label,case=name,repeat=repeat,returncode=run.returncode);rows.append(v);print(name,D,label,repeat,round(v.get('endToEndMs',0),2),v.get('error',''),flush=True)
   except subprocess.TimeoutExpired:rows.append({'case':name,'degree':D,'label':label,'repeat':repeat,'error':'External 80 second harness timeout'});print('TIMEOUT',name,D,label,flush=True)
summary=[]
for name,_,D,_ in settings:
 for label in ['baseline-0.4','exact-rational-heap','modular-default']:
  rs=[r for r in rows if r['case']==name and r['degree']==D and r['label']==label];vs=[r['endToEndMs'] for r in rs if not r.get('error')]
  summary.append({'case':name,'degree':D,'mode':label,'runs':len(rs),'successes':len(vs),'medianMs':statistics.median(vs) if vs else None,'minMs':min(vs) if vs else None,'maxMs':max(vs) if vs else None})
(out/'summary.json').write_text(json.dumps({'conditions':'Fresh-process shared WASM32, 4 workers, Node OPFS adapter; all startup, primes, canonicalization, reconstruction and exact certificate included; no text export/Hilbert. Progress off. Baseline from FOMKYR_BASELINE when supplied, otherwise exact rationalHeap=false ablation; see each source path. Rational tier on for both new modes.','summary':summary,'runs':rows},indent=2))
