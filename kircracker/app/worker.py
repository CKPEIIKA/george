#!/usr/bin/env python3
"""Separate discovery and independent verification so each gets a fresh budget."""
from __future__ import annotations
import argparse,ctypes as C,json,os,sys,time,zipfile,tempfile,contextlib,mmap,struct
from pathlib import Path
from .util import ROOT,Invalid,Incomplete,atomic_json,load,sha,json_hash
from .records import read_minor,write_minor,packed,unpacked,check_minor
from .native import libraries,buffer,verify_words
from .limits import EXACT_DEGREE,MAX_ROWS,MAX_DUALS

def verify_task(task):
 t=time.monotonic();path=Path(task['minor']);m,us,vs=read_minor(path)
 if sha(path)!=task['sha256']:raise Invalid('minor input binding changed')
 result=verify_words(m,packed(us),packed(vs),threads=task.get('threads',1));grade=check_minor(m,us,vs)
 return {'passed':True,'degree':m['degree'],'rank':m['rank'],'lowerGrades':{str(g):v for g,v in grade.items()},'minorSHA256':task['sha256'],'verifierFingerprint':task['fingerprint'],'seconds':time.monotonic()-t,**result}

def pending_path(task):return Path(task['output']).with_suffix('.pending.kcp')

def save_pending(task,meta,left,right,extra):
 path=pending_path(task);path.parent.mkdir(parents=True,exist_ok=True);fd,tmp=tempfile.mkstemp(prefix='.candidate-',dir=path.parent);os.close(fd)
 try:
  with zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED,compresslevel=1)as z:
   z.writestr('metadata.json',json.dumps({**meta,'status':'UNVERIFIED_CANDIDATE','isProof':False,'taskBinding':task['binding'],'discovery':extra},sort_keys=True));z.writestr('left.bin',left);z.writestr('right.bin',right)
  with open(tmp,'rb')as f:os.fsync(f.fileno())
  os.replace(tmp,path)
  directory=os.open(path.parent,os.O_RDONLY|os.O_DIRECTORY)
  try:os.fsync(directory)
  finally:os.close(directory)
 except BaseException:
  with contextlib.suppress(OSError):os.unlink(tmp)
  raise
 return {'pendingVerification':True,'passed':False,'degree':meta['degree'],'candidateRank':meta['rank'],'pending':str(path),'pendingSHA256':sha(path),'taskBinding':task['binding'],**extra}

def verify_pending_task(task):
 started=time.monotonic();path=Path(task.get('pending')or pending_path(task))
 if sha(path)!=task['pendingSHA256']:raise Invalid('pending candidate changed')
 with zipfile.ZipFile(path)as z:
  if len(z.namelist())!=3 or set(z.namelist())!={'metadata.json','left.bin','right.bin'}or z.getinfo('metadata.json').file_size>65536:raise Invalid('pending candidate members')
  meta=json.loads(z.read('metadata.json'));rank=meta.get('rank');degree=meta.get('degree')
  if type(rank)is not int or not 1<=rank<=MAX_ROWS or type(degree)is not int or not 0<=degree<=EXACT_DEGREE:raise Invalid('pending dimensions')
  if meta.get('degree')!=task['degree']or meta.get('prime')!=task['prime']or meta.get('grade')!=task['grade']:raise Invalid('pending task scope')
  if meta.get('taskBinding')!=task['binding']or any(z.getinfo(n).file_size!=rank*16 for n in ['left.bin','right.bin']):raise Invalid('pending input binding')
  left,right=z.read('left.bin'),z.read('right.bin')
 progress={k:meta.get('discovery',{}).get(k)for k in ['nextColumn','candidateColumnsExhausted']}
 meta={k:meta[k]for k in ['degree','rank','prime','grade','transports','origin']};us,vs=unpacked(left,degree),unpacked(right,degree)
 # This synthetic nonzero value checks word/transport structure only. It is
 # never persisted or used as a rank witness; the actual determinant follows.
 check_minor({**meta,'determinant':1},us,vs)
 candidate_rank=rank;minor=Path(task['minor']);retained=False
 if minor.exists():
  old,oldus,oldvs=read_minor(minor);check_minor(old,oldus,oldvs)
  if old['degree']!=degree or old['grade']!=meta['grade']:raise Invalid('retained minor has a different mathematical scope')
  if old['rank']>rank:
   # A broader candidate family can find a smaller minor. Replay the stronger
   # retained witness with this verifier, preserving its bytes and determinant.
   meta,us,vs=old,oldus,oldvs;rank=old['rank'];left,right=packed(us),packed(vs);retained=True
 atomic_json(Path(task['output']).with_suffix('.progress.json'),{'stage':'independent-integer-replay','candidateRank':candidate_rank,'replayRank':rank,'verified':False,'startedUnix':time.time()})
 from .verified_cache import enabled
 cache=Path(task['output']).with_suffix('.verified-lu')if enabled()else None
 result=verify_words(meta,left,right,threads=task.get('threads',1),cache=cache,fingerprint=task['fingerprint']);meta['determinant']=result['determinant'];grades=check_minor(meta,us,vs)
 digest=sha(minor)if retained else write_minor(minor,meta,us,vs)
 return {'passed':True,'degree':degree,'rank':rank,'candidateRows':task['rows'],'candidateColumns':task['duals'],'candidateDeficit':max(0,task['rows']-rank),'fullCandidateRank':rank>=task['rows'],'retainedStrongerMinor':retained,'lowerGrades':{str(g):n for g,n in grades.items()},'minorSHA256':digest,'taskBinding':task['binding'],'verifierFingerprint':task['fingerprint'],'seconds':time.monotonic()-started,'independentAuditProcess':True,**progress,**result}

