"""Test host for the production cooperative C API, not a second reducer."""
import ctypes as C
from concurrent.futures import ThreadPoolExecutor
from native import Engine, U32, U64, check

class CooperativeEngine(Engine):
    def __init__(self,*args,quantum=1,lookahead=32,max_cache=True,**kwargs):
        super().__init__(*args,**kwargs)
        for name,args0,res in [
            ('gn_batch_mode',[U32],C.c_int),('gn_cooperative',[U32,U32],C.c_int),
            ('gn_coop_fill',[U32],C.c_int),('gn_coop_reduce',[U32],C.c_int),
            ('gn_coop_commit',[],C.c_int),('gn_coop_stat',[U32],U64),
            ('gn_coop_prepare_commit',[],C.c_int),
            ('gn_coop_retry',[U32],C.c_int),('gn_coop_discard',[],None),
            ('gn_radix_cache',[U32],C.c_int),('gn_memory_stat',[U32],U64)]:
            fn=getattr(self.lib,name);fn.argtypes=args0;fn.restype=res
        check(self.lib.gn_batch_mode(1));check(self.lib.gn_radix_cache(int(max_cache)))
        check(self.lib.gn_cooperative(quantum,lookahead));self.lookahead=lookahead
    def run(self,verbose=False,checkpoint=None):
        import time
        start=time.perf_counter()
        with ThreadPoolExecutor(self.workers) as pool:
            for d in range(int(self.lib.gn_stat(2))+1,self.target+1):
                for rel in self.fixture['relations']:
                    if rel['degree']==d:self.load(rel)
                check(self.lib.gn_start_degree(d))
                while True:
                    n=self.lib.gn_coop_fill(self.lookahead)
                    if n<0:check(n)
                    if not n:break
                    readers=[pool.submit(self.lib.gn_coop_reduce,i) for i in range(1,self.workers)]
                    local=self.lib.gn_coop_reduce(0)
                    prepared=self.lib.gn_coop_prepare_commit() if not local else 0
                    for reader in readers:check(reader.result())
                    check(local);check(prepared)
                    rc=self.lib.gn_coop_commit()
                    if rc in (2,8,11) and self.workers>1:
                        self.workers=max(1,self.workers//2);check(self.lib.gn_coop_retry(self.workers));continue
                    check(rc)
                check(self.lib.gn_finish_degree())
                s=self.stats();s['elapsedSeconds']=time.perf_counter()-start;self.report.append(s)
        return self.report
    def cooperative_stats(self):
        get=lambda k:int(self.lib.gn_coop_stat(k))
        return {'quantumMs':get(0),'epochs':get(1),'started':get(2),'finished':get(3),'committed':get(4),'nonprefixCommits':get(5),'capacityReplayPairs':get(6),'parkedCommit':get(18),'commitYields':get(19),'commitResumes':get(20),'preparedCommitSlices':get(21),
                'lanes':[{'yields':get(300+i),'resumes':get(400+i),'maxSliceUs':get(200+i)} for i in range(self.workers)]}
