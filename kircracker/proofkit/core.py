"""Exact sparse polynomial utilities, bounded reference reducer and record I/O."""
from __future__ import annotations
import ctypes as C, hashlib, heapq, json, os, signal, struct, time
from fractions import Fraction as F
from functools import lru_cache
from pathlib import Path
from collections import defaultdict
ROOT=Path(__file__).resolve().parents[1]
class Invalid(ValueError):pass
class Incomplete(RuntimeError):pass
class Budget:
 def __init__(self,seconds=0,terms=1000000,operations=100000000):
  self.end=time.monotonic()+seconds if seconds else float('inf');self.terms=terms;self.operations=operations;self.used=0
 def check(self,n=0):
  self.used+=1
  if n>self.terms:raise Incomplete('term/state limit; incomplete, not zero')
  if self.used>self.operations or time.monotonic()>self.end:raise Incomplete('time/operation limit; incomplete, not zero')
 def left(self):self.check();return max(.001,min(86400,self.end-time.monotonic()))
def load(path):return json.loads(Path(path).read_text())
def sha(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as f:
  for b in iter(lambda:f.read(1<<20),b''):h.update(b)
 return h.hexdigest()
def atomic(path,data):
 p=Path(path);p.parent.mkdir(parents=True,exist_ok=True);tmp=p.with_name(p.name+'.tmp')
 with tmp.open('w') as f:json.dump(data,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
 os.replace(tmp,p)
def clean(p):return {tuple(w):F(c) for w,c in p.items() if c}
def serial(p):return [[list(w),str(c)] for w,c in sorted(p.items(),reverse=True) if c]
def parse(data,ng=None):
 if isinstance(data,dict):data=data.get('terms',data.get('polynomial'))
 if not isinstance(data,list):raise Invalid('polynomial must be a term array')
 out={}
 for t in data:
  if isinstance(t,dict):w,c=t['word'],t['coefficient']
  else:w,c=t
  if any(type(a)!=int or a<0 or ng is not None and a>=ng for a in w):raise Invalid('bad polynomial generator')
  w=tuple(w);c=F(c);out[w]=out.get(w,F(0))+c
 return clean(out)
def add(p,q,scale=1):
 out=dict(p)
 for w,c in q.items():out[w]=out.get(w,0)+scale*c
 return clean(out)
def context(p,left=(),right=(),scale=1):return {tuple(left)+w+tuple(right):scale*c for w,c in p.items()}
def mul(p,q,budget=None):
 out=defaultdict(F)
 for w,c in p.items():
  for v,b in q.items():out[w+v]+=c*b
  if budget:budget.check(len(out))
 return clean(out)
def homogeneous(p):
 ds={len(w) for w in p}
 if len(ds)>1:raise Invalid('homogeneous polynomials required')
 return next(iter(ds),0)
def monic(p):
 p=clean(p)
 return {w:c/p[max(p)] for w,c in p.items()} if p else {}
def normal(p,rows,budget=None,trace=False):
 b=budget or Budget();p=clean(p);d=homogeneous(p);out={};heap=[tuple(-x for x in w) for w in p];heapq.heapify(heap);index={}
 for i,g in enumerate(rows):
  if not g:raise Invalid('zero basis rule')
  lm=max(g);index.setdefault(len(lm),{}).setdefault(lm,i)
 proof=[]
 while heap:
  w=tuple(-x for x in heapq.heappop(heap));c=p.pop(w,0)
  if not c:continue
  b.check(len(p)+len(out));hit=None
  for n in sorted(index):
   if n>len(w):break
   for j in range(len(w)-n+1):
    i=index[n].get(w[j:j+n])
    if i is not None and (hit is None or (i,j)<hit):hit=(i,j)
  if hit is None:out[w]=c;continue
  i,j=hit;g=rows[i];lm=max(g);left=w[:j];right=w[j+len(lm):];factor=c/g[lm]
  if trace:proof.append({'rule':i,'left':list(left),'right':list(right),'coefficient':str(factor)})
  for v,a in g.items():
   if v==lm:continue
   u=left+v+right;delta=-factor*a
   if u not in p:
    if delta:p[u]=delta;heapq.heappush(heap,tuple(-x for x in u))
   else:
    p[u]+=delta
    if not p[u]:del p[u]
 return (out,proof) if trace else out
class PyOracle:
 def __init__(self,rows,ng,degree):self.rows=rows;self.ng=ng;self.degree=degree;self.leaders=[max(p) for p in rows];self.steps=0
 def nf(self,p,budget=None,skip=None):
  if homogeneous(p)>self.degree:raise Invalid('query exceeds the declared oracle degree')
  return normal(p,[r for i,r in enumerate(self.rows) if i!=skip],budget)
 def close(self):pass
class NativeOracle:
 def __init__(self,path,ng,degree):
  self.path=Path(path);self.ng=ng;self.degree=degree;lib=ROOT/'bin/libproofnf.so'
  if not lib.exists():raise Invalid('native oracle missing: run make')
  self.lib=C.CDLL(str(lib));l=self.lib;l.kp_open.argtypes=[C.c_char_p,C.c_uint,C.c_uint];l.kp_open.restype=C.c_void_p;l.kp_error.restype=C.c_char_p
  l.kp_query.argtypes=[C.c_void_p,C.c_char_p,C.c_double,C.c_uint64,C.c_int64,C.c_int];l.kp_query.restype=C.c_char_p;l.kp_close.argtypes=[C.c_void_p]
  self.ptr=l.kp_open(os.fsencode(path),ng,degree)
  if not self.ptr:raise Invalid(l.kp_error().decode())
  self.steps=0;self.allow_partial=False
 def nf(self,p,budget=None,skip=None,oldest=False):
  p=clean(p)
  if not p:return{}
  b=budget or Budget();d=homogeneous(p)
  if d>self.degree and not self.allow_partial:raise Invalid('query exceeds declared complete degree')
  b.check(len(p));txt=f'{d} {len(p)}\n'+''.join((''.join(format(a,'x') for a in w) or '-')+' '+str(c)+'\n' for w,c in p.items())
  text=self.lib.kp_query(self.ptr,txt.encode(),b.left(),b.terms,-1 if skip is None else skip,oldest).decode()
  lines=text.splitlines()
  if lines[0].startswith('ERROR'):
   if 'LIMIT' in lines[0]:raise Incomplete(lines[0])
   raise Invalid(lines[0])
  tag,dd,n,steps=lines[0].split();self.steps+=int(steps);ans={}
  if tag!='OK' or int(dd)!=d or len(lines)!=int(n)+1:raise Invalid('malformed native response')
  for line in lines[1:]:
   w,c=line.split();word=tuple(int(a,16) for a in w) if w!='-' else ();ans[word]=F(c)
  return ans
 def close(self):
  if self.ptr:self.lib.kp_close(self.ptr);self.ptr=None
 def __del__(self):
  if getattr(self,'ptr',None):self.close()
MASK=(1<<64)-1
def records(path,through,ng,verify=True):
 last=0
 with Path(path).open('rb') as f:
  while True:
   h=f.read(32)
   if not h:return
   if len(h)!=32:raise Invalid('truncated GNB header')
   magic,size,n,d,check,res=struct.unpack('<IIIIQQ',h)
   if magic!=0x31424e47 or res or not n or d<last or not d or size<32+24*n or size>1<<30:raise Invalid('invalid GNB header')
   last=d
   if d>through:return
   data=h+f.read(size-32)
   if len(data)!=size:raise Invalid('truncated GNB row')
   if verify:
    x=1469598103934665603
    for a in data[32:]:x=((x^a)*1099511628211)&MASK
    if x!=check:raise Invalid('GNB checksum mismatch')
   p={};prev=None
   for i in range(n):
    lo,hi,c=struct.unpack_from('<QQQ',data,32+24*i)
    if hi>>63:
     if d<=31 or hi!=(1<<63)|d or lo<32+24*n or lo+d>size:raise Invalid('bad long word')
     w=tuple(data[lo:lo+d])
    else:
     v=lo+(hi<<64)
     if d>31 or v>>(4*d):raise Invalid('bad inline word')
     w=tuple((v>>(4*j))&15 for j in reversed(range(d)))
    if any(a>=ng for a in w) or prev is not None and w>=prev:raise Invalid('bad word/order')
    prev=w
    if c&1:
     at=c&~7
     if at<32+24*n or at+8>size:raise Invalid('bad coefficient offset')
     limbs,pad=struct.unpack_from('<II',data,at)
     if not limbs or pad or at+8+limbs*4>size:raise Invalid('bad coefficient limbs')
     val=int.from_bytes(data[at+8:at+8+4*limbs],'little')*(-1 if c&2 else 1)
    else:val=(c if c<1<<63 else c-(1<<64))//2
    if not val:raise Invalid('zero coefficient')
    p[w]=F(val)
   yield p

def write_gnb(path,rows):
 """Primitive integer ABI-3 records. Rational input is cleared row by row."""
 import math
 Path(path).parent.mkdir(parents=True,exist_ok=True)
 with Path(path).open('wb') as f:
  for p in rows:
   p=monic(p);d=homogeneous(p)
   if not p or not d:raise Invalid('nonempty positive homogeneous row required')
   den=1
   for c in p.values():den=math.lcm(den,c.denominator)
   terms=[(w,int(c*den)) for w,c in sorted(p.items(),reverse=True)];n=len(terms);head=bytearray(32+24*n);tail=bytearray()
   def store(b):
    offset=len(head)+len(tail);tail.extend(b);tail.extend(b'\0'*((-len(b))%8));return offset
   for i,(w,c) in enumerate(terms):
    if any(a<0 or a>15 for a in w):raise Invalid('ABI alphabet limit 16')
    if d<=31:
     v=0
     for a in w:v=v*16+a
     lo=v&MASK;hi=v>>64
    else:lo=store(bytes(w));hi=(1<<63)|d
    if abs(c)<1<<62:tag=(c<<1)&MASK
    else:
     ln=(abs(c).bit_length()+31)//32;offset=store(struct.pack('<II',ln,0)+abs(c).to_bytes(ln*4,'little'));tag=offset|1|(2 if c<0 else 0)
    struct.pack_into('<QQQ',head,32+24*i,lo,hi,tag)
   data=head+tail;x=1469598103934665603
   for c in data[32:]:x=((x^c)*1099511628211)&MASK
   struct.pack_into('<IIIIQQ',data,0,0x31424e47,len(data),n,d,x,0);f.write(data)

def fixture_rows(f):return [parse(r,f['generators'] if isinstance(f.get('generators'),int) else len(f['variables'])) for r in f['relations']]
def normal_words(leaders,ng,d,limit=1000000):
 levels=[()];by={}
 for w in leaders:by.setdefault(len(w),set()).add(w)
 for _ in range(d):
  nxt=[]
  for w in levels:
   for a in range(ng):
    u=w+(a,)
    if not any(len(u)>=n and u[-n:] in ss for n,ss in by.items()):nxt.append(u)
    if len(nxt)>limit:raise Incomplete('normal-word enumeration cap; use structural/image mode')
  levels=nxt
 return levels
class Echelon:
 """Sparse exact row echelon with optional coordinates in original row list."""
 def __init__(self,budget=None):self.piv={};self.n=0;self.budget=budget or Budget()
 def reduce(self,p):
  p=clean(p);coords={}
  while p:
   self.budget.check(len(p)+len(coords))
   w=max(p)
   if w not in self.piv:break
   row,comb=self.piv[w];c=p[w];p=add(p,row,-c);coords=add(coords,comb,c)
  return p,coords
 def append(self,p):
  rem,coords=self.reduce(p)
  if not rem:return False,coords
  pivot=max(rem);c=rem[pivot];comb=add({(self.n,):F(1)},coords,-1);comb={k:v/c for k,v in comb.items()};self.piv[pivot]=({w:a/c for w,a in rem.items()},comb);self.n+=1;return True,coords
 def coordinates(self,p):
  rem,c=self.reduce(p)
  if rem:raise Invalid('vector not in the asserted span')
  return {k[0]:v for k,v in c.items()}

def leader_records(path,through,ng):
 """Low-memory GNB index scan. Does not claim to verify coefficient checksums."""
 with Path(path).open('rb') as f:
  last=0;i=0
  while True:
   start=f.tell();h=f.read(32)
   if not h:return
   if len(h)!=32:raise Invalid('truncated leader header')
   magic,size,n,d,cs,res=struct.unpack('<IIIIQQ',h)
   if magic!=0x31424e47 or not n or not d or d<last or res or size<32+24*n:raise Invalid('invalid leader index')
   last=d
   if d>through:return
   term=f.read(24)
   if len(term)!=24:raise Invalid('truncated leader')
   lo,hi,c=struct.unpack('<QQQ',term)
   if hi>>63:
    if d<=31 or hi!=((1<<63)|d) or lo<32+24*n or lo+d>size:raise Invalid('bad long leader')
    f.seek(start+lo);raw=f.read(d)
    if len(raw)!=d:raise Invalid('truncated long leader')
    w=tuple(raw)
   else:
    v=lo+(hi<<64)
    if d>31 or v>>(4*d):raise Invalid('bad inline leader')
    w=tuple((v>>(4*j))&15 for j in reversed(range(d)))
   if any(a>=ng for a in w):raise Invalid('leader letter out of range')
   yield {'id':i,'degree':d,'leadingWord':w,'terms':n,'offset':start,'bytes':size,'checksum':cs}
   i+=1;f.seek(start+size)

def fixture_from_polys(variables,rows):
 """Primitive-integer native input. Never stringify rational coefficients for
 a producer whose input ABI accepts integers only."""
 import math
 relations=[]
 for p in rows:
  p=clean(p)
  if not p:continue
  d=homogeneous(p)
  if d<1:raise Invalid('constant input relation unsupported')
  den=1
  for c in p.values():den=math.lcm(den,c.denominator)
  terms={w:int(c*den) for w,c in p.items()};g=0
  for c in terms.values():g=math.gcd(g,abs(c))
  terms={w:c//g for w,c in terms.items()}
  if max(map(abs,terms.values()))>(1<<62)-1:raise Invalid('native input coefficient ABI exceeded; use a producer accepting arbitrary rational input or the bounded reference completion')
  relations.append({'degree':d,'terms':[{'word':list(w),'coefficient':str(c)} for w,c in terms.items()]})
 return {'variables':list(variables),'relations':relations}
