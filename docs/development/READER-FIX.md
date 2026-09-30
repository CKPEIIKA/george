# Reader recovery in George 0.2

Reviewed and fixed 2026-09-30. The engine remains **bergman-1.001-fix**;
George's interface/package version is **0.2 / 0.2.0**.

## Reproduction and causes

On the previous shipped Wasm engine, `(simple)` and
`(simple "missing.bg" "out.gb")` enter Bergman's keyboard input path.
The browser supplies EOF. `RATOM` replaces `*READTABLE*` and restores it only
after a successful `READ`. Its punctuation macros then remain installed.
`ALGFORMINPUT`, `ADDALGFORMINPUT` and `REDANDALGIN` also restore `RAISE`
only after `ERRORSET` returns normally; `END-OF-FILE` escapes that handler.
It can therefore leave the command reader's case conversion changed.

The next C bridge call rereads `GEORGE:EVALUATE-TEXT` through the damaged
readtable, outside the evaluator's Lisp error handler. The colon is read as
an algebraic token. The reproduced result was an undefined `GEORGE` function,
repeated debugger errors and process exit, rather than a recoverable command
error. Stream redirection is another state that must unwind on failure.

## Changes

- `ports/common/reader-patches.py` changes only disposable build copies.
  `RATOM` dynamically binds its copied readtable; the three algebraic readers
  restore `RAISE` with `UNWIND-PROTECT`. These Common Lisp reader recovery
  repairs apply in native SBCL and ECL, in both algebra modes.
- `ports/ecl/bridge.c` resolves the evaluator once during initialization and
  registers its cached function as a GC root. Subsequent calls do not parse
  a bridge function name through a user's readtable.
- `ports/ecl/boot.lisp` supplies an input stream that signals a dedicated
  error on a keyboard read. It also protects redirected standard streams,
  restores the readtable/case/RAISE after errors, and reports file errors.
  File-based DF commands check their literal input file inside their macro
  expansion at execution time. Nested forms, EVAL and user functions use the
  same protection; the check is not a console text parser.
- Startup completes and flushes its last line before the first command.
  A user's first result `T` is preserved exactly.
- The console no longer classifies keyboard commands, wraps file checks,
  watches EOF output to restart the worker, or strips the first `T`.

The ECL host has no interactive keyboard in either mode; both retain the
original or fixed algebra computation as selected. Native interactive input
remains available. Error recovery does not promise rollback of an algebra
that was partially read or computed: use `CLEARRING` before replacing such
input. The session and its unrelated variables/files survive.

## Executed evidence

`npm run test:reader` runs eight native EOF checks and **23 consecutive
failed commands in each Wasm mode**. Cases include missing/no file, nested
forms, EVAL, RATOM and every algebraic input reader, redirected terminal,
input and output streams, truncated algebra input and Lisp syntax, and a
failed change to RAISE. Every error is followed by successful arithmetic and
a variable/file retention check in the same runtime. A fresh computation
and explicit GC succeed afterward. The first legitimate `T` is checked.

The actual console UI repeats eight recovery cases at both `/` and
`/george/`, checks retained settings/files, help, Tab completion, history,
and the current-computation button. Historical 37-file suites still match
in both modes on native, Node/Wasm and Chromium; the independent algebra,
braid, longer-name and OCaml checks are rerun for the rebuilt release.

Exact source and engine hashes accompany
[reader.json](validation/reader.json) and [ui.json](validation/ui.json).
