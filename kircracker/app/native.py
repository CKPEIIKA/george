"""Lazy ctypes bindings. Heavy arithmetic stays in C++; this module has no solver."""
import ctypes as C
from .util import ROOT,Invalid,Incomplete
U64=C.c_uint64;I32=C.c_int32;P64=C.POINTER(U64)
def libraries():
 pair=C.CDLL(str(ROOT/'bin/libtriepair.so'));ver=C.CDLL(str(ROOT/'bin/libverify.so'))
 pair.kp_create.argtypes=[C.c_int,C.c_int,U64];pair.kp_create.restype=C.c_void_p
 pair.kp_destroy.argtypes=[C.c_void_p]
 pair.kp_minor_trie_wide.argtypes=[C.c_void_p,P64,C.c_int,P64,C.c_int,C.c_int,C.POINTER(C.c_int),C.POINTER(C.c_int),C.POINTER(C.c_int),P64,C.c_double];pair.kp_minor_trie_wide.restype=C.c_int
 ver.kv_verify_compact.argtypes=[C.c_int,C.c_int,P64,P64,C.c_int,C.c_int,C.c_int,C.c_int,C.POINTER(I32),C.POINTER(I32),P64];ver.kv_verify_compact.restype=C.c_int
 return pair,ver
def buffer(raw):
 if len(raw)%16:raise Invalid('invalid wide-word buffer length')
 return (U64*(len(raw)//8)).from_buffer_copy(raw)
def verify_words(meta,left,right,expected=None,threads=1):
 _,v=libraries();u,w=buffer(left),buffer(right);det=I32();stats=(U64*2)()
 rc=v.kv_verify_compact(6,meta['degree'],u,w,meta['rank'],meta['prime'],threads,64,expected,C.byref(det),stats)
 if rc:raise Invalid(f'independent minor verification failed (code {rc})')
 if 'determinant' in meta and det.value!=meta['determinant']:raise Invalid('independent determinant mismatch')
 return {'determinant':det.value,'entriesReplayed':int(stats[0]),'maxAbsIntegerEntry':int(stats[1]),'independentIntegerPrefixReplay':True}
