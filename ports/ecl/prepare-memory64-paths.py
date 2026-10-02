#!/usr/bin/env python3
"""Give the browser runtime neutral diagnostic and system source paths."""
from pathlib import Path
import sys

source, prefix = map(lambda s: Path(s).resolve(), sys.argv[1:3])
makefile = source / 'build/c/Makefile'
text = makefile.read_text()
original = '-DECLDIR="\\"' + str(prefix) + '\\""'
if original not in text:
    raise SystemExit('Pinned ECL library-directory flag changed')
makefile.write_text(text.replace(original, '-DECLDIR="\\"/george-ecl-memory64\\""'))
config = source / 'build/lsp/config.lsp'
text = config.read_text()
original = '#.(truename "' + str(source / 'src') + '/")'
if original not in text:
    raise SystemExit('Pinned ECL system-source pathname changed')
config.write_text(text.replace(original, '#P"/ecl-source/src/"'))
