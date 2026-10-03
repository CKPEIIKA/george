#!/usr/bin/env python3
"""Independent completion past a WASM timeout; outputs reference, not fomkyr timings."""
import json,sys,time,signal
from pathlib import Path
from exact_reference import Reducer,monic,compositions,hseries
from fractions import Fraction
R=Path(__file__).resolve().parent
name=sys.argv[1];D=int(sys.argv[2]);seconds=int(sys.argv[3]) if len(sys.argv)>3 else 90
out=R/'references'/(name+('-resumed' if len(sys.argv)>4 else ''));out.mkdir(parents=True,exist_ok=True);f=json.loads((R.parents[1]/'fixtures/published'/f'{name}.json').read_text());rels=[{tuple(t['word']):Fraction(t['coefficient']) for t in r['terms']} for r in f['relations']]
gs=[];nr=Reducer(gs);t=time.monotonic();report={'case':name,'target':D,'engine':'independent Python Fraction reference','constructionThroughDegree':0,'certifiedThroughDegree':0,'stages':[],'status':'running'}
def save():
 report['elapsedSeconds']=time.monotonic()-t
 (out/'report.tmp').write_text(json.dumps(report,indent=2));(out/'report.tmp').replace(out/'report.json')
def insert(row):
 global nr
 rem=nr.nf(row)
 if rem:gs.append(monic(rem));nr=Reducer(gs)
def interrupt(signum,frame):raise TimeoutError('independent reference time budget')
signal.signal(signal.SIGALRM,interrupt);signal.alarm(seconds)
try:
 start_degree=1
 if len(sys.argv)>4:
  source=Path(sys.argv[4]);saved=json.loads(source.read_text());gs=[{tuple(w):Fraction(c) for w,c in row} for row in saved['rows']];nr=Reducer(gs)
  for rel in rels:assert not nr.nf(rel)
  for comp in compositions(gs,bound=saved['degree']):assert not nr.nf(comp)
  start_degree=saved['degree']+1;report['restoredFromDegree']=saved['degree'];report['restoredBasis']=str(source);report['certifiedThroughDegree']=saved['degree'];save()
 for d in range(start_degree,D+1):
  for rel in rels:
   if len(next(iter(rel)))==d:insert(rel)
  old=list(gs)
  for c in compositions(old,degree=d,bound=d,include=False):insert(c)
  report['constructionThroughDegree']=d;report['rules']=len(gs)
  # Certificate at each frontier: every overlap and inclusion, plus input inclusion.
  ct=0
  for rel in rels:
   if len(next(iter(rel)))<=d:assert not nr.nf(rel)
  for c in compositions(gs,bound=d):assert not nr.nf(c);ct+=1
  report['certifiedThroughDegree']=d;report['stages'].append({'degree':d,'rules':len(gs),'criticalCompositions':ct,'elapsedSeconds':time.monotonic()-t})
  rows=[[[list(w),str(c)] for w,c in sorted(g.items(),reverse=True)] for g in gs]
  (out/'basis.tmp').write_text(json.dumps({'degree':d,'rows':rows}));(out/'basis.tmp').replace(out/'basis.json');save();print(name,d,len(gs),time.monotonic()-t,flush=True)
 report['status']='completed';report['hilbert']=list(map(str,hseries(gs,len(f['variables']),D)))
 if f.get('expectedHilbert'):assert report['hilbert']==f['expectedHilbert'][:D+1];report['publishedHilbertAgrees']=True
except TimeoutError as e:report['status']='timeout';report['error']=str(e)
except Exception as e:report['status']='failed';report['error']=repr(e);raise
finally:signal.alarm(0);save()