def discover_task(task):
 t=time.monotonic();d=task['degree'];nr=task['rows'];nv=task['duals']
 if not 0<=d<=EXACT_DEGREE or not 1<=nr<=MAX_ROWS or not 1<=nv<=MAX_DUALS:raise Incomplete('pairing dimensions exceed native format limits')
 for key in ['left','right']:
  if sha(Path(task[key]))!=task[key+'SHA256']:raise Invalid('candidate binding changed')
 with contextlib.ExitStack()as maps:
  leftfile=maps.enter_context(Path(task['left']).open('rb'));rightfile=maps.enter_context(Path(task['right']).open('rb'))
  if os.fstat(leftfile.fileno()).st_size!=nr*16 or os.fstat(rightfile.fileno()).st_size!=nv*16:raise Invalid('candidate word count')
  lraw=maps.enter_context(mmap.mmap(leftfile.fileno(),0,access=mmap.ACCESS_COPY));rraw=maps.enter_context(mmap.mmap(rightfile.fileno(),0,access=mmap.ACCESS_COPY))
  if len(lraw)!=nr*16 or len(rraw)!=nv*16:raise Invalid('candidate word count')
  pair,_=libraries();ctx=pair.kp_create(6,task['prime'],0)
  if not ctx:raise Incomplete('cannot initialize pairing context')
  ri=(C.c_int*nr)();ci=(C.c_int*nr)();stats=(C.c_uint64*6)()
  for name,key in [('KIR_PAIR_STATE','state'),('KIR_PAIR_STATE_BINDING','stateBinding'),('KIR_WORKER_BYTES','memoryBytes'),('KIR_CHECKPOINT_BYTES','checkpointBytes')]:
   if key in task:os.environ[name]=str(task[key])
  try:rank=pair.kp_minor_trie_wide(ctx,buffer(lraw),nr,buffer(rraw),nv,d,ri,ci,None,stats,float(task.get('seconds')or 1e12))
  finally:pair.kp_destroy(ctx)
  if rank<0:
   detail=pair.kp_engine_error().decode('utf8','replace')if hasattr(pair,'kp_engine_error')else''
   raise Incomplete(f'discovery stopped ({rank}): {detail}; committed checkpoint retained')
  cursor=int(stats[2])
  if task.get('state'):
   with Path(task['state']).open('rb')as state:header=state.read(100)
   if len(header)!=100 or header[:8]!=b'FKPAIR02'or header[8:72].decode()!=task['stateBinding']:raise Invalid('discovery checkpoint header binding')
   n,p,degree,rows,duals,cursor,saved_rank=struct.unpack('<7i',header[72:])
   if(n,p,degree,rows,duals,saved_rank)!=(6,task['prime'],d,nr,nv,rank)or not rank<=cursor<=nv:raise Invalid('discovery checkpoint header shape')
  progress={'nextColumn':cursor,'candidateColumnsExhausted':cursor==nv}
  if rank==0:return {'passed':True,'degree':d,'rank':0,'lowerGrades':{},'noNonzeroMinor':True,'candidateRows':nr,'candidateColumns':nv,'seconds':time.monotonic()-t,'taskBinding':task['binding'],'verifierFingerprint':task['fingerprint'],**progress}
  if len(set(ri[i]for i in range(rank)))!=rank or len(set(ci[i]for i in range(rank)))!=rank:raise Invalid('duplicate pivot indices')
  if any(not 0<=ri[i]<nr or not 0<=ci[i]<nv for i in range(rank)):raise Invalid('invalid pivot indices')
  a=b''.join(lraw[ri[i]*16:(ri[i]+1)*16]for i in range(rank));b=b''.join(rraw[ci[i]*16:(ci[i]+1)*16]for i in range(rank))
  meta={'degree':d,'rank':rank,'prime':task['prime'],'grade':task['grade'],'transports':task['transports'],'origin':'suffix discovery followed by separate independent integer-prefix replay'}
  return save_pending(task,meta,a,b,{'discoverySeconds':time.monotonic()-t,'nativeStats':list(stats),**progress})

def main():
 ap=argparse.ArgumentParser();ap.add_argument('kind',choices=['verify','discover','verify-pending']);ap.add_argument('task',type=Path);ap.add_argument('output',type=Path);a=ap.parse_args();task=load(a.task)
 result={'verify':verify_task,'discover':discover_task,'verify-pending':verify_pending_task}[a.kind](task)
 # Discovery receipts never overwrite the last accepted audit.
 atomic_json(a.output.with_suffix('.discovery.json')if a.kind=='discover'else a.output,result);print(json.dumps(result),flush=True)
if __name__=='__main__':
 try:main()
 except (Invalid,Incomplete,MemoryError)as e:print(str(e),file=sys.stderr);sys.exit(3)
