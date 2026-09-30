#!/usr/bin/env python3
"""Restore reader state on every exit, in disposable Common Lisp build copies."""
from pathlib import Path
import sys

root, environ = map(Path, sys.argv[1:])
s = environ.read_text()
old = """  (let
;    ( (save-readtable (copy-readtable))
    ( (save-readtable *readtable*)
      (temp nil)
    )
    (setq *readtable* (copy-readtable))"""
assert s.count(old) == 1
s = s.replace(old, "  (let ((*readtable* (copy-readtable)))")
old = """    (setq temp (read))
    (setq *readtable* save-readtable)
    temp"""
assert s.count(old) == 1
s = s.replace(old, "    (read)")
environ.write_text('; Modified by George on 2026-09-30: dynamically bind RATOM readtables so errors and nonlocal exits restore the Lisp reader.\n' + s)

p = root / 'src/alg2lsp.sl'
s = p.read_text()
for expression in ["'(UnRaisedAlgIn NIL)", "'(UnRaisedAlgIn T)", "'(UnRaisedRedandAlgIn)"]:
    # ALGFORMINPUT and its siblings change the case of the caller's readtable
    # before entering an error-prone reader. Restore both RAISE and the case
    # even when ERRORSET does not catch the condition (e.g. END-OF-FILE).
    old = f"(SETQ err!-result (ERRORSET {expression} NIL NIL))"
    start = s.index(old)
    restore_start = s.index('(COND (save!-raise', start)
    depth = 0
    for end in range(restore_start, len(s)):
        if s[end] == '(':
            depth += 1
        elif s[end] == ')':
            depth -= 1
            if depth == 0:
                end += 1
                break
    restore = s[restore_start:end]
    s = s[:start] + f"(SETQ err!-result\n          (UNWIND-PROTECT (ERRORSET {expression} NIL NIL)\n            {restore}))\n\t" + s[end:]
p.write_text('% Modified by George on 2026-09-30: restore RAISE after algebraic-reader errors and nonlocal exits.\n' + s)
