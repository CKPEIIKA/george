#!/usr/bin/env python3
"""Independent exact normalization and comparison of homogeneous basis records.

This is an audit tool, not a Groebner certification algorithm. It verifies a
minimal leading-word antichain and irreducibility of every proper subword of
stored tails, then tail-reduces by a triangular same-degree substitution. No C
matcher, compiled rewrite table or native arithmetic is reused. An input failing
these preconditions is rejected, never silently declared unequal/equal.
"""
from __future__ import annotations
import argparse, hashlib, json, struct, sys, time, tempfile, shutil, math, gc
from collections import deque
from fractions import Fraction
from pathlib import Path
from typing import Iterable

class AuditError(ValueError): pass
MASK=(1<<64)-1

def records(path: Path, degree: int, generators: int, max_record_bytes=256<<20):
    with path.open('rb') as f:
        while True:
            header=f.read(32)
            if not header:return
            if len(header)!=32:raise AuditError('Truncated record header')
            magic,size,n,d,checksum,reserved=struct.unpack('<IIIIQQ',header)
            if magic!=0x31424e47 or size<32 or size>max_record_bytes or n<1 or 32+24*n>size or d<1 or reserved:
                raise AuditError('Invalid record header')
            if d>degree:return # later partial degrees are not in this audit window
            data=header+f.read(size-32)
            if len(data)!=size:raise AuditError('Truncated record')
            h=1469598103934665603
            for byte in data[32:]: h=((h^byte)*1099511628211)&MASK
            if h!=checksum:raise AuditError('Record checksum mismatch')
            p={}
            previous=None
            for i in range(n):
                lo,hi,c=struct.unpack_from('<QQQ',data,32+24*i)
                if hi>>63:
                    if d<=31 or lo<32+24*n or lo+d>size:raise AuditError('Invalid long-word offset')
                    word=tuple(data[lo:lo+d])
                else:
                    if d>31:raise AuditError('Invalid inline word length')
                    value=(hi<<64)|lo
                    if value>>(4*d):raise AuditError('Noncanonical inline word')
                    word=tuple((value>>(4*j))&15 for j in reversed(range(d)))
                if any(x>=generators for x in word):raise AuditError('Generator index outside presentation')
                if previous is not None and word>=previous:raise AuditError('Unsorted/duplicate record term')
                previous=word
                if c&1:
                    offset=c&~7
                    if offset<32+24*n or offset+8>size:raise AuditError('Invalid coefficient offset')
                    limbs=struct.unpack_from('<I',data,offset)[0]
                    if not limbs or offset+8+4*limbs>size:raise AuditError('Invalid coefficient length')
                    value=int.from_bytes(data[offset+8:offset+8+4*limbs],'little')
                    if c&2:value=-value
                else:value=(c if c<(1<<63) else c-(1<<64))>>1
                if not value:raise AuditError('Zero record coefficient')
                p[word]=value
            yield p

class ShorterDivisors:
    """Aho-Corasick scan, retaining shortest matched leader length only."""
    def __init__(self,leaders: Iterable[tuple[int,...]]):
        self.edges=[{}];self.failure=[0];self.terminal=[0]
        for w in leaders:
            v=0
            for a in w:
                child=self.edges[v].get(a)
                if child is None:
                    child=len(self.edges);self.edges[v][a]=child
                    self.edges.append({});self.failure.append(0);self.terminal.append(0)
                v=child
            self.terminal[v]=len(w)
        queue=deque(self.edges[0].values())
        while queue:
            v=queue.popleft()
            for a,u in self.edges[v].items():
                queue.append(u);f=self.failure[v]
                while f and a not in self.edges[f]:f=self.failure[f]
                self.failure[u]=self.edges[f].get(a,0)
                inherited=self.terminal[self.failure[u]]
                if inherited:self.terminal[u]=min(self.terminal[u],inherited) if self.terminal[u] else inherited
    def proper(self,word):
        v=0;n=len(word)
        for a in word:
            while v and a not in self.edges[v]:v=self.failure[v]
            v=self.edges[v].get(a,0)
            if self.terminal[v] and self.terminal[v]<n:return True
        return False

