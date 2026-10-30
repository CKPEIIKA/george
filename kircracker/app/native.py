"""Lazy ctypes bindings. Heavy arithmetic stays in C++; this module has no solver."""
import ctypes as C
import os
import functools
from pathlib import Path
from .util import ROOT,Invalid,Incomplete
U64=C.c_uint64;I32=C.c_int32;P64=C.POINTER(U64)
def library_paths():
 return tuple(Path(os.environ.get(key,str(ROOT/'bin'/name))).expanduser().resolve()for key,name in [('KIR_PAIR_LIBRARY','libtriepair.so'),('KIR_VERIFY_LIBRARY','libverify.so')])
@functools.lru_cache(maxsize=1)
def libraries():
 pair_path,verify_path=library_paths();pair=C.CDLL(str(pair_path));ver=C.CDLL(str(verify_path))
 pair.kp_create.argtypes=[C.c_int,C.c_int,U64];pair.kp_create.restype=C.c_void_p
 pair.kp_destroy.argtypes=[C.c_void_p]
 pair.kp_minor_trie_wide.argtypes=[C.c_void_p,P64,C.c_int,P64,C.c_int,C.c_int,C.POINTER(C.c_int),C.POINTER(C.c_int),C.POINTER(C.c_int),P64,C.c_double];pair.kp_minor_trie_wide.restype=C.c_int
 ver.kv_verify_compact.argtypes=[C.c_int,C.c_int,P64,P64,C.c_int,C.c_int,C.c_int,C.c_int,C.POINTER(I32),C.POINTER(I32),P64];ver.kv_verify_compact.restype=C.c_int
 ver.kv_verify_compact128.argtypes=[C.c_int,C.c_int,P64,P64,C.c_int,C.c_int,C.c_int,C.c_int,C.POINTER(I32),C.POINTER(I32),P64];ver.kv_verify_compact128.restype=C.c_int
 if hasattr(pair,'kp_engine_error'):pair.kp_engine_error.restype=C.c_char_p
 if hasattr(ver,'kv_last_error'):ver.kv_last_error.restype=C.c_char_p
 return pair,ver
def buffer(raw):
 if len(raw)%16:raise Invalid('invalid wide-word buffer length')
 cls=U64*(len(raw)//8)
 try:return cls.from_buffer(raw)
 except (TypeError,BufferError):return cls.from_buffer_copy(raw)
def verify_words(meta,left,right,expected=None,threads=1,cache=None,fingerprint=None):
 if cache is not None:
  if expected is not None:raise Invalid('explicit expected matrix requires a full replay')
  from .verified_cache import verify
  return verify(meta,left,right,cache,fingerprint,threads)
 _,v=libraries();u,w=buffer(left),buffer(right);det=I32();stats=(U64*2)()
 fn=v.kv_verify_compact128 if meta['degree']>20 else v.kv_verify_compact
 rc=fn(6,meta['degree'],u,w,meta['rank'],meta['prime'],threads,64,expected,C.byref(det),stats)
 if rc:
  message=v.kv_last_error().decode('utf8','replace') if hasattr(v,'kv_last_error') else ''
  raise Invalid(f'independent minor verification failed (code {rc}): {message or "inspect the verifier log"}')
 if 'determinant' in meta and det.value!=meta['determinant']:raise Invalid('independent determinant mismatch')
 out={'determinant':det.value,'entriesReplayed':int(stats[0]),'independentIntegerPrefixReplay':True}
 if meta['degree']>20: out['maxAbsIntegerEntryBits']=int(stats[1]);out['integerArithmetic']='signed-128-exact'
 else: out['maxAbsIntegerEntry']=int(stats[1]);out['integerArithmetic']='signed-64-exact'
 return out
