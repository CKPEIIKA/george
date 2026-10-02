#!/usr/bin/env python3
"""Run same-host isolated trials in alternating order. Not browser benchmarks."""
import argparse,subprocess,json,statistics,time,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--baseline',type=Path,required=True);ap.add_argument('--repeats',type=int,default=3);a=ap.parse_args()
out=R/'results/speed';out.mkdir(exist_ok=True);trials=[]
configs=[('baseline',a.baseline,1,True),('optimized',R,1,True),('baseline',a.baseline,4,True),('optimized',R,4,True),('optimized',R,4,False)]
for rep in range(a.repeats):
    for label,root,workers,progress in (configs if rep%2==0 else list(reversed(configs))):
        name=f'd9-{label}-w{workers}-p{int(progress)}-r{rep}';p=out/(name+'.json');record=str(out/(name+'.gnb')) if rep==0 and progress and workers==4 else ''
        cmd=['node','--experimental-wasm-memory64',str(R/'tests/speed_trial.mjs'),str(root),'9',str(workers),'on' if progress else 'off',str(p)]
        if record:cmd.append(record)
        subprocess.run(cmd,check=True,timeout=120)
        x=json.loads(p.read_text());x.update(label=label,repeat=rep,rawFile=str(p.relative_to(R)));trials.append(x)
summary=[]
for label,_,workers,progress in configs:
    xs=[x for x in trials if (x['label'],x['workersRequested'],x['progress'])==(label,workers,progress)]
    summary.append({'variant':label,'workers':workers,'progress':progress,'trials':len(xs),'medianMs':statistics.median(x['result']['elapsedMs'] for x in xs),'minMs':min(x['result']['elapsedMs'] for x in xs),'maxMs':max(x['result']['elapsedMs'] for x in xs),'medianReduceMs':statistics.median(x['result']['scheduler']['reduceMs'] for x in xs),'medianCommitMs':statistics.median(x['result']['scheduler']['commitMs'] for x in xs)})
report={'case':'FK6 original 15-generator, 100-relation presentation over Q, degree9','conditions':'O3/LTO builds from both roots on same host; genuine shared WASM32; module/worker initialization excluded; fs adapter, NOT browser OPFS; no Hilbert/text export; 128MiB budget/32MiB scratch, batch8*workers','summary':summary,'trials':[{'file':x['rawFile'],'variant':x['label'],'repeat':x['repeat']} for x in trials]}
(out/'benchmark.json').write_text(json.dumps(report,indent=2));print(json.dumps(summary,indent=2))
