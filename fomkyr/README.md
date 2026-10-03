```
FOMKYR(1)                     Fomkyr Manual                     FOMKYR(1)
```

## NAME

**fomkyr** — exact Gröbner bases for homogeneous associative algebras.

## VERSION

Core **0.6.4**, MIT license. Fomkyr is a subproject of [George](../README.md).
George records the application and core versions separately. The engine chooser
currently marks Fomkyr experimental.

## SYNOPSIS

From the George repository root:

```
npm ci
npm run serve:fomkyr           # http://127.0.0.1:8000/
npm run wasm:build:fomkyr      # rebuild and install the browser kernels
```

Select **fomkyr / C O3 + LTO** under **Engine**. Enter generators and relations,
choose the coefficient field and maximal degree, then press **Compute**.

## DESCRIPTION

Fomkyr completes homogeneous noncommutative presentations over the rationals
or a prime field using ordinary degree followed by left lexicographic word
order. It accepts 1–16 generators with unit generator degrees and integer input
coefficients of absolute value at most 2^62−1. Rational arithmetic is exact,
including arbitrary-precision coefficients during reduction.

The C kernel uses sparse reduction, exact rewrite caches, critical-pair
criteria and bounded workspaces. Four Wasm modules provide 32-bit and 64-bit
addressing with shared multicore and unshared single-worker execution.
Browser storage holds basis records and completed-degree checkpoints.

The **Maximal degree** bounds completion by degree. Blank requests completion
without a chosen bound; memory, the time limit and **Stop** still apply.
A finite prefix certifies completion through its reported degree. It does not
certify unrestricted completion. Earlier polynomial tails are not globally
interreduced.

## OPTIONS

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

George displays a basis preview grouped by degree and expression size, the
calculation log and runtime information. Full text is available for download;
the Results ZIP button packages text outputs on demand. Saved checkpoints use
the binary `basis.gnb` format. They include verified degree and presentation
identity metadata and support resume across compatible execution modes.

Optional exact Hilbert counting produces decimal integer coefficients and
CSV/JSON output. Blank **Series degree** uses the computed basis bound. A longer
prefix requires a proved complete basis. An optional counting failure preserves
the computed basis.

## LIMITS

The maximum kernel allowance is **14304 MiB**. Explicit 32-bit addressing uses
at most **4095 MiB**. A memory64 initialization failure can fall back to 32-bit
addressing with a lower effective allowance, reported in the log.
Workspaces, indices and caches count against the kernel allowance.
The memory icon reports allocated Wasm memory, including reserved workspaces.
Browser objects, I/O buffers and disk checkpoints have separate sizes.

Shared multicore requires browser isolation. Automatic execution has a
single-worker fallback. If persistent storage is denied, automatic storage
can fall back to bounded RAM. Worker counts and fallbacks are reported in the
result. Faster reduction does not guarantee a manageable high-degree basis.

Weighted generators, nonhomogeneous input, other word orders, resolutions and
module computations require a compatible George engine.

## FILES

| Path | Contents |
| --- | --- |
| `src/` | C kernel and reduction components. |
| `tools/` | Build scripts, native references and certificate utilities. |
| `tests/` | Kernel, arithmetic, browser, checkpoint and mathematical checks. |
| `fixtures/` | Reproducible presentations and published examples. |
| `fixtures/compatibility/` | Compressed historical record streams with verified hashes and minimal checkpoint metadata. |
| `reference/` | Retained exact canonical reference data. |
| `web/` | Core browser API and standalone integration fixtures. |
| `dist/` | Kernel snapshots; generated native libraries are ignored. |
| `SOURCE.json` | Core version, original import digest, source hashes and documented adaptations. |
| `../web/engine/fomkyr/` | George's production browser adapter and deployed kernel modules. |
| `../web/src/fomkyr-options.js` | George's persisted controls and option conversion. |

The stable source home is **`fomkyr/`**. Future core updates belong here.
The build stages this directory under ignored `build/` and installs the new
Wasm kernels while retaining George's browser adapter.

## BUILD AND CHECKS

The kernel build uses Clang with Wasm32/Wasm64 targets and LLD, with `-O3`
and link-time optimization. Rebuild the production modules from the repository
root with `npm run wasm:build:fomkyr`.

Validation commands from the George root:

```
npm run test:fomkyr            # inherited tests and independent backend matrix
npm run test:fomkyr:exact      # exact arithmetic and workspace paths
npm run test:fk6:prefixes      # FK6 degree prefixes
npm run test:fomkyr:published  # published coefficient examples
npm run test:fomkyr:browser    # browser integration
```

These suites have different scopes and runtimes. The developer release guide
documents bounded checks and reuse of unchanged oracle results. Generated
reports, machine measurements and native build products stay ignored.

## LICENSE

Fomkyr is distributed under the [MIT license](LICENSE). George and its other
components retain their own licenses.

## SEE ALSO

[George user guide](../docs/USER-GUIDE.md),
[backend integration](../docs/development/BACKENDS.md),
[validation scope](../docs/development/VALIDATION.md),
[developer release procedure](../docs/development/RELEASING.md).
