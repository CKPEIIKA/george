#!/usr/bin/env python3
"""Independent bounded audits of the imported-grade shortcut; not high-degree proof replay."""
import ctypes as C,hashlib,json,sys,time,io,signal
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
R=Path(__file__).resolve().parents[1];sys.path[:0]=[str(R/'tests'),str(R/'tools'),str(R/'tests/published')]
from cooperative_engine import CooperativeEngine
from native import U32,U64,check
from field_oracle import ModularOracle
from oracle import normal,complete,certify,hilbert
from canonical_audit import canonicalize,canonical_digest
from physics_cases import cases
class GateEngine(CooperativeEngine):
    def __init__(self,*args,sectors=True,gate_budget=64<<20,**kwargs):
        super().__init__(*args,**kwargs);self.gate_budget=gate_budget
        for name,args0,res in [('gn_fg_bind',[U32],C.c_int),('gn_fg_sector_mode',[U32],C.c_int),('gn_fg_begin',[U64],C.c_int),('gn_fg_poll',[],C.c_int),('gn_fg_close',[U64],C.c_int),('gn_fg_status',[],C.c_int),('gn_fg_stat',[U32],U64),('gn_fg_group',[U32,U32],U64)]:
            fn=getattr(self.lib,name);fn.argtypes=args0;fn.restype=res
        ident=hashlib.sha256(json.dumps({'semantics':'fomkyr-homogeneous-degleftlex-v1','variables':self.fixture['variables'],'relations':self.fixture['relations'],'modulus':int(self.lib.gn_modulus())},separators=(',',':')).encode()).hexdigest().encode()
        C.memmove(self.lib.host_pointer(self.lib.gn_import_buffer()),ident,64)
        self.bound=self.lib.gn_fg_bind(64);assert self.bound>=0
        check(-self.lib.gn_fg_sector_mode(int(sectors)))
    def poll(self):
        if self.lib.gn_fg_status()<=0:return False
        st=self.lib.gn_fg_poll();assert st>=0,st
        if st==2:
            rc=self.lib.gn_fg_close(self.gate_budget)
            assert rc>=0 or rc in (-1,-2,-9),rc
        return bool(self.lib.gn_hilbert_gate_stat(3))
    def run(self):
        self.lib.gn_hilbert_gate_stat.argtypes=[U32];self.lib.gn_hilbert_gate_stat.restype=U64
        with ThreadPoolExecutor(self.workers) as pool:
            for d in range(int(self.lib.gn_stat(2))+1,self.target+1):
                for rel in self.fixture['relations']:
                    if rel['degree']==d:self.load(rel)
                check(self.lib.gn_start_degree(d))
                rc=self.lib.gn_fg_begin(self.gate_budget);assert rc>=0 or rc in (-1,-2,-9),rc
                while not self.poll():
                    n=self.lib.gn_coop_fill(self.lookahead)
                    if n<0:check(n)
                    if not n:break
                    for rc in pool.map(self.lib.gn_coop_reduce,range(self.workers)):check(rc)
                    check(self.lib.gn_coop_commit())
                assert self.lib.gn_fg_status()!=1
                check(self.lib.gn_finish_degree())
        return self.stats()
    def gate_stats(self):
        return {k:int(self.lib.gn_fg_stat(i)) for k,i in [('sectorSkips',8),('suspendedSkips',17),('commitSkips',18),('closedDegrees',1),('counterMicros',9),('counterError',11),('closedSectors',20)]}

def run():
    def timeout(signum,frame):raise TimeoutError('Independent gate case exceeded 120 seconds')
    signal.signal(signal.SIGALRM,timeout)
    report=[];fk=json.loads((R/'fixtures/fk6.json').read_text())
    configs=[('fk6-sector',fk,5,0,True,64<<20),('fk6-total',fk,5,0,False,64<<20),('fk6-no-space',fk,5,0,True,0),('fk6-F2',fk,4,2,True,64<<20),('fk6-F101',fk,4,101,True,64<<20)]
    # Renaming the generators is an isomorphic presentation, but NOT the bound identity.
    renamed=json.loads(json.dumps(fk));renamed['variables']=['u'+str(i) for i in range(15)]
    configs.append(('fk6-renamed-disabled',renamed,4,0,True,64<<20))
    f=next(f for f in cases() if f['name']=='homogenized-Weyl-2-mode');configs.append(('other-physics-disabled',f,6,0,True,64<<20))
    canonical={}
    for name,f,D,p,sectors,budget in configs:
        signal.alarm(120)
        start=time.perf_counter();e=GateEngine(f,D,workers=4,budget=128<<20,scratch=32<<20,modulus=p,quantum=1,lookahead=32,sectors=sectors,gate_budget=budget)
        e.run();b=e.basis();h=e.hilbert();stats=e.gate_stats();bound=e.bound
        o=ModularOracle(p) if p else None;nf=o.normal if o else normal;co=o.complete if o else complete;ce=o.certify if o else certify
        g=co(f['relations'],D);assert all(not nf(x,g) for x in b);assert all(not nf(x,b) for x in g)
        n=ce(b,f['relations'],D);assert h==hilbert([max(x) for x in g],len(f['variables']),D)
        if name.startswith('fk6-') and D==5:
            c,checks=canonicalize(b);out=io.BytesIO();canonical_digest(c,f['variables'],0,D,out);canonical[name]=out.getvalue()
        assert bool(bound)==(name in ('fk6-sector','fk6-total','fk6-no-space'))
        if name=='fk6-sector':assert stats['sectorSkips']>0
        if name=='fk6-total':assert stats['sectorSkips']==0
        if not bound or budget==0:assert stats['sectorSkips']==0
        row={'case':name,'degree':D,'modulus':p,'bound':bool(bound),'rules':len(b),'compositions':n,'seconds':time.perf_counter()-start,'passed':True,**stats};report.append(row);signal.alarm(0);print(json.dumps(row),flush=True)
    assert len(set(canonical.values()))==1
    path=R/'results/0.6.8/gate-independent-native.json';path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps({'passed':True,'cases':report,'highDegreeProfileProofReplayed':False},indent=2))
if __name__=='__main__':run()
