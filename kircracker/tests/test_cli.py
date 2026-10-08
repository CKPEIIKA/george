from pathlib import Path
import contextlib,ctypes as C,hashlib,json,os,shutil,signal,struct,subprocess,sys,tempfile,time,unittest,zipfile
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from app import __version__
from app.records import *
from app.util import *
from app.native import *
from app.assembly import conv
class Basics(unittest.TestCase):
 def test_resource_units(self):
  self.assertEqual(bytes_arg('24GiB'),24*1024**3);self.assertEqual(bytes_arg('24G'),24*1024**3)
  for bad in ['-1G','no','0','1GBjunk']:
   with self.assertRaises(Exception):bytes_arg(bad)
  h=hardware();self.assertGreater(h['effectiveMemoryBytes'],0);self.assertGreaterEqual(h['recommendedJobs'],1)
 def test_word_boundaries(self):
  for d in [0,1,15,16,17,18,19,20,21,22]:
   w=bytes(1+(i%15) for i in range(d));self.assertEqual(unpacked(packed([w]),d),[w])
  with self.assertRaises(Invalid):unpacked(b'\0'*15,3)
  with self.assertRaises(Invalid):edgeword(0,22)
 def test_group_convolution(self):
  # Exact noncommutative products and integer totals, not class convolution.
  A=[{0:1},{INDEX[(2,1,3,4,5,6)]:3}];B=[{0:2},{INDEX[(1,3,2,4,5,6)]:5}]
  out=conv(A,B,2,2);expect=[{}, {}, {}]
  for d,x in enumerate(A):
   for e,y in enumerate(B):
    for g,a in x.items():
     for h,b in y.items():q=INDEX[compose(PERMS[g],PERMS[h])];expect[d+e][q]=expect[d+e].get(q,0)+a*b
  self.assertEqual(out,expect)
  with self.assertRaises(Invalid):conv([{0:2**64-1}],[{0:2}],0,1)
 def test_minor_tamper(self):
  f=ROOT/'data/minors/d05/block-00.kcb';m,u,v=read_minor(f);q=verify_words(m,packed(u),packed(v));self.assertNotEqual(q['determinant'],0)
  bad=dict(m);bad['determinant']=(m['determinant']+1)%m['prime'] or 1
  with self.assertRaises(Invalid):verify_words(bad,packed(u),packed(v))
  bad=dict(m);bad['transports']=m['transports']*2
  with self.assertRaises(Invalid):check_minor(bad,u,v)
 def test_discovery_prefix_independence(self):
  # Include real high-degree samples, not only random entries that are all zero.
  pair,ver=libraries();scalar=C.CDLL(str(ROOT/'bin/libpair.so'));scalar.kp_create.argtypes=[C.c_int,C.c_int,C.c_uint64];scalar.kp_create.restype=C.c_void_p;scalar.kp_destroy.argtypes=[C.c_void_p]
  scalar.kp_eval_wide.argtypes=[C.c_void_p,C.c_uint64,C.c_uint64,C.c_uint64,C.c_uint64,C.c_int];scalar.kp_eval_wide.restype=C.c_int
  ver.kv_matrix_wide.argtypes=[C.c_int,C.c_int,P64,C.c_int,P64,C.c_int,C.POINTER(C.c_int64),C.c_int];ver.kv_matrix_wide.restype=C.c_int
  ctx=scalar.kp_create(6,1000003,100000)
  try:
   for d in [5,13,17,18]:
    p=next((ROOT/f'data/minors/d{d:02d}').glob('*.kcb'));m,us,vs=read_minor(p)
    for w,z in list(zip(us,vs))[:8]:
     a=code(w);b=code(z);x=scalar.kp_eval_wide(ctx,a&MASK,a>>64,b&MASK,b>>64,d);out=(C.c_int64*1)();rc=ver.kv_matrix_wide(6,d,buffer(packed([w])),1,buffer(packed([z])),1,out,1)
     self.assertEqual(rc,0);self.assertEqual(x,out[0]%1000003)
  finally:scalar.kp_destroy(ctx)
 def test_degree21_22_exact_prefix_verifier(self):
  # Fixed nonzero scalar pairings found by the independent modular suffix evaluator.
  samples={
   21:(bytes([5,15,9,5,14,15,12,14,9,12,5,9,5,14,5,9,5,12,9,5,15]),bytes([1,3,8,1,2,1,3,7,13,7,4,1,15,11,6,1,13,3,1,4,15])),
   22:(bytes([5,9,14,9,5,14,15,12,14,9,12,5,9,5,14,5,9,5,12,9,5,15]),bytes([1,4,15,8,1,2,1,3,7,13,7,4,1,15,11,6,1,13,3,1,4,15]))}
  pair,_=libraries();ctx=pair.kp_create(6,1000003,100000)
  scalar=C.CDLL(str(ROOT/'bin/libpair.so'));scalar.kp_eval_wide.argtypes=[C.c_void_p,C.c_uint64,C.c_uint64,C.c_uint64,C.c_uint64,C.c_int];scalar.kp_eval_wide.restype=C.c_int
  try:
   for d,(u,v) in samples.items():
    a=code(u);b=code(v);want=scalar.kp_eval_wide(ctx,a&MASK,a>>64,b&MASK,b>>64,d);self.assertNotEqual(want,0)
    meta={'degree':d,'rank':1,'prime':1000003};got=verify_words(meta,packed([u]),packed([v]));self.assertEqual(got['determinant'],want);self.assertEqual(got['integerArithmetic'],'signed-128-exact');self.assertGreaterEqual(got['maxAbsIntegerEntryBits'],1)
  finally:pair.kp_destroy(ctx)
 def test_degree22_discovery_no_dense_matrix(self):
  u=bytes([5,9,14,9,5,14,15,12,14,9,12,5,9,5,14,5,9,5,12,9,5,15]);v=bytes([1,4,15,8,1,2,1,3,7,13,7,4,1,15,11,6,1,13,3,1,4,15])
  pair,_=libraries();ctx=pair.kp_create(6,1000003,0);ri=(C.c_int*1)();ci=(C.c_int*1)();stats=(C.c_uint64*6)()
  try:
   rc=pair.kp_minor_trie_wide(ctx,buffer(packed([u])),1,buffer(packed([v])),1,22,ri,ci,None,stats,10.0);self.assertEqual(rc,1);self.assertEqual((ri[0],ci[0]),(0,0))
  finally:pair.kp_destroy(ctx)
 def test_lock(self):
  with tempfile.TemporaryDirectory() as t:
   with workspace_lock(t):
    with self.assertRaises(Invalid):
     with workspace_lock(t):pass

