#!/usr/bin/env python3
"""Native test/benchmark harness for exactly the same C kernel as the WASM build.
Not a production daemon. One engine per process (the kernel owns one shared State).
"""
from __future__ import annotations
import argparse, ctypes as C, json, re, struct, time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
ROOT = Path(__file__).resolve().parents[1]
U32, U64, I64 = C.c_uint32, C.c_uint64, C.c_int64
ERRORS = {1:'MEMORY_BUDGET',2:'SCRATCH_BUDGET',3:'INVALID_INPUT',4:'IO_ERROR',5:'CANCELLED',6:'CORRUPT_RECORD',7:'STATE_ERROR'}

def check(code: int):
    if code: raise RuntimeError(f'{ERRORS.get(abs(code),code)} ({code})')

def parse(vars_text: str, rels: str) -> tuple[list[str],list[dict]]:
    names = [x.strip() for x in vars_text.split(',') if x.strip()]
    if len(set(names)) != len(names) or not 1 <= len(names) <= 16: raise ValueError('1..16 unique generators required')
    ids = {n:i for i,n in enumerate(names)}
    out=[]
    for text in rels.strip().rstrip(';').split(','):
        text=re.sub(r'\s+', '', text)
        if not text: continue
        terms=[]
        for m in re.finditer(r'([+-]?)([^+-]+)',text):
            sign=-1 if m[1]=='-' else 1
            c=sign; w=[]
            for fact in m[2].split('*'):
                if fact.isdigit(): c*=int(fact); continue
                mm=re.fullmatch(r'([A-Za-z_][A-Za-z_0-9]*)(?:\^(\d+))?',fact)
                if not mm or mm[1] not in ids: raise ValueError('Unsupported polynomial term: '+fact)
                e=int(mm[2] or 1)
                if e>20: raise ValueError('Maximum degree is 20')
                w.extend([ids[mm[1]]]*e)
            if len(w)>20 or len(w)<1: raise ValueError('Only positive-degree homogeneous polynomials supported')
            if c: terms.append({'word':w,'coefficient':str(c)})
        ds={len(t['word']) for t in terms}
        if len(ds)!=1: raise ValueError('Nonhomogeneous polynomial')
        out.append({'degree':ds.pop(),'terms':terms})
    return names,out

def encode(word):
    w=0
    for i in word: w=w*16+i
    return w & ((1<<64)-1),w>>64

def decode_record(data: bytes) -> dict[tuple[int,...],int]:
    magic,size,n,d,_,_=struct.unpack_from('<IIIIQQ',data)
    if magic!=0x31424e47 or size!=len(data): raise ValueError('Malformed record')
    p={}
    for i in range(n):
        lo,hi,c=struct.unpack_from('<QQQ',data,32+24*i)
        v=(hi<<64)|lo
        word=tuple((v>>(4*j))&15 for j in reversed(range(d)))
        if c&1:
            off=c&~7; limbs=struct.unpack_from('<I',data,off)[0]
            num=int.from_bytes(data[off+8:off+8+4*limbs],'little')
            if c&2:num=-num
        else:num=(c if c<1<<63 else c-(1<<64))>>1
        p[word]=num
    return p

