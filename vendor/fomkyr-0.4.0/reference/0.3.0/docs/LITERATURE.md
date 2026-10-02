# Sources and implementation choices

The earlier literature/source review is preserved under
`reference/0.1.0/docs/LITERATURE.md`. This release extends that implementation; it is not
a wholesale translation of Bergman or Singular and does not claim to implement all their
criteria, module algorithms or homological computations.

La Scala, Tiwari, *Multigraded Hilbert Series of noncommutative modules*,
https://arxiv.org/abs/1705.01083 . Establishes connections to regular languages and methods
for noncommutative graded/module Hilbert series, including truncated computation and a
Singular implementation. Relevant design choice here: count allowed leading-word
avoiding paths, but restrict certification to the computed GB degree. The current code
is a new narrow C implementation, not their full multigraded-module algorithm.

Henning, Lu, Melia, Murayama, *Hilbert series and operator bases with derivatives in
effective field theories*, https://arxiv.org/abs/1507.07240 . Explains the relevance of
Hilbert series to physical operator counting with EOM/IBP redundancies. It does not imply
that a generic NC word counter automatically handles physical symmetries. The feature
boundary is detailed in PHYSICS.md.

Blasiak, Liu, Mészáros, *Subalgebras of the Fomin-Kirillov algebra*,
https://arxiv.org/abs/1310.4112 . Background on the target family and its subalgebras.
The actual checked mapping from the user's 15-generator input to FK6 is retained in
`reference/0.1.0/results/fk-identification.json` with the original source report.

WHATWG File System Standard, https://fs.spec.whatwg.org/ . OPFS directory access,
synchronous worker handles, flush/close and shared/exclusive lock semantics. The unsafe
shared-access mode does not remove the application's obligation to coordinate all
readers and writers; epochs in fomkyr do that. Availability must be checked on the target
browser, not inferred from a Node mock.

Google Chrome, *New developer trial for multiple readers and writers for
FileSystemSyncAccessHandle*,
https://developer.chrome.com/blog/new-dev-trial-for-multiple-readers-and-writers .
Motivation and semantics of shared access modes used by the multi-reader host.

Google web.dev, *Persistent storage*, https://web.dev/articles/persistent-storage .
A persistence request can be denied; the UI reports the actual result. Browser storage
retention is not an external backup, and user deletion remains possible.

Source context for George integration was inspected from public raw files in
https://github.com/CKPEIIKA/george , especially web/engine/worker.js,
web/src/engine.js, web/src/backends.js and web/src/bergman-syntax.js.
The installer matches specific source shapes and refuses mismatches. No live remote
write or deployed end-to-end test was performed.

No new mathematical pruning theorem is claimed for the batch queue or cache. These are
engineering changes around exact reduction and conservative degree completion. Signature
criteria, GPU code and arbitrary external-memory matrix reduction remain unimplemented.

Browser capability references and exact deployment/test limitations added in 0.3.0
are in `BROWSER_COMPATIBILITY.md`. Long-word representation, conservative completion
and tunable resource limits are specified in `DEGREES_AND_TUNING.md`. This release
does not introduce a new mathematical completion criterion beyond resolving all
critical ambiguities.
