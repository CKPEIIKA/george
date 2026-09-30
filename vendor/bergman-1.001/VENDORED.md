# Vendored: bergman 1.001

A copy of the parts of bergman 1.001 (22 Aug 2007) that George builds on,
taken unmodified from the original distribution:

    src/              Standard Lisp sources (the program itself)
    auxil/            build files, including auxil/clisp/ (the Common Lisp layer)
    domains/          modular logarithm tables
    kernel/conv.c     the case converter used by the PSL build
    scripts/clisp/    the Common Lisp build scripts
    tests/test_bergman/, tests/clisp/   regression inputs and reference outputs
    doc/copyright     the Bergman General Public License
    ReadMe            the original installation notes

Not included: the PSL/Reduce binaries and scripts for other platforms, the
Java shell, and the manual (doc/).  Do not edit files here; portability
changes live in ports/ and are applied to a build copy.

Release cleanup also excludes upstream `.nfs*` filesystem remnants,
generated LaTeX `.aux`, `.dvi`, `.log` and `.toc` files, test-run logfiles and
diff reports, and unused editor backups. Retained source files are unmodified.
Historical `.old` reference outputs are intentional evidence. Seven backup
inputs (`anick5~`, `anick_tm~`, `anick_w~`, `lin_nc~`, `lin~`, `nhom~`,
`simp_w_max~`) are retained because `tools/validate-extra.mjs` executes them,
including the expected rejection of the malformed `lin_nc~` input.

bergman is Copyright (C) 1992-2006 Joergen Backelin and is distributed
under the Bergman General Public License (doc/copyright).
