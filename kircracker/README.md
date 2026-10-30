```
KIRCRACKER(1)                 Kircracker 0.3.0                 KIRCRACKER(1)
```

## NAME

**kircracker** — native computation and verification of FK6 graded dimensions.

## BUILD

Build requirements: a C++20 compiler, Make, Python 3 and GMP
development headers and libraries. On Debian or Ubuntu:

```sh
sudo apt-get install build-essential python3 libgmp-dev libzstd-dev pkg-config
cd kircracker
make check
make native
./kircracker doctor
```

`make native` uses O3, LTO and instruction selection for the build machine.
Use `make` for a portable build. Rebuild a native executable on each target
machine. The repository contains source and required proof inputs; executables
and generated workspaces are local build products.

## SYNOPSIS

```sh
./kircracker run 21 -j auto -m auto -C fk6-work > degree21.json
./kircracker run 22 -j auto -m auto -C fk6-work > degree22.json
./kircracker status -C fk6-work --watch
./kircracker verify 22 -j auto -m auto -C fk6-work > verified22.json
./kircracker export 22 -j auto -m auto -C fk6-work -o profile22.json
```

`-j` sets the worker ceiling; automatic selection accounts for CPU affinity and
quotas. `-m` sets the budget of the active stage, shared by admitted workers.
For an explicit allowance use, for example, `-j 6 -m 24GiB`.

Standard output contains the final JSON result. Progress and errors go to
standard error; `--json-events` selects newline-delimited JSON progress.

## DESCRIPTION

Kircracker computes original-FK and Nichols upper bounds, checks exact derivative
minors independently, and assembles permutation-graded dimension bounds. It
supports research calculations through degree 24. Degrees 21–24 use an exact
signed 128-bit verifier; the derivative-entry bound is \(24!<2^{80}\).
Degrees through 20 retain the signed 64-bit path. Higher degrees are refused. Degree support does not imply exact closure.

The native engine streams candidate rows to disk, retains selected minor indices
instead of a dense discovery matrix, and allows up to 250,000 rows per block
subject to memory admission. Through degree 22, `--dual-mode auto` tries prepend
extensions, then both-sided candidates if a verified gap remains. Above degree 22
it records the missing [residual certificate inputs](docs/RESIDUAL_CERTIFICATES.md)
instead of expanding another sample family. See
[PERFORMANCE.md](docs/PERFORMANCE.md) for storage, scheduling and remaining limits.
Support through degree 24 does not guarantee exact closure: unresolved intervals
remain `BOUNDS_ONLY`.

Independent low-degree Nichols oracles, sector stabilizer projectors and an
explicit relative quotient rank comparison are available. See
[relative quotient checks](docs/RELATIVE_QUOTIENT_CHECK.md) for commands,
certificate formats and resource limits.

A closed profile has status `EXACT_IN_PROJECT_PROOF_CHAIN`. The proof chain
includes inherited computational evidence and written operator, Hopf and coideal
arguments described in [INHERITED_PROOF.md](docs/INHERITED_PROOF.md). Those
arguments have not received external specialist review or proof-assistant
formalization. `BOUNDS_ONLY` preserves unresolved lower and upper intervals.
The program does not produce the full original-order Gröbner basis.

The proof archive `proof/frontier-0.5.0.zip` retains the degree-14 representation
witness, certificate bindings, replay sources and their mathematical dependencies.
It is not stored in git: download it from the George release assets and place it
in `proof/`, or set `KIRCRACKER_PROOF_ARCHIVE` to its path. Its sha256 and inputs
are recorded in [CONTENTS.json](proof/CONTENTS.json). On first use Kircracker
extracts `data/base-through13.json` and `data/degree14-radical.json` from it and
rebuilds `data/star14-leading-words.json` with `tools/derive_star14_index.py`;
each file is checked against the sha256 in [SOURCE.json](SOURCE.json).
Historical run directories and producer binaries are excluded.

Kircracker is a standalone subproject in this repository. It has no browser
backend or George engine-selector entry. An exported dimension profile can be
reviewed separately for use by Fomkyr's existing FK Gate.

## NICHOLS AND STRUCTURAL TOOLS

```sh
./kircracker nichols run 21 -j auto -m auto -C nichols-work
./kircracker nichols export 21 -C nichols-work -o nichols21.json
./kircracker proof --help
./kircracker support-formula
./kircracker support 5 --degree 8
```

The Nichols namespace computes bounds for B6 separately, using a Nichols upper
model and independently checked pairing minors. It adds no Q shift. See
[NICHOLS_B6.md](docs/NICHOLS_B6.md), [PROOFKIT.md](docs/PROOFKIT.md) and
[SUPPORT_HOMOLOGY.md](docs/SUPPORT_HOMOLOGY.md). Structural summaries state
whether their underlying matrices are retained and independently replayable.

## INTERRUPT AND RESUME

Ctrl-C or TERM preserves committed work. Rerun the same operation with the same
`-C` directory. Completed upper degrees and verified lower blocks are retained;
an interrupted upper degree restarts. Pairing discovery resumes its last published
pivot journal (journals are bound to the pairing library, so after a rebuild
migrate them with `tools/import_pair_state.py`); pending candidates retain their separate audit stage. Keep the
complete workspace, including journal chunks. See [native engine details](docs/ENGINE_23_24.md).

Only one writer may own a workspace. `status` can read it concurrently.
Inputs, fields and checkpoint chains are validated on resume.

## DASHBOARD

```sh
python3 tools/dashboard.py --run /path/to/pairing-run
```

The colored terminal view refreshes every second and shows recent rank gains,
scanning, independent audits, CPU, memory and bounds. Use `--pipeline` for a
continuation pipeline, `--once` for a snapshot, or `--color never` for plain text.
Ctrl-C closes the dashboard; the calculation continues.

## COMMANDS

```sh
./kircracker --help
./kircracker plan 22 -j auto -m auto -C fk6-work
./kircracker upper 22 --namespace both -j auto -m auto -C fk6-work
./kircracker search 22 --dual-mode auto -j auto -m auto -C fk6-work
./kircracker check --quick
```

`--upper-seconds` and `--block-seconds` limit individual stages; zero imposes no
stage timeout. A discovery block that reaches its limit keeps its verified minor
and journal but is reported incomplete; rerun to resume it. For an overall limit
use the POSIX `timeout` utility.

Exit codes: 0 operation completed; 2 unresolved bounds; 3 incomplete or resource
limited; 4 invalid input, evidence or operational error; 130 interrupted.
An `upper` or `search` operation can finish while exact closure remains unresolved.

## INSTALL

```sh
make install PREFIX="$HOME/.local"
```

The installer creates a versioned directory and launcher, and refuses to
overwrite an existing installation. It does not change shell startup files.

Optional queue deployment: [HyperQueue workflow adapter](docs/HYPERQUEUE.md).

## LICENSE

[MIT](LICENSE). GMP remains a separately installed dependency.
