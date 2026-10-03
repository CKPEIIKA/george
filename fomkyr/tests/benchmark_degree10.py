#!/usr/bin/env python3
import subprocess,json,statistics,argparse
from pathlib import Path
R=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--baseline',type=Path,default=R.parent/'baseline');ap.add_argument('--repeats',type=int,default=3);args=ap.parse_args()
base=args.baseline;out=R/'results/speed';out.mkdir(exist_ok=True);rows=[]
configs=[('baseline',base,True),('optimized',R,True),('optimized',R,False)]
for rep in range(args.repeats):
 for label,root,progress in (configs if rep%2==0 else list(reversed(configs))):
  name=f'd10-{label}-w4-p{int(progress)}-r{rep}';p=out/(name+'.json')
  cmd=['node','--experimental-wasm-memory64',str(R/'tests/speed_trial.mjs'),str(root),'10','4','on' if progress else 'off',str(p)]
  if rep==0:cmd.append(str(out/(name+'.gnb')))
  subprocess.run(cmd,check=True,timeout=240);r=json.loads(p.read_text());r.update(variant=label,repeat=rep,file=str(p.relative_to(R)));rows.append(r)
summary=[]
for label,_,progress in configs:
 xs=[x for x in rows if x['variant']==label and x['progress']==progress];ts=[x['result']['elapsedMs'] for x in xs]
 summary.append({'variant':label,'workers':4,'progress':progress,'trials':len(xs),'medianMs':statistics.median(ts),'minMs':min(ts),'maxMs':max(ts),'medianReduceMs':statistics.median(x['result']['scheduler']['reduceMs'] for x in xs),'medianCommitMs':statistics.median(x['result']['scheduler']['commitMs'] for x in xs)})
report={'case':'FK6 degree10 over Q','conditions':'Same as degree9 benchmark; genuine WASM32, 4 shared lanes, node:fs adapter. Module/worker initialization excluded. No Hilbert/export. 128MiB budget,32MiB scratch. Alternating sequential processes.','summary':summary,'trials':[{'file':x['file'],'variant':x['variant'],'repeat':x['repeat']} for x in rows]}
(out/'benchmark-degree10.json').write_text(json.dumps(report,indent=2));print(json.dumps(summary,indent=2))
