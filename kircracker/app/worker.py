#!/usr/bin/env python3
"""Isolated memory-limited jobs. Invoked by the CLI, not normally by the user."""
from __future__ import annotations
import argparse,ctypes as C,json,os,sys,time
from pathlib import Path
from .util import ROOT,Invalid,Incomplete,atomic_json,load,sha,json_hash
from .records import read_minor,write_minor,packed,unpacked,check_minor
from .native import libraries,buffer,verify_words

def verify_task(task):
 t=time.monotonic();path=Path(task['minor']);m,us,vs=read_minor(path)
 if sha(path)!=task['sha256']:raise Invalid('minor input binding changed')
 result=verify_words(m,packed(us),packed(vs),threads=task.get('threads',1));grade=check_minor(m,us,vs)
 return {'passed':True,'degree':m['degree'],'rank':m['rank'],'lowerGrades':{str(g):v for g,v in grade.items()},'minorSHA256':task['sha256'],'verifierFingerprint':task['fingerprint'],'seconds':time.monotonic()-t,**result}

def discover_task(task):
 t=time.monotonic();d=task['degree'];nr=task['rows'];nv=task['duals']
 if not 1<=nr<=10000 or not 1<=nv<=1000000:raise Incomplete('native per-block row/dual limit; preserve bounds and enlarge kernel with tests before increasing')
 for key in ['left','right']:
  if sha(Path(task[key]))!=task[key+'SHA256']:raise Invalid('candidate binding changed')
 lraw=Path(task['left']).read_bytes();rraw=Path(task['right']).read_bytes()
 if len(lraw)!=nr*16 or len(rraw)!=nv*16:raise Invalid('candidate word count')
 pair,_=libraries();ctx=pair.kp_create(6,task['prime'],0)
 if not ctx:raise Incomplete('cannot initialize pairing context')
 ri=(C.c_int*nr)();ci=(C.c_int*nr)();mat=(C.c_int*(nr*nr))();stats=(C.c_uint64*6)()
 try:rank=pair.kp_minor_trie_wide(ctx,buffer(lraw),nr,buffer(rraw),nv,d,ri,ci,mat,stats,float(task.get('seconds') or 1e12))
 finally:pair.kp_destroy(ctx)
 if rank<0:raise Incomplete(f'discovery stopped (code {rank}); no unchecked block is accepted')
 if Path(task['minor']).exists():
  oldmeta,oldu,oldv=read_minor(task['minor'])
  if oldmeta['degree']==d and oldmeta['grade']==task['grade'] and oldmeta['rank']>rank:
   oldcheck=verify_words(oldmeta,packed(oldu),packed(oldv));oldgrades=check_minor(oldmeta,oldu,oldv)
   return {'passed':True,'degree':d,'rank':oldmeta['rank'],'candidateRows':nr,'candidateColumns':nv,'candidateDeficit':max(0,nr-oldmeta['rank']),'lowerGrades':{str(g):n for g,n in oldgrades.items()},'minorSHA256':sha(Path(task['minor'])),'taskBinding':task['binding'],'verifierFingerprint':task['fingerprint'],'preservedStrongerPreviousMinor':True,'seconds':time.monotonic()-t,**oldcheck}
 if rank==0:return {'passed':True,'degree':d,'rank':0,'lowerGrades':{},'noNonzeroMinor':True,'candidateRows':nr,'candidateColumns':nv,'seconds':time.monotonic()-t,'taskBinding':task['binding']}
 if len(set(ri[i] for i in range(rank)))!=rank or len(set(ci[i] for i in range(rank)))!=rank:raise Invalid('duplicate pivot indices')
 if any(not 0<=ri[i]<nr or not 0<=ci[i]<nv for i in range(rank)):raise Invalid('invalid pivot indices')
 a=b''.join(lraw[ri[i]*16:(ri[i]+1)*16] for i in range(rank));b=b''.join(rraw[ci[i]*16:(ci[i]+1)*16] for i in range(rank))
 del lraw,rraw
 meta={'degree':d,'rank':rank,'prime':task['prime'],'grade':task['grade'],'transports':task['transports'],'origin':'fresh suffix discovery + independent integer prefix replay'}
 found=time.monotonic()-t
 result=verify_words(meta,a,b,expected=mat,threads=1);meta['determinant']=result['determinant'];del mat
 us=unpacked(a,d);vs=unpacked(b,d);grades=check_minor(meta,us,vs);digest=write_minor(Path(task['minor']),meta,us,vs)
 return {'passed':True,'degree':d,'rank':rank,'candidateRows':nr,'candidateColumns':nv,'candidateDeficit':nr-rank,'fullCandidateRank':rank==nr,'lowerGrades':{str(k):v for k,v in grades.items()},'minorSHA256':digest,'discoverySeconds':found,'seconds':time.monotonic()-t,'nativeStats':list(stats),'taskBinding':task['binding'],'verifierFingerprint':task['fingerprint'],**result}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('kind',choices=['verify','discover']);ap.add_argument('task',type=Path);ap.add_argument('output',type=Path);a=ap.parse_args();task=load(a.task)
 result=verify_task(task) if a.kind=='verify' else discover_task(task)
 atomic_json(a.output,result);print(json.dumps(result),flush=True)
if __name__=='__main__':
 try:main()
 except (Invalid,Incomplete,MemoryError) as e:print(str(e),file=sys.stderr);sys.exit(3)
