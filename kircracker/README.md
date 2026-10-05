```
KIRCRACKER(1)                 Kircracker 0.1.0                 KIRCRACKER(1)
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
./kircracker run 20 -j auto -m auto -C fk6-work > degree20.json
./kircracker status -C fk6-work --watch
./kircracker verify 20 -j auto -m auto -C fk6-work > verified20.json
./kircracker export 20 -j auto -m auto -C fk6-work -o profile20.json
```

`-j` sets the worker ceiling; automatic selection accounts for CPU affinity and
quotas. `-m` sets the budget of the active stage, shared by admitted workers.
For an explicit allowance use, for example, `-j 6 -m 24GiB`.

Standard output contains the final JSON result. Progress and errors go to
standard error; `--json-events` selects newline-delimited JSON progress.

## DESCRIPTION

Kircracker computes original-FK and Nichols upper bounds, checks exact derivative
minors independently, and assembles permutation-graded dimension bounds. It
supports research calculations through degree 20. Its signed 64-bit verification
bound requires another arithmetic implementation for higher degrees.

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

## INTERRUPT AND RESUME

Ctrl-C or TERM preserves committed work. Rerun the same operation with the same
`-C` directory. Completed upper degrees and verified lower blocks are retained;
an interrupted active degree or block restarts. Keep the complete workspace.

Only one writer may own a workspace. `status` can read it concurrently.
Inputs, fields and checkpoint chains are validated on resume.

## COMMANDS

```sh
./kircracker --help
./kircracker plan 20 -j auto -m auto -C fk6-work
./kircracker upper 20 --namespace both -j auto -m auto -C fk6-work
./kircracker search 20 --dual-mode both -j auto -m auto -C fk6-work
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
