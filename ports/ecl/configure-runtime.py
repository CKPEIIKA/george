#!/usr/bin/env python3
"""Select ECL's wasm library optimization before configure runs."""
from pathlib import Path
import sys

source, optimization, longjmp = sys.argv[1:4]
lto = sys.argv[4] if len(sys.argv) > 4 else '0'
if optimization not in ('O0', 'O1', 'O2', 'O3'):
    raise SystemExit('Unsupported ECL optimization')
if longjmp not in ('emscripten', 'wasm'):
    raise SystemExit('Unsupported longjmp mode')
if lto not in ('0', '1'):
    raise SystemExit('LTO must be 0 or 1')
configure = Path(source) / 'src/configure'
text = configure.read_text()
original = 'CFLAGS="${CFLAGS} -DECL_C_COMPATIBLE_VARIADIC_DISPATCH -O0"'
if text.count(original) != 1:
    raise SystemExit('Pinned ECL wasm configuration changed; review the build flags')
extra = ' -sSUPPORT_LONGJMP=wasm' if longjmp == 'wasm' else ''
flags = extra + (' -flto' if lto == '1' else '')
text = text.replace(original, original.replace('-O0', '-' + optimization + flags))
if flags:
    text = text.replace('-sBINARYEN_EXTRA_PASSES=--spill-pointers"',
                        '-sBINARYEN_EXTRA_PASSES=--spill-pointers' + flags + '"')
configure.write_text(text)
if extra:
    # Emscripten cannot mix JS exceptions with native Wasm setjmp/longjmp.
    gc_configure = configure.parent / 'bdwgc/configure'
    text = gc_configure.read_text()
    if '-fexceptions' not in text:
        raise SystemExit('Pinned GC exception configuration changed')
    gc_configure.write_text(text.replace('-fexceptions', '-fwasm-exceptions'))
