#!/usr/bin/env python3
"""Independent tuple-word/Fraction checker with lazy bounded record caching.
No native arithmetic, precomputed division table or production normal forms.
"""
from pathlib import Path
from fractions import Fraction
from functools import lru_cache
import struct,heapq,time
class Quotient:
 def __init__(self,path):
  self.path=Path(path);self.file=self.path.open('rb');self.entries=[];self.index={};self.steps=0
  while True:
   offset=self.file.tell();h=self.file.read(32)
   if not h:break
   if len(h)!=32:raise ValueError('short header')
   magic,size,n,d=struct.unpack_from('<IIII',h)
   if magic!=0x31424e47 or not 1<=d<=14 or n<1 or size!=32+24*n:raise ValueError('bad record')
   body=self.file.read(24)
   if len(body)!=24:raise ValueError('short first term')
   w,hi,c=struct.unpack('<QQq',body)
   if hi or c&1 or c<=0:raise ValueError('invalid leading term')
   word=self.word(w,d)
   if word in self.index:raise ValueError('duplicate leader')
   self.index[word]=len(self.entries);self.entries.append((offset,size,n,d,word));self.file.seek(offset+size)
  self.lengths=sorted({x[3]for x in self.entries})
  for idx,(_,_,_,d,w) in enumerate(self.entries):
   for k in self.lengths:
    if k>d:break
    for j in range(d-k+1):
     q=self.index.get(w[j:j+k])
     if q is not None and q!=idx:raise ValueError('leader inclusion')
 @staticmethod
 def word(w,d):
  if w>=1<<(4*d):raise ValueError('word overflows degree')
  out=tuple((w>>(4*i))&15 for i in reversed(range(d)))
  if any(x>=5 for x in out):raise ValueError('invalid generator')
  return out
 @lru_cache(maxsize=512)
 def rule(self,i):
  off,size,n,d,w=self.entries[i];self.file.seek(off);raw=self.file.read(size)
  if len(raw)!=size:raise ValueError('short record body')
  h=1469598103934665603
  for v in raw[32:]:h=((h^v)*1099511628211)&((1<<64)-1)
  if h!=struct.unpack_from('<Q',raw,16)[0]:raise ValueError('checksum')
  p={};old=None
  for j in range(n):
   v,hi,c=struct.unpack_from('<QQq',raw,32+24*j)
   if hi or c&1 or not c:raise ValueError('unsupported/zero term')
   word=self.word(v,d)
   if old is not None and word>=old:raise ValueError('unsorted row')
   p[word]=Fraction(c//2);old=word
  return p
 def nf(self,p,seconds=120):
  p={w:Fraction(c)for w,c in p.items()if c};heap=[tuple(-a for a in w)for w in p];heapq.heapify(heap);normal={};end=time.monotonic()+seconds;steps=0
  while heap:
   w=tuple(-a for a in heapq.heappop(heap));c=p.pop(w,0)
   if not c:continue
   steps+=1
   if steps%1024==0 and time.monotonic()>end:raise TimeoutError('independent NF budget')
   hit=None
   # Deliberately use oldest rule, then leftmost; unlike the GMP shortest-first
   # rule choice. Confluence requires equality of the final normal form.
   for d in self.lengths:
    if d>len(w):break
    for j in range(len(w)-d+1):
     k=self.index.get(w[j:j+d])
     if k is not None and (hit is None or (k,j)<hit):hit=(k,j)
   if hit is None:normal[w]=c;continue
   k,j=hit;g=self.rule(k);lm=self.entries[k][4];c=-c/g[lm]
   for v,b in g.items():
    if v==lm:continue
    u=w[:j]+v+w[j+len(lm):];delta=c*b
    if u in p:
     p[u]+=delta
     if not p[u]:del p[u]
    elif delta:p[u]=delta;heapq.heappush(heap,tuple(-a for a in u))
  self.steps+=steps;return normal
 def close(self):self.file.close();self.rule.cache_clear()
