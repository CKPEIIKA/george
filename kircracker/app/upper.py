from __future__ import annotations
from collections import Counter
import json,os,struct,sys,time
from pathlib import Path
from .util import ROOT,load,sha,json_hash,atomic_json,Incomplete,Invalid
from .records import state_info,state_words,PERMS

SEMANTICS='relative-original-relation-F2-packed-checkpoint-v1'
def library(runner):
 out=runner.work/'library';out.mkdir(exist_ok=True);inputs={'base':sha(ROOT/'data/base-through13.json'),'radical':sha(ROOT/'data/degree14-radical.json'),'proofCode':sha(ROOT/'tools/star_relations.py')};finger=json_hash(inputs)
 cp=out/'verified.json'
 if cp.exists():
  v=load(cp)
  if v.get('binding')==finger and all((out/n).exists() and sha(out/n)==h for n,h in v['files'].items()):return v
 runner.event('library_proof',message='Verifying original relation identities')
 _,secs=runner.run([sys.executable,'tools/prepare_inputs.py',str(out)],out/'proof.log',memory=min(runner.memory,2*1024**3))
 v=load(cp)
 if not v.get('passed') or v['binding']!=finger:raise Invalid('original relation library proof failed')
 return v

def run_upper(runner,D,namespace,seconds=0):
 proof=library(runner);source=runner.work/'library'/(namespace+'.rel');out=runner.work/'upper'/namespace;out.mkdir(parents=True,exist_ok=True)
 binding=json_hash({'semantics':SEMANTICS,'namespace':namespace,'relationsSHA256':sha(source),'field':2,'generators':5})
 old=out/'binding.json'
 if old.exists() and load(old).get('binding')!=binding:raise Invalid('upper checkpoint belongs to a different presentation')
 atomic_json(old,{'binding':binding,'namespace':namespace,'relationsSHA256':sha(source)})
 levels=[out/f'level-{d:03d}.krm' for d in range(D+1)]
 result=out/f'through-{D:02d}.json'
 if all(p.exists() for p in levels) and result.exists():
  r=load(result)
  if r.get('binding')==binding and set(r.get('fileSHA256',{}))=={p.name for p in levels} and all(sha(out/f)==h for f,h in r.get('fileSHA256',{}).items()):runner.event('upper_reused',namespace=namespace,degree=D);return r
 # The cap covers this whole process, including allocator overhead; per-object
 # limits still reject absurd arithmetic/table sizes before their allocation.
 maxcols=min(30_000_000,max(100000,runner.memory//80));maxterms=min(4_000_000_000,max(1000000,runner.memory//8))
 cmd=[ROOT/'bin/kir-relative','--n','6','--degree',str(D),'--prime','2','--gf2-packed','--threads',str(min(32,runner.jobs)),'--relations',source,'--state',out,'--bind',binding,'--resume','--max-cols',str(maxcols),'--max-terms',str(maxterms),'--seconds',str(seconds or 1e12)]
 runner.event('upper_started',namespace=namespace,degree=D,jobs=min(32,runner.jobs),budgetGiB=round(runner.memory/1024**3,2))
 def update(v):
  if v.get('type')=='degree':runner.event('upper_degree',namespace=namespace,degree=v['degree'],dimension=v['relativeUpperDimension'],seconds=v['seconds'],rssMiB=round(v['peakRSSBytes']/1048576,1))
 last,secs=runner.run(cmd,out/f'run-to-{D:02d}.log',seconds=seconds+15 if seconds else 0,parser=update)
 if not last or not last.get('complete') or last['completedThrough']!=D:raise Incomplete('upper calculation incomplete')
 counts=[];hashes={}
 for d,p in enumerate(levels):
  info=state_info(p,binding)
  if info['degree']!=d or info['prime']!=2 or info['words']!=last['relative'][d]:raise Invalid('upper saved-level inconsistency')
  count=Counter(g for _,g in state_words(p,binding));counts.append({str(g):x for g,x in count.items()});hashes[p.name]=sha(p)
 r={'passed':True,'type':'presented-model-Q-upper-bound','namespace':namespace,'degree':D,'binding':binding,'relative':last['relative'],'grades':counts,'fileSHA256':hashes,'nativeResult':last,'wallSeconds':secs,'originalFKExactDimension':False}
 atomic_json(result,r);runner.event('upper_complete',namespace=namespace,degree=D,dimension=sum(map(int,counts[-1].values())));return r
