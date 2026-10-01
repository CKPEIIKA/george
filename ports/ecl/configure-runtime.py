#!/usr/bin/env python3
"""Select ECL's wasm library optimization before configure runs."""
from pathlib import Path
import sys

source, optimization, longjmp = sys.argv[1:]
if optimization not in ('O0', 'O1', 'O2', 'O3'):
    raise SystemExit('Unsupported ECL optimization')
if longjmp not in ('emscripten', 'wasm'):
    raise SystemExit('Unsupported longjmp mode')
configure = Path(source) / 'src/configure'
text = configure.read_text()
original = 'CFLAGS="${CFLAGS} -DECL_C_COMPATIBLE_VARIADIC_DISPATCH -O0"'
if text.count(original) != 1:
    raise SystemExit('Pinned ECL wasm configuration changed; review the build flags')
extra = ' -sSUPPORT_LONGJMP=wasm' if longjmp == 'wasm' else ''
text = text.replace(original, original.replace('-O0', '-' + optimization + extra))
if extra:
    text = text.replace('-sBINARYEN_EXTRA_PASSES=--spill-pointers"',
                        '-sBINARYEN_EXTRA_PASSES=--spill-pointers' + extra + '"')
configure.write_text(text)
if extra:
    # Emscripten cannot mix JS exceptions with native Wasm setjmp/longjmp.
    gc_configure = configure.parent / 'bdwgc/configure'
    text = gc_configure.read_text()
    if '-fexceptions' not in text:
        raise SystemExit('Pinned GC exception configuration changed')
    gc_configure.write_text(text.replace('-fexceptions', '-fwasm-exceptions'))
