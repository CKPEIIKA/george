#!/usr/bin/env python3
"""Run available C analyzers; keep diagnostics in the ignored results directory."""
from pathlib import Path
import argparse,json,re,shutil,subprocess,sys,hashlib,time
ROOT=Path(__file__).resolve().parents[1]
SOURCES=['src/kernel.c','native/cli.c','native/host.c','native/support.c','native/fixture.c']
DEPENDENCIES=sorted(q for folder in ['src','native','fk_gate/src','fk_gate/adapters','fk_gate/profiles']for q in(ROOT/folder).glob('*')if q.is_file()and q.suffix in ['.c','.h','.inc'])
source_hashes={q.relative_to(ROOT).as_posix():hashlib.sha256(q.read_bytes()).hexdigest()for q in DEPENDENCIES}
p=argparse.ArgumentParser();p.add_argument('--out',default='results/static-analysis');p.add_argument('--timeout',type=int,default=300);a=p.parse_args();out=ROOT/a.out;out.mkdir(parents=True,exist_ok=True);checks=[]
def run(name,cmd,kind):
 start=time.monotonic()
 try:
  r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,timeout=a.timeout);stdout,stderr,code=r.stdout,r.stderr,r.returncode;status='PASS'
 except subprocess.TimeoutExpired as e:
  stdout=e.stdout or b'';stderr=e.stderr or b'';stdout=stdout.decode(errors='replace')if isinstance(stdout,bytes)else stdout;stderr=stderr.decode(errors='replace')if isinstance(stderr,bytes)else stderr;code=None;status='RESOURCE_LIMIT'
 (out/(name+'.stdout')).write_text(stdout);(out/(name+'.log')).write_text(stderr)
 diagnostics=[]
 if kind=='sarif'and status!='RESOURCE_LIMIT':
  try:
   data=json.loads(stderr);diagnostics=[x for r in data.get('runs',[])for x in r.get('results',[])if x.get('level')in ['warning','error']]
  except json.JSONDecodeError:status='ERROR'
 elif kind=='clang':diagnostics=re.findall(r'^.*warning:.*$',stderr,re.M)
 elif kind=='cppcheck':diagnostics=[x for x in stderr.splitlines()if ':warning:'in x or ':error:'in x or ':portability:'in x]
 if code not in [0,None]:status='ERROR'
 if diagnostics:status='FINDINGS'
 row={'name':name,'status':status,'exitCode':code,'diagnosticCount':len(diagnostics),'diagnostics':diagnostics,'seconds':round(time.monotonic()-start,3),'command':cmd};checks.append(row);print(name,status,len(diagnostics),flush=True)
clang=shutil.which('clang');gcc=shutil.which('gcc');cpp=shutil.which('cppcheck')
if clang:
 for src in SOURCES:run('clang-'+Path(src).stem,[clang,'--analyze','-std=c11',*(['-fno-builtin'] if src=='src/kernel.c' else []),'-Xanalyzer','-analyzer-output=text',src],'clang')
if gcc:
 probe=subprocess.run([gcc,'--help=common'],capture_output=True,text=True)
 if '-fanalyzer'in probe.stdout:
  # GCC16 removed JSON diagnostics. SARIF is available in recent GCC releases.
  fmt='sarif-stderr'if 'sarif-stderr'in probe.stdout else'text'
  for src in SOURCES:
   name='gcc-'+Path(src).stem;run(name,[gcc,'-std=c11','-O0','-fanalyzer',*(['-fno-builtin'] if src=='src/kernel.c' else []),'-fdiagnostics-format='+fmt,'-c',src,'-o',str((out/(name+'.o')).resolve())],'sarif'if fmt=='sarif-stderr'else'clang')
if cpp:run('cppcheck',[cpp,'--enable=warning,performance,portability','--inconclusive','--std=c11','--language=c','--suppress=missingIncludeSystem','--suppress=unmatchedSuppression','--error-exitcode=1','--template={file}:{line}:{severity}:{id}:{message}',*SOURCES],'cppcheck')
drift=[q.relative_to(ROOT).as_posix()for q in DEPENDENCIES if hashlib.sha256(q.read_bytes()).hexdigest()!=source_hashes[q.relative_to(ROOT).as_posix()]]
passed=bool(checks)and not drift and all(x['status']=='PASS'for x in checks)
report={'passed':passed,'checks':checks,'sourceHashes':source_hashes,'sourceChangedDuringAnalysis':drift,'scope':'Static kernel/native analysis. This does not replace arithmetic and checkpoint regressions.'};(out/'REPORT.json').write_text(json.dumps(report,indent=2)+'\n');sys.exit(0 if passed else 1)
