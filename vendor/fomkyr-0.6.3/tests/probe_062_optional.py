"""Small, matched optional-feature ablations on the same final binary."""
from pathlib import Path
import subprocess,os,json
R=Path(__file__).resolve().parents[1];out=R/'results/0.6.2/optional-ablations';out.mkdir(parents=True,exist_ok=True);summary=[]
work=[]
for t in range(3):
 modes=[('growth-on',{}),('growth-off',{'growingRationalHeap':False})]
 if t%2:modes.reverse()
 for mode,opt in modes:work.append(('lp1',13,mode,t,opt))
work.extend([('affine-q-serre-q2',20,'big-on',0,{}),('affine-q-serre-q2',20,'big-off',0,{'bigRationalHeap':False})])
for name,d,mode,t,opt in work:
 dest=out/f'{name}-{mode}-{t}';dest.mkdir()
 options={'workers':4,'bits':32,'budgetBytes':512<<20,'scratchBytes':128<<20,'hashBits':16,'resume':False,'spill':True,'hilbert':True,'exportText':True,'progress':True,'progressIntervalMs':5000,'timeoutMs':30000,**opt}
 with (dest/'console.log').open('w') as log:
  subprocess.run(['node','--experimental-wasm-memory64',str(R/'tests/deep_trial.mjs'),str(R/'fixtures/published'/f'{name}.json'),str(d),str(dest)],cwd=R,env=os.environ|{'FOMKYR_SOURCE':str(R),'TRIAL_OPTIONS':json.dumps(options)},stdout=log,stderr=subprocess.STDOUT,timeout=45)
 data=json.loads((dest/'report.json').read_text());summary.append({'case':name,'degree':d,'mode':mode,'trial':t,'status':data['status'],'elapsedSeconds':data['elapsedMs']/1000,'output':str(dest),'options':options});(out/'summary.json').write_text(json.dumps(summary,indent=2));print(summary[-1],flush=True)
