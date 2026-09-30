#!/usr/bin/env python3
"""ECL reader/compiler adapters, applied only to a disposable build copy."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
p = root / 'src/macros.sl'
old = "(DM Maplst (rrg) (CONS 'CAR (CDR rrg)))"
new = """(DM Maplst (rrg)
 (COND ((CDDR rrg) (LIST 'APPLY '(FUNCTION CAR) (CONS 'LIST (CDR rrg))))
       (T (CONS 'CAR (CDR rrg)))))"""
s = p.read_text()
assert s.count(old) == 1
p.write_text('% Modified by George on 2026-09-30: defer invalid Maplst arity to runtime, as in the original CL build.\n' + s.replace(old, new))

# ECL stops expanding a macro when it returns the identical input object.
# Bergman's autoload macros redefine themselves and then return that object.
p = root / 'bin/ecl/environ.lsp'
s = p.read_text()
old = '  ,@body)\n)'
assert s.count(old) == 1
p.write_text('; Modified by George on 2026-09-30: copy macro expansions so ECL re-expands autoloaded definitions.\n' + s.replace(old, '  (copy-tree (progn ,@body)))\n)'))

# Browser CPU usage syscalls are unavailable. Use elapsed milliseconds for
# diagnostic timings; algebra and legacy output files are unaffected.
p = root / 'bin/ecl/environ.lsp'
s = p.read_text().replace('(get-internal-run-time)', '(get-internal-real-time)')
p.write_text('; Modified by George on 2026-09-30: portable elapsed-time diagnostics.\n' + s)
