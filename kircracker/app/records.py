"""Bounded portable upper-state and compact witness formats."""
from __future__ import annotations
import contextlib,hashlib,json,mmap,os,struct,tempfile,zipfile
from itertools import combinations,permutations
from pathlib import Path
from .util import Invalid,atomic_json,load,sha
PERMS=list(permutations(range(1,7)));INDEX={g:i for i,g in enumerate(PERMS)}
EDGES=list(combinations(range(1,7),2));EDGE={e:i+1 for i,e in enumerate(EDGES)}
MASK=(1<<64)-1

def code(w):
 v=0
 for e in w:
  if type(e)is not int or not 1<=e<=15:raise Invalid('invalid edge label')
  v=(v<<4)|e
 return v

def edgeword(v,d):
 w=bytes((v>>(4*j))&15 for j in reversed(range(d)))
 if v>>(4*d) or any(not 1<=c<=15 for c in w):raise Invalid('packed word encoding')
 return w

def packed(words):return b''.join(struct.pack('<QQ',code(w)&MASK,code(w)>>64) for w in words)
def unpacked(raw,d):
 if len(raw)%16:raise Invalid('truncated word stream')
 return [edgeword(lo|(hi<<64),d) for lo,hi in struct.iter_unpack('<QQ',raw)]
def grade(w):
 p=list(range(1,7))
 for e in w:a,b=EDGES[e-1];p[a-1],p[b-1]=p[b-1],p[a-1]
 return tuple(p)
def inverse(p):return tuple(p.index(i)+1 for i in range(1,7))
def compose(a,b):return tuple(a[i-1] for i in b)
def conjugate(s,g):return compose(compose(s,g),inverse(s))
def orbit(g):
 ans={}
 for h in permutations(range(1,5)):
  s=h+(5,6);ans.setdefault(conjugate(s,g),s)
 return ans

def check_minor(meta,us,vs):
 d=meta.get('degree');p=meta.get('prime');r=meta.get('rank');g=tuple(meta.get('grade',()))
 if type(d)is not int or not 0<=d<=20 or p!=1000003 or type(r)is not int or not 1<=r<=32768:raise Invalid('minor metadata limits')
 if len(us)!=r or len(vs)!=r or len(set(us))!=r or len(set(vs))!=r:raise Invalid('repeated or inconsistent minor words')
 if set(g)!=set(range(1,7)) or len(g)!=6:raise Invalid('permutation grade')
 star=set(EDGE[(i,6)] for i in range(1,6));dual={EDGE[e] for e in EDGES if e[1]<6}|{EDGE[(5,6)]}
 if any(len(w)!=d or set(w)-star or grade(w)!=g for w in us):raise Invalid('left minor word/boundary/grade')
 if any(len(w)!=d or set(w)-dual or inverse(grade(w))!=g for w in vs):raise Invalid('dual minor word/boundary/grade')
 seen=set()
 for s in meta.get('transports',[]):
  s=tuple(s)
  if len(s)!=6 or set(s)!=set(range(1,7)) or s[-2:]!=(5,6):raise Invalid('invalid boundary-preserving transport')
  t=conjugate(s,g)
  if t in seen:raise Invalid('overlapping transport')
  seen.add(t)
 if not seen:raise Invalid('empty transports')
 if type(meta.get('determinant'))is not int or not 0<meta['determinant']<p:raise Invalid('zero/invalid determinant claim')
 return {INDEX[inverse(x)]:r for x in seen}

def write_minor(path,meta,us,vs):
 path=Path(path);path.parent.mkdir(parents=True,exist_ok=True);check_minor(meta,us,vs)
 body={**meta,'format':'kircracker-minor-v1','matrixStored':False,'proof':'recompute integer prefix entries; nonzero determinant modulo prime'}
 fd,tmp=tempfile.mkstemp(prefix='.'+path.name,dir=path.parent);os.close(fd)
 try:
  with zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
   z.writestr('metadata.json',json.dumps(body,sort_keys=True,separators=(',',':')));z.writestr('left.bin',packed(us));z.writestr('right.bin',packed(vs))
  with open(tmp,'rb') as f:os.fsync(f.fileno())
  os.replace(tmp,path)
 except BaseException:
  with contextlib.suppress(OSError):os.unlink(tmp)
  raise
 return sha(path)

def read_minor(path):
 with zipfile.ZipFile(path) as z:
  if len(z.namelist())!=3 or set(z.namelist())!={'metadata.json','left.bin','right.bin'}:raise Invalid('minor members')
  if z.getinfo('metadata.json').file_size>65536:raise Invalid('oversized metadata')
  m=json.loads(z.read('metadata.json'));d=m.get('degree');r=m.get('rank')
  if type(d)is not int or not 0<=d<=20 or type(r)is not int or not 1<=r<=32768:raise Invalid('minor degree/rank')
  if z.getinfo('left.bin').file_size!=r*16 or z.getinfo('right.bin').file_size!=r*16:raise Invalid('minor word count')
  us=unpacked(z.read('left.bin'),d);vs=unpacked(z.read('right.bin'),d)
 check_minor(m,us,vs);return m,us,vs

def state_info(path,binding=None):
 with Path(path).open('rb') as f:
  h=f.read(112)
  if len(h)!=112 or h[:8]!=b'KKRMAP01':raise Invalid('upper checkpoint header')
  d,k,p,flags,prev,words,actions=struct.unpack_from('<IIIIQQQ',h,72)
  bind=h[8:72].decode('ascii')
  if not 0<=d<=31 or not 1<=k<=5 or p<2 or flags or binding and bind!=binding:raise Invalid('upper checkpoint metadata')
  length=Path(path).stat().st_size
  if length<112+20*words+4*actions+8:raise Invalid('truncated upper checkpoint')
  return {'degree':d,'generators':k,'prime':p,'previous':prev,'words':words,'actions':actions,'binding':bind,'bytes':length}

def state_words(path,binding=None):
 info=state_info(path,binding);d=info['degree'];k=info['generators']
 with Path(path).open('rb') as f,mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ) as m:
  for i in range(info['words']):
   lo,hi,g=struct.unpack_from('<QQI',m,112+i*20);v=lo|(hi<<64)
   if v>>(4*d):raise Invalid('overlong state word')
   w=tuple((v>>(4*j))&15 for j in reversed(range(d)))
   if any(a>=k for a in w) or g>=len(PERMS):raise Invalid('state word/grade')
   yield w,g
