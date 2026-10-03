```
FOMKYR(1)                     Fomkyr Manual                     FOMKYR(1)
```

## NAME

**fomkyr** — fast pure C engine for exact Gröbner bases of homogeneous associative algebras.

## VERSION

**0.6.6**, [MIT license](LICENSE). Fomkyr is a standalone C engine and a
subproject of [George](../README.md). George also runs this kernel through
WebAssembly; its engine chooser marks that integration experimental.

## SYNOPSIS

Download the [standalone source bundle](https://ckpeiika.github.io/george/sources/fomkyr-source.tar.gz),
extract it and enter the `fomkyr/` directory. Run these commands on the machine
that will perform the calculation:

```sh
make check
make
./dist/fomkyr -i fixtures/user-form.bg -d 10 -j 4 --memory 4G \
  --workdir fk6-job --export
```

The included input is the 15-generator, 100-relation FK6 presentation. To
continue the saved calculation or inspect its checkpoint:

```sh
./dist/fomkyr --resume fk6-job -d 11 -j 4 --memory 4G --export
./dist/fomkyr --resume fk6-job --status
```

A C11 compiler, make and POSIX threads are sufficient for native execution.
Node.js and Python are used by optional Wasm tools and test utilities.
`make install PREFIX=/desired/prefix` installs the executable and manual page.

## DESCRIPTION

Fomkyr completes homogeneous noncommutative presentations over ℚ or a prime
field using degree followed by left lexicographic word order. The last declared
generator is greatest. It accepts 1–16 generators with unit degrees and integer
input coefficients of absolute value at most 2^62−1. Internal rational arithmetic
is exact, including arbitrary-precision coefficients during reduction.

The C engine uses sparse heaps, exact rewrite caches, critical-pair criteria,
monomial pruning and bounded workspaces. Native pthread workers share the basis;
batches reduce in parallel and commit in a deterministic order. The native
executable has no Wasm memory ceiling. Four optional Wasm modules provide
32-bit and 64-bit addressing, shared multicore and single-worker execution.

An inclusive degree bound certifies the reported completed prefix. Unrestricted
completion requires exhausting all critical pairs. Earlier polynomial tails are
not globally interreduced. Some presentations have infinite Gröbner bases.

## NATIVE OPTIONS

| Option | Purpose |
| --- | --- |
| `-i FILE` | Expanded George `vars …; …;` input or JSON fixture; `-` reads standard input. |
| `-d N` | Inclusive degree bound; default 20, zero requests unrestricted completion. |
| `-j N` | 1–32 native workers; defaults to available CPU threads, within this range. |
| `--memory SIZE` | Kernel allowance; default auto uses OS/cgroup headroom. K/M/G/T use binary units. |
| `--workdir DIR` | Durable job directory; matching checkpoints resume automatically. |
| `--resume DIR` | Resume with saved input and field. |
| `--checkpoint-seconds N` | Save at safe boundaries; default 30. Zero saves at every available boundary. |
| `--time-limit N` | Request cancellation after N seconds following initialization; zero is unlimited. |
| `--batch-pairs N` | 1–512 pairs per batch; default 128. |
| `--field N` | Zero for ℚ, otherwise a supported prime characteristic. |
| `--export` | Stream the complete text basis to `result.gb`. |
| `--hilbert` | Export exact Hilbert coefficients through the completed degree. |
| `--status` | Read the newest valid checkpoint without computing. |
| `--dry-run` | Show the memory plan without allocating the kernel workspace. |
| `--fresh` | Explicitly discard the matching algebra's cached work. |
| `--quiet` | Suppress progress and checkpoint messages. |
| `--help` | List all options, including optional Wasm execution and Hilbert closure. |

Automatic workspace uses 4/7 of the kernel allowance for scratch and up to 1/7
for exceptional rational rows. Allocated capacity and physical resident RAM are
separate quantities. OS, cgroup, address-space and record limits still apply.

SIGUSR1 requests a safe checkpoint and continues. SIGINT/SIGTERM request a
checkpoint and stop. Mid-degree checkpoints retain committed pairs; uncommitted
reductions replay on resume. The checkpoint interval is evaluated at safe
boundaries, so a single long reduction can exceed it. SIGKILL cannot save work.

### Optional Hilbert closure

Ordinary exact completion is the default. `--hilbert-certificate FILE` replays
independent integer-dual lower-bound witnesses against the original relations.
Equality with the normal-word count can close a degree. `--assume-hilbert FILE`
explicitly accepts external dimension statements and labels outputs conditional.
Resuming an assisted job requires the same evidence document and explicit flag.
See the [mathematics, evidence format and persistence contract](docs/HILBERT_CLOSURE.md).

## BUILD OPTIMIZATION

`make check` verifies a 64-bit little-endian POSIX host, threads, lock-free
atomics, memory mapping, compiler and O3/LTO support. It saves the build
configuration locally. `make` then builds `dist/fomkyr` using instruction-set
tuning detected on that host and GCC profile-guided optimization when supported.
Clang uses O3/LTO with the detected instruction-set tuning. Run `make check`
again after moving the sources to another machine.

An unconfigured build uses portable **O3 and LTO**. Select GCC or Clang with
`make native CC=gcc NATIVE_PROFILE=lto` or
`make native CC=clang NATIVE_PROFILE=lto LDFLAGS="-flto -pthread -fuse-ld=lld"`.
For an executable tuned to the build machine:

```sh
make native NATIVE_ARCH=native
```

Tuned executables may require that machine's instruction set. Compiler and flag
changes trigger a rebuild. Separate builds can use `BUILD_DIR=dist/native-tuned`.
Compiler comparisons should use fresh jobs and identical arithmetic, workers,
memory, batch size and output settings. Native build products stay ignored.

`make native-pgo CC=gcc NATIVE_ARCH=native` explicitly builds with GCC, instruction-set tuning and profile-guided
optimization. Training uses bounded FK6, q-Serre and Weyl jobs; the result is
`dist/native-pgo/fomkyr`. Profiles are local to the compiler and build paths.
Measure the result on the intended workload before choosing it over O3/LTO.

The [FK6 native/browser comparison](../docs/benchmarks/fomkyr-0.6.6-native-browser.svg)
uses the same presentation, four workers, 4 GiB allowance and 128-pair batches.
It measures ordinary exact completion, checkpoints and complete text export.
The [measurement summary](../docs/benchmarks/fomkyr-0.6.6-native-browser.json)
records trial counts and the RAM measurement method.

## GEORGE BROWSER SETTINGS


Mathematical settings are in the presentation and **More settings**. Runtime
settings are in **Engine**. Each control has a **?** explanation. Inactive
controls retain their saved values, and Share links include explicit choices.

These are George's defaults for a new Fomkyr job:

| Setting | Default | Purpose |
| --- | --- | --- |
| Kernel allowance | 3584 MiB | Bounds kernel allocations; does not include all browser RAM. |
| Memory policy | Automatic | Derives workspaces from the effective allowance, including after an addressing fallback. Manual mode uses saved workspace sizes. |
| Reduction workspace | Automatic: 2048 MiB at this allowance | Shared scratch pool, divided among workers. Smaller allowances scale down. |
| Shared overflow reserve | Automatic: up to 512 MiB | Rescues exceptional rational rows within the kernel allowance. |
| Workers | Automatic, reported CPU threads minus one, within 1–32 | Compare explicit counts for the presentation; scaling depends on the workload. |
| Execution / addressing | Automatic | Shared multicore when available; memory64 for allowances above 4095 MiB. |
| Pairs per batch | 128; blank also means 128 | Batches reduce in parallel and commit in the original order; zero uses the single-pair scheduler. |
| Disk / checkpoint resume | On / on | Keep verified completed prefixes locally for later extension. |
| Heap / rational / large-coefficient reduction | On | Complementary exact reduction paths with bounded fallbacks. |
| Fast large-integer division | On | Also used by the general rational reducer. |
| Compiled local rewrites | On; word length 4, support 8 | Cache decreasing identities from the completed low-degree basis. |
| Radix queue / row promotion | On / on | Reduce queue overhead and preserve work during overflow growth. |
| Monomial / eager pruning | On / on | Discard terms proved zero; eager pruning requires monomial pruning. |
| Word matching / chain criterion | On / on | Both use the bounded word index. |
| Live activity updates | On, every 1 second | Show the active degree and counters; phases also trigger updates. |
| Exact Hilbert coefficients | Off | Optional exact counting of normal words after completion. |
| Time limit | 0: unlimited | Stop remains available. |

Automatic memory assigns 4/7 of the effective allowance to scratch and 1/7 to
the rational overflow reserve, leaving 2/7 for other kernel allocations. At
3584 MiB this gives 2048 MiB scratch and 512 MiB reserve. Prime fields do not
allocate the rational reserve. Scratch and reserve controls retain their saved
values and become editable in manual mode.

Under workspace pressure, automatic mode reduces active workers at a batch
barrier and retries the uncommitted batch suffix. Completed commits and
checkpoints remain available. The log reports each adjustment. A large
checkpoint row can also trigger fewer workers during restore. The single-pair
scheduler can still replay the current degree after exhausting its workspace.

Rational heap and overflow controls are inactive over prime fields. Heap-specific
controls follow **Sparse heap reduction**. Local cache controls follow
**Compiled local rewrites**; rational local rewrites also need a rational
reducer. The word-index budget remains available while word matching or the
chain criterion is enabled. Disk resume and the shared disk-record cache need
disk storage. Single-worker execution fixes the actual worker count to one.

**Quadratic pre-rewriting** applies known quadratic binomials before insertion.
**Compiled local rewrites** store more general low-degree identities. The
per-worker reducer cache stores disk records; the word cache stores exact
divisor lookups. These controls address different work.

## OUTPUT

The native CLI prints JSON with completion status, degree, rule count, elapsed
seconds, memory and worker information. Durable files include `basis.gnb`,
completed-degree checkpoints and partial frontiers. `--export` writes `result.gb`;
`--hilbert` writes exact decimal coefficients in `hilbert.json`.

George shows a compact basis preview grouped by degree and term count. **Files**
can download the full saved text basis and package text outputs in a ZIP on demand.
Optional Hilbert coefficients appear in **Series** and CSV/JSON downloads.

Ordinary basis records remain ABI 3; partial frontiers require 0.6.5 or later.
Assisted metadata uses ABI 4 and requires 0.6.6 and the same evidence on resume.
Avoid opening assisted or newer partial jobs with older engines. Native and Wasm
can exchange compatible record/checkpoint files; the browser UI currently keeps
its jobs in local browser storage.

## LIMITS

Native execution is bounded by its selected allowance and host resources. This
release requires a little-endian host; GCC and Clang builds are checked on Linux.
Other native platforms have limited validation.

George's Wasm integration allows **14304 MiB** of kernel workspace. Explicit
32-bit addressing allows **4095 MiB**. A memory64 initialization failure can fall
back to 32-bit with a lower allowance, reported in the log. Shared multicore
requires browser isolation; automatic execution has a single-worker fallback.
Denied persistent storage can fall back to bounded RAM.

The live memory icon shows Wasm linear-memory capacity, including reserved
workspace. Browser objects, I/O buffers and disk files have separate sizes.
Weighted generators, nonhomogeneous input, other orders, resolutions and module
computations require a compatible George engine.

## FILES

| Path | Contents |
| --- | --- |
| `src/` | Shared C kernel and reduction components. |
| `native/` | Standalone POSIX CLI, pthread coordinator, input and storage code. |
| `Makefile`, `man/fomkyr.1` | Native build/install rules and command manual. |
| `tools/`, `tests/` | Build tools, independent checkers and regression tests. |
| `fixtures/` | Reproducible presentations and optional evidence documents. |
| `fixtures/compatibility/` | Compressed historical record fixtures and minimal metadata. |
| `reference/` | Retained exact reference data. |
| `web/` | Optional Wasm API and integration fixtures. |
| `dist/` | Wasm snapshots; generated native executables and objects are ignored. |
| `SOURCE.json` | Import digest, retained file hashes and documented adaptations. |
| `../web/engine/fomkyr/` | George's production adapter and Wasm modules. |

## BUILD AND CHECKS

From the George root, `npm run wasm:build:fomkyr` rebuilds the production Wasm
modules with Clang **O3/LTO**. `npm run test:fomkyr:browser` checks Chromium and
Firefox integration, storage, resume, Share and cancellation.
`npm run test:fk6:prefixes` checks FK6 prefixes against saved independent references.

Native CLI, partial-resume and Hilbert authority checks are in `tests/`.
The developer release guide describes bounded validation and reuse of unchanged
oracle evidence. Generated reports and machine measurements stay local.

## LICENSE

Fomkyr is distributed under the [MIT license](LICENSE). George and its other
components retain their own licenses.

## SEE ALSO

[fomkyr(1)](man/fomkyr.1), [George](../README.md),
[backend integration](../docs/development/BACKENDS.md),
[developer release procedure](../docs/development/RELEASING.md).
