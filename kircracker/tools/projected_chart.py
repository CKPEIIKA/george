#!/usr/bin/env python3
"""Exact auxiliary-word chart relations, with independent integer replay.

The native tool is a discovery accelerator. Only `replay` emits a relation-rank
receipt. A claimed chart spanning the intended module and validity/namespace of
its input relations remain EXTERNAL dependencies. An upper bound is not a basis.
Every command uses a fresh output path and does not manage or stop live workers.
"""
from __future__ import annotations
import argparse, hashlib, json, math, os, struct, subprocess, sys, time
from pathlib import Path
from typing import BinaryIO
ROOT=Path(__file__).resolve().parents[1]
MASK=(1<<64)-1

def sha(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1<<20),b''):h.update(b)
    return h.hexdigest()
def atomic_json(p:Path,j:dict):
    p.parent.mkdir(parents=True,exist_ok=True)
    t=p.with_name(p.name+'.tmp')
    with t.open('x') as f:json.dump(j,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
    os.replace(t,p)
def integer(f:BinaryIO,n:int)->int:
    b=f.read(n)
    if len(b)!=n:raise ValueError('truncated input')
    return int.from_bytes(b,'little')
def grade(word:int,d:int)->int:
    p=list(range(6))
    for j in reversed(range(d)):
        a=(word>>(4*j))&15
        if a>=5:raise ValueError('invalid star word')
        p[a],p[5]=p[5],p[a]
    result=0
    for i in range(6):result=result*(6-i)+sum(p[j]<p[i] for j in range(i+1,6))
    return result

def read_frame(path:Path,binding:str,group:int):
    # Independent full checksum implementation, separate from native BinaryReader.
    h=1469598103934665603
    def take(f,n):
        nonlocal h
        b=f.read(n)
        if len(b)!=n:raise ValueError('truncated chart')
        for x in b:h=((h^x)*1099511628211)&MASK
        return b
    with path.open('rb') as f:
        if take(f,8)!=b'KKRMAP01' or take(f,64).decode()!=binding:raise ValueError('frame binding/format')
        d,k,p,flags,previous,n,actions=struct.unpack('<IIIIQQQ',take(f,40))
        if not 2<=d<=31 or not 1<=k<=5 or p!=2 or flags or actions:raise ValueError('expected action-free Q-spanning chart encoded over F2')
        words=[]
        for i in range(n):
            b=take(f,20);w=int.from_bytes(b[:16],'little');g=int.from_bytes(b[16:],'little')
            if w>>(4*d) or g>=720:raise ValueError('invalid frame word')
            if g==group:
                if grade(w,d)!=g or any(((w>>(4*j))&15)>=k for j in range(d)):raise ValueError('grade/alphabet mismatch')
                words.append(w)
        if integer(f,8)!=h or f.read(1):raise ValueError('frame checksum/trailing bytes')
    if not words or sorted(set(words))!=words:raise ValueError('frame order/uniqueness')
    return d,k,words

def read_relations(path:Path):
    it=iter(path.read_text().split());k,n=int(next(it)),int(next(it));rels=[]
    if not 1<=k<=5 or not 1<=n<=10000:raise ValueError('library dimensions')
    for _ in range(n):
        d,nt=int(next(it)),int(next(it));poly={}
        if not 1<=d<=31 or not 1<=nt<=100000:raise ValueError('relation dimensions')
        for _ in range(nt):
            c=int(next(it));w=0
            for j in range(d):
                a=int(next(it))
                if not 0<=a<k:raise ValueError('relation alphabet')
                w=(w<<4)|a
            poly[w]=poly.get(w,0)+c
        row=sorted((w,c) for w,c in poly.items() if c)
        if not row or len({grade(w,d)for w,c in row})!=1:raise ValueError('inhomogeneous permutation grade')
        rels.append((d,row))
    if next(it,None) is not None:raise ValueError('trailing library')
    return k,rels

def replay(manifest:Path,receipt:Path,seconds:float=600,max_vectors:int=200000,*,row_sink=None):
    if receipt.exists():raise FileExistsError('receipt exists; choose a new path')
    cfg=json.loads(manifest.read_text());start=time.monotonic()
    if cfg.get('schema')!='kir-projected-chart-1' or not str(cfg.get('namespace','')).strip():raise ValueError('manifest schema/namespace')
    if type(cfg.get('prefixKillMask'))is not int or not 0<=cfg['prefixKillMask']<32 or type(cfg.get('group'))is not int or not 0<=cfg['group']<720:raise ValueError('boundary/group metadata')
    for key in ('frame','relations','trace','freeWords'):
        if sha(Path(cfg[key]))!=cfg[key+'SHA256']:raise ValueError(key+' hash mismatch')
    frame,lib=Path(cfg['frame']),Path(cfg['relations'])
    d,k,words=read_frame(frame,cfg['binding'],cfg['group']);rk,rels=read_relations(lib)
    if rk!=k:raise ValueError('alphabet mismatch')
    index={w:i for i,w in enumerate(words)};width=len(words);boundary=cfg['prefixKillMask']
    if any(boundary&1<<((w>>(4*(d-1)))&15) for w in words):raise ValueError('chart word violates module prefix')
    auxiliary=[];auxwords=set();pivots={};entries=0;operations=0
    def check():
        nonlocal operations
        operations+=1
        if operations%127==0 and time.monotonic()-start>seconds:raise TimeoutError('independent replay budget; no receipt')
    def key(w):return (w not in index,w)
    def primitive(row):
        if not row:return row
        gcd=math.gcd(*row.values())
        if row[max(row,key=key)]<0:gcd=-gcd
        return {w:c//gcd for w,c in row.items()} if gcd!=1 else row
    with Path(cfg['trace']).open('rb') as f:
        if f.read(8)!=b'QCPREL01' or f.read(64).decode()!=cfg['binding']:raise ValueError('trace header')
        if [integer(f,4)for _ in range(5)]!=[d,k,cfg['group'],boundary,width]:raise ValueError('trace scope')
        if [integer(f,16)for _ in words]!=words:raise ValueError('trace chart differs')
        while True:
            check();kind=integer(f,4)
            if kind==0:
                total,na,nr=integer(f,8),integer(f,4),integer(f,4)
                if (total,na,nr)!=(entries,len(auxiliary),len(pivots)) or f.read(1):raise ValueError('trace finalization')
                break
            if kind not in (1,2) or entries>=max_vectors:raise ValueError('trace record limit/kind')
            anchor=integer(f,16);ri,ti,pos,nd=[integer(f,4)for _ in range(4)]
            if ri>=len(rels) or nd>len(auxiliary):raise ValueError('source/dependencies')
            deps=[integer(f,4)for _ in range(nd)];lead=integer(f,16);nm=integer(f,4)
            if nm>width:raise ValueError('modular dependencies')
            moddeps=[integer(f,4)for _ in range(nm)]
            rd,ts=rels[ri]
            if anchor>>(4*d) or any(((anchor>>(4*j))&15)>=k for j in range(d)) or ti>=len(ts) or pos+rd>d or ((anchor>>(4*pos))&((1<<(4*rd))-1))!=ts[ti][0] or grade(anchor,d)!=cfg['group']:raise ValueError('invalid original context')
            pre=anchor>>(4*(pos+rd));suf=anchor&((1<<(4*pos))-1);row={}
            for w,c in ts:
                v=(pre<<(4*(rd+pos)))|(w<<(4*pos))|suf
                if grade(v,d)!=cfg['group']:raise ValueError('source changes grade')
                if boundary&1<<((v>>(4*(d-1)))&15):continue
                row[v]=row.get(v,0)+c
            row=primitive({w:c for w,c in row.items()if c})
            for dep in deps:
                check()
                if dep>=len(auxiliary) or not row:raise ValueError('unknown/empty exact dependency')
                aw,other=auxiliary[dep];current=max(row,key=key)
                if current!=aw or current in index:raise ValueError('incorrect auxiliary elimination pivot')
                g=math.gcd(row[aw],other[aw]);a=other[aw]//g;b=row[aw]//g
                row={w:a*c for w,c in row.items()}
                for w,c in other.items():row[w]=row.get(w,0)-b*c
                row=primitive({w:c for w,c in row.items()if c})
            if not row:raise ValueError('zero reported independent vector')
            if kind==1:
                if moddeps or max(row,key=key)!=lead or lead in index or lead in auxwords:raise ValueError('auxiliary pivot record')
                auxwords.add(lead);auxiliary.append((lead,row))
            else:
                if any(w not in index for w in row):raise ValueError('UNCANCELLED auxiliary term (including even coefficients)')
                odd={index[w] for w,c in row.items()if c%2}
                for p in moddeps:
                    check()
                    if not odd or max(odd)!=p or p not in pivots:raise ValueError('invalid independent F2 pivot')
                    odd.symmetric_difference_update(pivots[p])
                if not odd or lead not in index or max(odd)!=index[lead] or index[lead] in pivots:raise ValueError('zero/nontriangular chart pivot')
                pivots[index[lead]]=odd
                if row_sink is not None:
                    row_sink(len(pivots)-1, {index[w]:c for w,c in row.items()})
            entries+=1
    expected=b''.join(w.to_bytes(16,'little')for i,w in enumerate(words)if i not in pivots)
    if Path(cfg['freeWords']).read_bytes()!=expected:raise ValueError('free chart-word file mismatch')
    result=json.loads(Path(cfg['result']).read_text())
    if result['projectedRelationRank']!=len(pivots) or result['auxiliaryPivots']!=len(auxiliary) or result['chartColumns']!=width or result['upperCandidate']!=width-len(pivots):raise ValueError('discovery result mismatches exact replay')
    proof={'passed':True,'schema':'kir-projected-chart-receipt-1','namespace':cfg['namespace'],'degree':d,'group':cfg['group'],'chartColumns':width,'exactAuxiliaryPivots':len(auxiliary),'replayedProjectedRelationRank':len(pivots),'rationalDimensionUpperBound':width-len(pivots),'exactDimension':False,'chartSpanningCertificateReplayed':False,'inputRelationValidityExternal':True,'moduleBoundary':{'prefixKillMask':boundary,'authority':'explicit cyclic-right-module boundary' if boundary else 'none'},'direction':'nonzero minor mod2 of EXACT Q-relations supported in original chart bounds rank over Q from below','projectionArithmetic':'independent Python integers; no modular exterior cancellation','seconds':time.monotonic()-start,'inputManifestSHA256':sha(manifest),'bindings':{x:cfg[x+'SHA256']for x in ('frame','relations','trace','freeWords')}}
    atomic_json(receipt,proof);return proof

def main():
    p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='mode',required=True)
    s=sub.add_parser('discover');s.add_argument('--frame',type=Path,required=True);s.add_argument('--relations',type=Path,required=True);s.add_argument('--binding',required=True);s.add_argument('--group',type=int,required=True);s.add_argument('--namespace',required=True,help='explicit source namespace, e.g. FK-star/Q14; never infer Nichols equality')
    s.add_argument('--out',type=Path,required=True);s.add_argument('--seconds',type=float,default=120);s.add_argument('--memory-bytes',type=int,default=2<<30);s.add_argument('--max-aux-pivots',type=int,default=20000);s.add_argument('--max-aux-words',type=int,default=20000);s.add_argument('--max-depth',type=int,default=1);s.add_argument('--prefix-kill-mask',type=int,default=0,help='0=no boundary;15=kills first letters 0,1,2,3, ONLY for that certified cyclic right module')
    s.add_argument('--anchors',choices=('first','all'),default='all');s.add_argument('--binary',type=Path,default=ROOT/'bin/kir-projected-relations')
    s=sub.add_parser('replay');s.add_argument('--manifest',type=Path,required=True);s.add_argument('--receipt',type=Path,required=True);s.add_argument('--seconds',type=float,default=600);s.add_argument('--max-vectors',type=int,default=200000)
    a=p.parse_args()
    if a.mode=='replay':print(json.dumps(replay(a.manifest,a.receipt,a.seconds,a.max_vectors),indent=2));return
    if a.out.exists():raise FileExistsError('new output directory required')
    frame=a.frame.resolve();relations=a.relations.resolve();fhash=sha(frame);rhash=sha(relations)
    if not a.namespace.strip():raise ValueError('namespace is required')
    cmd=[str(a.binary.resolve()),str(frame),str(relations),a.binding,str(a.out.resolve()),str(a.group),str(a.seconds),str(a.memory_bytes),str(a.max_aux_pivots),str(a.max_aux_words),str(a.max_depth),str(a.prefix_kill_mask),a.anchors]
    q=subprocess.run(cmd)
    if q.returncode:raise RuntimeError(f'discovery failed ({q.returncode}); no valid receipt published')
    if sha(frame)!=fhash or sha(relations)!=rhash:raise ValueError('input changed during discovery')
    trace=a.out/'projected.qpr';free=a.out/'free-words.bin';cfg={'schema':'kir-projected-chart-1','namespace':a.namespace,'frame':str(frame),'frameSHA256':fhash,'relations':str(relations),'relationsSHA256':rhash,'binding':a.binding,'group':a.group,'prefixKillMask':a.prefix_kill_mask,'trace':str(trace.resolve()),'traceSHA256':sha(trace),'freeWords':str(free.resolve()),'freeWordsSHA256':sha(free),'result':str((a.out/'RESULT.json').resolve()),'binarySHA256':sha(a.binary),'commands':cmd,'independentReplayRequired':True,'fullHighDegreeSpanningAuthorityExternal':True}
    atomic_json(a.out/'MANIFEST.json',cfg);print(json.dumps(json.loads((a.out/'RESULT.json').read_text()),indent=2))
if __name__=='__main__':
    try:main()
    except (ValueError,OSError,RuntimeError,TimeoutError,StopIteration) as ex:print(f'ERROR: {ex}',file=sys.stderr);sys.exit(2)