def canonicalize(polynomials,modulus=0):
    if modulus and (modulus<2 or modulus>2147483647 or any(modulus%d==0 for d in range(2,math.isqrt(modulus)+1))):raise AuditError('The coefficient characteristic must be zero or prime')
    rows={}
    for p in polynomials:
        if not p:raise AuditError('Zero basis row')
        lm=max(p)
        if any(len(w)!=len(lm) for w in p):raise AuditError('Nonhomogeneous basis row')
        if lm in rows:raise AuditError('Duplicate leading word')
        rows[lm]=p
    matcher=ShorterDivisors(rows);count=0
    # Check, do not assume, that higher-order subword reductions cannot be needed.
    for lm,p in rows.items():
        if matcher.proper(lm):raise AuditError('Leading words are not a minimal antichain')
        for w in p:
            count+=1
            if matcher.proper(w):raise AuditError('A tail has a reducible proper subword; general independent interreduction is required')
    result={}
    for lm in sorted(rows,key=lambda w:(len(w),w)):
        p=rows[lm];lead=p[lm]
        if modulus:
            if not lead%modulus:raise AuditError('Leading coefficient vanishes in requested field')
            inv=pow(lead%modulus,-1,modulus);monic={w:c*inv%modulus for w,c in p.items() if c%modulus}
        else:monic={w:Fraction(c,lead) for w,c in p.items()}
        out={lm:1 if modulus else Fraction(1)}
        for w,c in monic.items():
            if w==lm:continue
            if w in result:
                replacement=((v,-c*b) for v,b in result[w].items() if v!=w)
            else:replacement=((w,c),)
            for v,b in replacement:
                value=out.get(v,0)+b
                if modulus:value%=modulus
                if value:out[v]=value
                else:out.pop(v,None)
        if any(w in rows and w!=lm for w in out):raise AuditError('Triangular normalization failed')
        result[lm]=out
    return result,{'properSubwordChecks':count,'matcherStates':len(matcher.edges),'minimalLeaders':True,'tailReduced':True,'monic':True}

def canonical_digest(basis,variables,modulus,degree,stream=None):
    metadata={'format':'fomkyr-independent-canonical-v1','variables':variables,'order':'degleftlex-last-variable-largest','modulus':modulus,'throughDegree':degree}
    digest=hashlib.sha256()
    def emit(value):
        encoded=(json.dumps(value,separators=(',',':'),sort_keys=True)+'\n').encode();digest.update(encoded)
        if stream:stream.write(encoded)
    emit(metadata)
    for lm,row in sorted(basis.items(),key=lambda kv:(len(kv[0]),kv[0])):
        emit([[list(w),str(c)] for w,c in sorted(row.items(),reverse=True)])
    return digest.hexdigest()

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('fixture',type=Path);ap.add_argument('basis',type=Path)
    ap.add_argument('--degree',type=int,required=True);ap.add_argument('--modulus',type=int,default=0)
    ap.add_argument('--against',type=Path);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--canonical-jsonl',type=Path)
    args=ap.parse_args();start=time.perf_counter();fixture=json.loads(args.fixture.read_text());names=fixture['variables']
    report={'kind':'canonical-normalization-not-Groebner-certification','independentGroebnerCertificate':False,'degree':args.degree,'modulus':args.modulus,'variables':names,'files':[]}
    try:
        previous=None;previous_stream=None
        for path in [args.basis]+([args.against] if args.against else []):
            basis,checks=canonicalize(records(path,args.degree,len(names)),args.modulus)
            stream=tempfile.TemporaryFile()
            digest=canonical_digest(basis,names,args.modulus,args.degree,stream);stream.seek(0)
            if args.canonical_jsonl and previous is None:
                with args.canonical_jsonl.open('wb') as output:shutil.copyfileobj(stream,output)
                stream.seek(0)
            report['files'].append({'path':str(path.resolve()),'rules':len(basis),'canonicalSHA256':digest,**checks})
            # Only the temporary canonical stream is needed for comparison. Do not
            # keep a whole earlier degree-13 Fraction basis alive during the next one.
            del basis
            gc.collect()
            if previous_stream is not None:
                equal=True
                while True:
                    left=previous_stream.read(1048576);right=stream.read(1048576)
                    if left!=right:equal=False;break
                    if not left:break
                previous_stream.close();stream.close()
                report['canonicalEqual']=equal;report['comparison']='exact canonical byte-stream comparison, not hash-only'
                if not equal:raise AuditError('Canonical bases differ')
                previous_stream=None
            else:previous_stream=stream
            previous=digest
        if previous_stream is not None:previous_stream.close()
        report['passed']=True
    except Exception as error:report.update(passed=False,error=str(error))
    report['elapsedSeconds']=time.perf_counter()-start;args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
    if not report['passed']:sys.exit(1)
if __name__=='__main__':main()
