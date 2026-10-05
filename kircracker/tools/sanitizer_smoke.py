#!/usr/bin/env python3
"""Small native ASan+UBSan checks; no production timings or FK6 high-degree claim."""
from pathlib import Path
import hashlib,json,os,subprocess,sys,tempfile,time
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R))
from app.records import read_minor,code,MASK
compiler=os.environ.get('CXX','g++');start=time.monotonic()
env=os.environ|{'ASAN_OPTIONS':'detect_leaks=0:halt_on_error=1','UBSAN_OPTIONS':'halt_on_error=1:print_stacktrace=1'}
flags=['-std=c++17','-O1','-g','-pthread','-fsanitize=address,undefined','-fno-omit-frame-pointer']
report=[]
with tempfile.TemporaryDirectory(prefix='kir-sanitizers-') as td:
 d=Path(td)
 def run(cmd,**kw):
  p=subprocess.run(list(map(str,cmd)),env=env,text=True,capture_output=True,timeout=180,**kw)
  if p.returncode:raise RuntimeError(f'{cmd}: {p.returncode}\n{p.stdout}\n{p.stderr}')
  return p
 run([compiler,*flags,R/'src/module_builder.cpp','-o',d/'builder'])
 rel=d/'r.rel';rel.write_text('2 2\n2 1\n1 0 0\n2 1\n1 1 1\n');binding=hashlib.sha256(rel.read_bytes()).hexdigest()
 common=[d/'builder','--n','3','--prime','2','--gf2-packed','--relations',rel,'--bind',binding,'--threads','2']
 run([*common,'--degree','19','--state',d/'resume'])
 run([*common,'--degree','20','--state',d/'resume','--resume'])
 run([*common,'--degree','20','--state',d/'fresh'])
 assert (d/'resume/level-020.krm').read_bytes()==(d/'fresh/level-020.krm').read_bytes()
 report.append({'test':'native GF2 packed state degree19-to20 resume and fresh equality','passed':True,'scope':'two-generator square-zero control, not FK6'})
 m,us,vs=read_minor(R/'data/minors/d08/block-10.kcb');n=len(us)
 vals=lambda ws:','.join(f'UINT64_C({v})' for w in ws for v in (code(w)&MASK,code(w)>>64))
 source='''#include <cstdint>
#include <vector>
#include <cassert>
extern "C" void* kp_create(int,int,uint64_t);
extern "C" void kp_destroy(void*);
extern "C" int kp_eval_wide(void*,uint64_t,uint64_t,uint64_t,uint64_t,int);
extern "C" int kv_matrix_wide(int,int,const uint64_t*,int,const uint64_t*,int,int64_t*,int);
extern "C" int kv_verify_compact(int,int,const uint64_t*,const uint64_t*,int,int,int,int,const int32_t*,int32_t*,uint64_t*);
int main(){
'''+f'''constexpr int n={n};uint64_t u[]={{ {vals(us)} }},v[]={{ {vals(vs)} }};
std::vector<int64_t> full(n*n);std::vector<int32_t> mod(n*n);
assert(kv_matrix_wide(6,8,u,n,v,n,full.data(),2)==0);
void* p=kp_create(6,1000003,100000);assert(p);
for(int i=0;i<n;i++)for(int j=0;j<n;j++){{int64_t z=full[i*n+j]%1000003;if(z<0)z+=1000003;mod[i*n+j]=z;assert(kp_eval_wide(p,u[2*i],u[2*i+1],v[2*j],v[2*j+1],8)==z);}}
kp_destroy(p);int32_t det=0;uint64_t stats[2]={{0,0}};
assert(kv_verify_compact(6,8,u,v,n,1000003,2,2,mod.data(),&det,stats)==0);assert(det=={m['determinant']});assert(stats[0]==n*n);
assert(kv_verify_compact(6,21,u,v,n,1000003,2,2,nullptr,&det,stats)!=0);
}}
'''
 (d/'pair.cpp').write_text(source)
 run([compiler,*flags,d/'pair.cpp',R/'src/pair_kernel.cpp',R/'src/prefix_verify.cpp','-o',d/'pair'])
 run([d/'pair']);report.append({'test':'independent scalar discovery vs prefix vs tiled determinant; degree21 refusal','passed':True,'rank':n})
result={'passed':True,'checks':report,'compiler':compiler,'flags':flags,'ASAN_OPTIONS':env['ASAN_OPTIONS'],'UBSAN_OPTIONS':env['UBSAN_OPTIONS'],'leakDetectionEnabled':False,'elapsedSeconds':time.monotonic()-start}
(R/'evidence/sanitizer-smoke.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
