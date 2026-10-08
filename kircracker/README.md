```
KIRCRACKER(1)                 Kircracker 0.3.0                 KIRCRACKER(1)
```

## NAME

**kircracker** — native computation and verification of FK6 graded dimensions.

## BUILD

Build requirements: a C++17 compiler, Make, Python 3, Boost headers and GMP
development headers and libraries. On Debian or Ubuntu:

```sh
sudo apt-get install build-essential python3 libboost-dev libgmp-dev
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
supports research calculations through degree 22. Degrees 21–22 use an exact
signed 128-bit verifier; the derivative-entry bound is \(22!<2^{71}\).
Degrees through 20 retain the signed 64-bit path. Higher degrees are refused.

Version 0.3.0 streams candidate rows to disk, retains selected minor indices
instead of a dense discovery matrix, and allows up to 50,000 rows per block
subject to memory admission. `--dual-mode auto` tries prepend extensions first,
then both-sided candidates if a verified gap remains. See
[PERFORMANCE.md](docs/PERFORMANCE.md) for storage, scheduling and remaining limits.
Support through degree 22 does not guarantee exact closure: unresolved intervals
remain `BOUNDS_ONLY`.

A closed profile has status `EXACT_IN_PROJECT_PROOF_CHAIN`. The proof chain
includes inherited computational evidence and written operator, Hopf and coideal
arguments described in [INHERITED_PROOF.md](docs/INHERITED_PROOF.md). Those
arguments have not received external specialist review or proof-assistant
formalization. `BOUNDS_ONLY` preserves unresolved lower and upper intervals.
The program does not produce the full original-order Gröbner basis.

The included proof archive retains the degree-14 representation witness,
certificate bindings, replay sources and their mathematical dependencies.
[CONTENTS.json](proof/CONTENTS.json) records its inputs and original archive
digest. Historical run directories and producer binaries are excluded.

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
an interrupted active degree or block restarts. Keep the complete workspace.

Only one writer may own a workspace. `status` can read it concurrently.
Inputs, fields and checkpoint chains are validated on resume.

## COMMANDS

```sh
./kircracker --help
./kircracker plan 22 -j auto -m auto -C fk6-work
./kircracker upper 22 --namespace both -j auto -m auto -C fk6-work
./kircracker search 22 --dual-mode auto -j auto -m auto -C fk6-work
./kircracker check --quick
```

`--upper-seconds` and `--block-seconds` limit individual stages; zero imposes no
stage timeout. For an overall limit use the POSIX `timeout` utility.

Exit codes: 0 operation completed; 2 unresolved bounds; 3 incomplete or resource
limited; 4 invalid input, evidence or operational error; 130 interrupted.
An `upper` or `search` operation can finish while exact closure remains unresolved.

## INSTALL

```sh
make install PREFIX="$HOME/.local"
```

The installer creates a versioned directory and launcher, and refuses to
overwrite an existing installation. It does not change shell startup files.

## LICENSE

[MIT](LICENSE). GMP remains a separately installed dependency.