class Checkpoints(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.d=Path(self.tmp.name);self.lib=self.d/'r.rel';self.lib.write_text('3 4\n2 1\n1 0 0\n2 1\n1 1 1\n2 1\n1 2 2\n3 2\n1 2 1 2\n1 1 2 1\n');self.bind=sha(self.lib)
 def tearDown(self):self.tmp.cleanup()
 def native(self,d,root,threads=2,resume=False,seconds=30,**kw):
  cmd=[str(ROOT/'bin/kir-relative'),'--n','4','--degree',str(d),'--prime','2','--gf2-packed','--relations',str(self.lib),'--state',str(root),'--bind',self.bind,'--threads',str(threads),'--seconds',str(seconds)]
  if resume:cmd.append('--resume')
  return subprocess.run(cmd,text=True,capture_output=True,timeout=40,**kw)
 def test_roundtrip_and_field_binding(self):
  a=self.d/'a';b=self.d/'b';r=self.native(7,a);self.assertEqual(r.returncode,0,r.stderr)
  r=self.native(10,a,1,True);self.assertEqual(r.returncode,0,r.stderr);q=self.native(10,b,4);self.assertEqual(q.returncode,0,q.stderr)
  for i in range(11):self.assertEqual((a/f'level-{i:03d}.krm').read_bytes(),(b/f'level-{i:03d}.krm').read_bytes())
  f=a/'level-007.krm';x=bytearray(f.read_bytes());x[10]^=1;f.write_bytes(x)
  r=self.native(10,a,2,True);self.assertNotEqual(r.returncode,0);self.assertIn('mismatch',r.stderr)
 def test_degree22_checkpoint_word_boundary(self):
  # An elementary infinite square-zero algebra: one alternating relative word
  # in each positive degree. This is a format/control test, NOT FK6 degree22.
  lib=self.d/'two-squares.rel';lib.write_text('2 2\n2 1\n1 0 0\n2 1\n1 1 1\n');bind=sha(lib)
  def run(D,dest,resume=False):
   cmd=[str(ROOT/'bin/kir-relative'),'--n','3','--degree',str(D),'--prime','2','--gf2-packed','--relations',str(lib),'--state',str(dest),'--bind',bind,'--threads','2']
   if resume:cmd.append('--resume')
   return subprocess.run(cmd,text=True,capture_output=True,timeout=30)
  a=self.d/'long-resume';b=self.d/'long-fresh'
  for D,dest,resume in [(21,a,False),(22,a,True),(22,b,False)]:
   x=run(D,dest,resume);self.assertEqual(x.returncode,0,x.stderr)
  self.assertEqual((a/'level-022.krm').read_bytes(),(b/'level-022.krm').read_bytes())
  self.assertEqual(struct.unpack_from('<I',(a/'level-022.krm').read_bytes(),72)[0],22)
 def test_corruption_refused(self):
  a=self.d/'a';r=self.native(5,a);self.assertEqual(r.returncode,0)
  f=a/'level-003.krm';raw=bytearray(f.read_bytes());raw[-1]^=64;f.write_bytes(raw)
  r=self.native(6,a,2,True);self.assertNotEqual(r.returncode,0);self.assertIn('checksum',r.stderr)
 def test_time_limit_leaves_prefix(self):
  # A tiny limit is a resource error, never a completed requested degree.
  a=self.d/'a';r=self.native(20,a,2,False,1e-9);self.assertNotEqual(r.returncode,0)
  self.assertFalse((a/'level-022.krm').exists());self.assertTrue((a/'level-000.krm').exists())
 def test_atomic_incomplete_files_ignored(self):
  a=self.d/'a';self.assertEqual(self.native(5,a).returncode,0)
  (a/'level-006.krm.tmp-interrupted').write_bytes(b'partial')
  self.assertEqual(self.native(6,a,1,True).returncode,0)

class Interface(unittest.TestCase):
 def test_help_version_plan(self):
  for args in [['--help'],['--version'],['plan','22','-m','512MiB','-j','2']]:
   p=subprocess.run([ROOT/'kircracker',*args],capture_output=True,text=True,timeout=20);self.assertEqual(p.returncode,0,p.stderr)
  p=subprocess.run([ROOT/'kircracker','run','23','-m','512MiB'],capture_output=True,text=True);self.assertNotEqual(p.returncode,0)
 def test_incomplete_is_machine_readable(self):
  with tempfile.TemporaryDirectory() as t:
   p=subprocess.run([str(ROOT/'kircracker'),'upper','10','--namespace','NICHOLS-only','--upper-seconds','1e-9','-C',t,'-m','512MiB','-j','1','--quiet'],capture_output=True,text=True,timeout=40)
   self.assertEqual(p.returncode,3,p.stderr)
   x=json.loads(p.stdout);self.assertEqual(x['status'],'INCOMPLETE');self.assertFalse(x['exactProfileExported'])
 def test_small_full_run_resume_export(self):
  if os.environ.get('KIR_QUICK_TESTS')=='1':self.skipTest('quick mode')
  with tempfile.TemporaryDirectory() as t:
   command=[str(ROOT/'kircracker'),'run','5','-C',t,'-m','1GiB','-j','2','--quiet'];p=subprocess.run(command,capture_output=True,text=True,timeout=90);self.assertEqual(p.returncode,0,p.stderr);x=json.loads(p.stdout);self.assertEqual(x['exactThroughDegree'],5);self.assertEqual(x['degrees'][-1]['originalUpper'],16605)
   hashes={str(p.relative_to(t)):sha(p) for p in Path(t).glob('upper/*/*.krm')};q=subprocess.run(command,capture_output=True,text=True,timeout=30);self.assertEqual(q.returncode,0,q.stderr);self.assertEqual(hashes,{str(p.relative_to(t)):sha(p) for p in Path(t).glob('upper/*/*.krm')})
   q=subprocess.run([ROOT/'kircracker','export','5','-C',t,'-m','1GiB','-j','2','-o',t+'/profile.json','--quiet'],capture_output=True,text=True,timeout=30);self.assertEqual(q.returncode,0,q.stderr);self.assertEqual(load(Path(t)/'profile.json')['dimensions'],[1,15,125,765,3831,16605])
 def test_installed_symlink(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'kircracker';p.symlink_to(ROOT/'kircracker');r=subprocess.run([p,'--version'],capture_output=True,text=True,timeout=10);self.assertEqual(r.returncode,0,r.stderr);self.assertEqual('kircracker-cli '+__version__,r.stdout.strip())