class Engine:
    def __init__(self, fixture: dict, target=7, workers=1, budget=256<<20, scratch=64<<20,
                 modulus=0, disk: str|None=None, hash_bits=16, resume: dict|None=None):
        self.fixture=fixture; self.target=target; self.workers=workers; self.disk=disk
        self.lib=C.CDLL(str(ROOT/'dist/libgeorge.so'))
        api={
            'host_init':([U64,C.c_char_p],C.c_int),'host_pointer':([U64],C.c_void_p),
            'gn_init':([U32,U32,U32,U64,U64,U32,U32,U32],C.c_int),
            'gn_input_begin':([U32,U32],C.c_int),'gn_input_term':([U64,U64,I64],C.c_int),
            'gn_input_end':([],C.c_int),'gn_start_degree':([U32],C.c_int),
            'gn_next_pair':([U32],C.c_int),'gn_reduce_pair':([U32],C.c_int),
            'gn_commit':([U32],C.c_int),'gn_finish_degree':([],C.c_int),
            'gn_stat':([U32],U64),'gn_lane_stat':([U32,U32],U64),
            'gn_rule_stat':([U32,U32],U64),'gn_export_rule':([U32],U64),
            'gn_export_size':([],U32),'gn_import_buffer':([],U64),'gn_import_capacity':([],U32),
            'gn_restore_rule':([U32,U64],C.c_int),'gn_restored_through':([U32],C.c_int),
            'gn_workers':([U32],C.c_int),'gn_rewind_degree':([],C.c_int),'gn_cancel':([U32],None),
            'gn_test_small':([U32,I64,I64],I64), 'host_sync':([],C.c_int),
        }
        for name,(args,res) in api.items():
            f=getattr(self.lib,name);f.argtypes=args;f.restype=res
        if not self.lib.host_init(budget,disk.encode() if disk else None): raise MemoryError('host mmap/open')
        check(self.lib.gn_init(len(fixture['variables']),target,workers,budget,scratch,hash_bits,modulus,bool(disk)))
        self.report=[]
        if resume:
            if not disk: raise ValueError('resume requires binary record file')
            with open(disk,'rb') as f:
                off=0
                for _ in range(resume['basisSize']):
                    head=f.read(32)
                    if len(head)!=32: raise ValueError('Truncated checkpoint')
                    size=struct.unpack_from('<I',head,4)[0]
                    if size<32 or size>self.lib.gn_import_capacity(): raise ValueError('Checkpoint row too large')
                    data=head+f.read(size-32)
                    if len(data)!=size:raise ValueError('Truncated checkpoint')
                    C.memmove(self.lib.host_pointer(self.lib.gn_import_buffer()),data,size)
                    check(self.lib.gn_restore_rule(size,off));off+=size
                if off!=resume['diskBytes']:raise ValueError('Checkpoint length mismatch')
            check(self.lib.gn_restored_through(resume['completedThroughDegree']))
    def stats(self):
        keys=['basisSize','terms','completedThroughDegree','currentDegree','allocatedBytes','budgetBytes','diskBytes','pairs','monomialPairsPruned','zeroCommits','workers','prefixNodes','peakAllocatedBytes']
        s={name:int(self.lib.gn_stat(i)) for i,name in enumerate(keys)}
        s['reductions']=sum(self.lib.gn_lane_stat(i,0) for i in range(self.workers))
        s['monomialTermsPruned']=sum(self.lib.gn_lane_stat(i,1) for i in range(self.workers))
        return s
    def load(self,rel):
        check(self.lib.gn_input_begin(rel['degree'],len(rel['terms'])))
        for t in rel['terms']:
            lo,hi=encode(t['word']);check(self.lib.gn_input_term(lo,hi,int(t['coefficient'])))
        check(self.lib.gn_input_end())
    def run(self,verbose=False, checkpoint=None):
        start=time.perf_counter()
        with ThreadPoolExecutor(self.workers) as pool:
            for d in range(int(self.lib.gn_stat(2))+1,self.target+1):
                for rel in self.fixture['relations']:
                    if rel['degree']==d:self.load(rel)
                check(self.lib.gn_start_degree(d))
                while True:
                    lanes=[]
                    for lane in range(self.workers):
                        rc=self.lib.gn_next_pair(lane)
                        if rc<0:check(rc)
                        if rc==0:break
                        lanes.append(lane)
                    if not lanes:break
                    rcs=list(pool.map(self.lib.gn_reduce_pair,lanes)) if self.workers>1 else [self.lib.gn_reduce_pair(0)]
                    if 2 in rcs and self.workers>1:
                        self.workers=max(1,self.workers//2)
                        check(self.lib.gn_workers(self.workers));check(self.lib.gn_rewind_degree());continue
                    for rc in rcs:check(rc)
                    replay=False
                    for lane in lanes:
                        rc=self.lib.gn_commit(lane)
                        if rc==2 and self.workers>1:
                            self.workers=max(1,self.workers//2);check(self.lib.gn_workers(self.workers));check(self.lib.gn_rewind_degree());replay=True;break
                        check(rc)
                    if replay:continue
                check(self.lib.gn_finish_degree())
                s=self.stats();s['elapsedSeconds']=time.perf_counter()-start;self.report.append(s)
                if checkpoint and self.disk:
                    self.lib.host_sync();Path(checkpoint).write_text(json.dumps(s,indent=2))
                if verbose:print(json.dumps(s),flush=True)
        return self.report
    def records(self):
        for rid in range(1,int(self.lib.gn_stat(0))+1):
            off=self.lib.gn_export_rule(rid)
            if not off:raise RuntimeError('Export failed')
            yield C.string_at(self.lib.host_pointer(off),self.lib.gn_export_size())
    def basis(self):return [decode_record(x) for x in self.records()]
    def leaders(self):
        out=[]
        for i in range(1,int(self.lib.gn_stat(0))+1):
            lo=self.lib.gn_rule_stat(i,0);hi=self.lib.gn_rule_stat(i,1);d=self.lib.gn_rule_stat(i,2)
            w=(hi<<64)|lo;out.append(tuple((w>>(4*j))&15 for j in reversed(range(d))))
        return out

def main():
    ap=argparse.ArgumentParser();ap.add_argument('fixture',type=Path);ap.add_argument('--degree',type=int,default=7);ap.add_argument('--workers',type=int,default=1);ap.add_argument('--budget-mib',type=int,default=256);ap.add_argument('--scratch-mib',type=int,default=64);ap.add_argument('--modulus',type=int,default=0);ap.add_argument('--spill');ap.add_argument('--report');ap.add_argument('--resume')
    a=ap.parse_args();f=json.loads(a.fixture.read_text());resume=json.loads(Path(a.resume).read_text()) if a.resume else None
    e=Engine(f,a.degree,a.workers,a.budget_mib<<20,a.scratch_mib<<20,a.modulus,a.spill,resume=resume)
    try:e.run(True, a.spill+'.json' if a.spill else None)
    finally:
        if a.report:Path(a.report).write_text(json.dumps({'fixture':f.get('name'), 'target':a.degree,'report':e.report,'last':e.stats()},indent=2))
if __name__=='__main__':main()
