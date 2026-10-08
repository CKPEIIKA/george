# Kircracker Proofkit 0.1.0

A native/Unix **structural-data extension**, not another Hilbert-series forecaster.
It reads a frozen fomkyr ABI-3 `basis.gnb`, the exact input and its declared completed
degree. It exports explicit Q, direct normal-form/coproduct data, multiplication
subspaces, actual star relations, the actual quotient by Q, producer genealogy and
Anick chain counts. Large unfinished calculations are never relabelled exact results.

**No complete ambient degree-17 basis was available during development.** The new
high-degree jobs are implemented for your machine, but their degree-17 outputs are
not supplied. The referenced `FK6_hilbert_groebner_hypothesis…` PDF was not recovered;
no claims from that unspecified PDF are used as oracle data.

## Build and attach to kircracker

Linux x86-64 binary included (dynamically linked to GMP); rebuild on your machine:

```bash
sudo apt-get install g++ make python3 libgmp-dev
make native
bash tools/test.sh
```

Use the standalone `./kircracker-proof`, or add `kircracker proof` to the existing
Kircracker CLI 0.1 layout:

```bash
python3 tools/install_cli.py /path/to/kircracker-cli-0.1.0
python3 tools/install_cli.py /path/to/kircracker-cli-0.1.0 --apply
/path/to/kircracker-cli-0.1.0/kircracker proof --help
```

The installer makes a backup and copies this extension only. It does not replace
the old dimension kernels, their certificates or work directories. Unknown entrypoint
layouts are rejected. The standalone executable always remains available.

## 1. Bind your actual ambient basis

Copy/freeze the producer checkpoint; do not point a running oracle at a file being
truncated or rewritten by another process. The input JSON must preserve the actual
generator order, directed-edge signs, field Q and degree-left-lex order.

```bash
./kircracker-proof init -C fk6-proof-data \
  --basis /path/to/completed-degree17/basis.gnb \
  --fixture data/fk6-george.json --through 17
```

For a different signed/order convention, supply `--edges directed-edges.json`, a
list `[[i,j],...]` in the input variable order, with x_ji=-x_ij. Every one of the
100 defining relations is checked under that map. The default is the exact signed
map used in the earlier Q query, not another equally valid labelling of K6.

`--through 17` is a caller declaration, **not proof** that the file is the true FK6
GB through 17. Attach the producer's independently verified original-ideal provenance
and completion evidence. `verify-basis` checks input inclusion and critical confluence,
but does NOT alone prove reverse original-ideal inclusion. See docs/CORRECTNESS.md.

## 2. Export Q and check the requested identities

```bash
./kircracker-proof q -C fk6-proof-data --seconds 7200
./kircracker-proof commutators -C fk6-proof-data -j 4 --seconds 7200
./kircracker-proof coproduct -C fk6-proof-data -j 4 --seconds 7200
```

Outputs include `Q14.poly` (ambient NF, only canonical within the declared complete
frontier), `Q14.raw.json`, all 15 commutator residuals, and all 13 reduced coproduct
slices as exact JSONL tensor coefficients. Proper splits reduce both tensor factors.
Nothing is marked primitive merely because an earlier dimension argument claimed it.

Completed commutator/slice jobs are reused only with the same complete input/Q binding;
`--force` recomputes them. A zero result is an actual reduction with supplied rules,
conditional on their original-ideal provenance. A nonzero result from an incomplete
basis is labelled inconclusive. `status -C fk6-proof-data` lists existing products.

## 3. Build an actual star system, not five square-zero generators

Two routes are available.

**Reference oracle extraction**, suitable for small degrees: enumerates candidate
star words avoiding already discovered relations, maps them into the full ambient
NF coordinates, and finds exact dependencies. It checks the whole degree before
publishing completion.

```bash
./kircracker-proof star -C fk6-proof-data --degree 8 \
  --max-candidates 100000 --seconds 3600
```

**High-degree route**: authenticate the saved inherited identity library, let native
fomkyr generate a candidate, then accept it using the actual ambient oracle.

```bash
./kircracker-proof star-seed -C fk6-proof-data --degree 17
./kircracker-proof produce -C fk6-proof-data --degree 17 -j 6 --seconds 7200 \
  --producer-memory 24G \
  --command '/path/to/fomkyr -i {input} -d {degree} -j {jobs} --memory {memory} --workdir {out} --time-limit {seconds}'

# Select the actual basis.gnb emitted by that producer job, not a preview.
./kircracker-proof star-accept -C fk6-proof-data --degree 17 \
  --basis /path/to/that/producer/basis.gnb --seconds 7200
```

The 929-node seed is authenticated from original quadratics but is **not assumed a
complete star presentation**. Acceptance reduces every candidate relation inside the
ambient algebra and matches the normal-word count against
`H_star = H_ambient / H_FK5`. This is an exact dimension sandwich relative to a faithful
ambient oracle; no conjectural high-degree scalar or Nichols equality is used.
A gap returns INCOMPLETE. Only the low-degree exhaustive extractor automatically
discovers missing relations; the high-degree producer does not promise to find identities
absent from its input library. You can add more proved seeds and repeat.

The output is `star/basis.gnb`, monic `relations.jsonl`, degree/term/leading-word metadata,
and descriptive orbit representatives. No millions-of-normal-words export is required.
Per-degree reference checkpoints are marked noninterreduced; final reduced rows are separate.

## 4. Build and verify S/(Q)

```bash
./kircracker-proof quotient-seed -C fk6-proof-data --degree 17
./kircracker-proof produce -C fk6-proof-data --quotient --degree 17 -j 6 --seconds 7200 \
  --producer-memory 24G \
  --command '/path/to/fomkyr -i {input} -d {degree} -j {jobs} --memory {memory} --workdir {out} --time-limit {seconds}'
./kircracker-proof quotient-accept -C fk6-proof-data --degree 17 \
  --basis /path/to/quotient/producer/basis.gnb --seconds 7200
```

The verifier explicitly spans `(Q)_d` in the actual star coordinates using **all**
normal-word contexts uQv. At degrees 14,15,16,17 there are only 1,10,65,340 proposed
context columns when the low star dimensions are 1,5,20,70. It checks their exact
ranks, both ideal containments and the quotient normal-word counts.

No assumption that Q is central, regular, or generates the whole Nichols kernel is
needed for this acceptance test. `star_mod_Q/Q-ideal-degree*.json` contains actual
ideal basis polynomials and all context-coordinate columns. The candidate is not
accepted on a Hilbert number alone. `quotient` is an alternative bounded independent
Python completion for small controls, with full reduction-provenance replay.

## 5. Explicit Q-image, kernels and characters

```bash
./kircracker-proof kernels -C fk6-proof-data --degree 14 15 16 17 \
  --mode image-Q --characters --seconds 7200
```

This writes every exact column of `E_(d-14) -> E_d`, its sparse row rank, an explicit
image basis, and optional adjacent-S6-generator matrices. If Q is checked invariant,
the matrices are compared entry-by-entry with the source representation. Source
characters and rational irreducible multiplicities are computed from exact traces,
not copied from the dimension formula. Columns survive interruption; `--fresh` replays
all products rather than trusting locally cached outputs.

**These are Q-image subspaces, not automatically complete K_d.** For a genuinely small
ambient space, the fully explicit Nichols pairing kernel is available:

```bash
./kircracker-proof kernels -C small-proof-data --degree 3 4 \
  --mode full-pairing --max-words 100000
./kircracker-proof compare-kernel --left explicit-kernel.json \
  --right explicit-Q-image.json --out subspace-comparison.json
```

Full mode computes all scalar iterated derivative pairings on the entire normal-word
basis and the exact nullspace. It refuses a billions-column FK6 degree before
allocating it. A high-degree proof that the image is the *whole* Nichols kernel needs
that independent kernel calculation or an independently replayed kernel bound plus
membership. This package does NOT silently substitute dimension coincidence for that
missing evidence. `compare-kernel` compares the actual supplied spans in both directions
and exports the coordinate maps; it cannot authenticate the origin of either span.

## 6. Genealogy and Anick chains

For new producer runs, install or port the native hook:

```bash
python3 tools/install_genealogy.py /path/to/recovered-fomkyr-0.6.5
python3 tools/install_genealogy.py /path/to/recovered-fomkyr-0.6.5 --apply
# Rebuild fomkyr. For newer branches, use docs/FOMKYR_HANDOFF.md instead of forcing the patch.
```

`produce` sets `KIR_GENEALOGY` automatically. Standalone producer runs can set it
explicitly. The log records genuine input/overlap parents at the coordinator commit,
not stale lane-zero values. Saved prefixes without historical logs are marked restored
or unavailable. No code can recover an actual lost computation history from a basis alone.

```bash
./kircracker-proof genealogy --basis star/basis.gnb --generators 5 \
  --log star/events.jsonl --degree-from 12 --degree 17 --out star/genealogy.json

./kircracker-proof orbits --basis star/basis.gnb --generators 5 \
  --degree 17 --polynomials --seconds 7200 --out star/polynomial_orbits.json

./kircracker-proof anick --basis star/basis.gnb --generators 5 \
  --degree 17 --seconds 7200 --out star/anick_chains.json
./kircracker-proof anick --basis star_mod_Q/basis.gnb --generators 5 \
  --degree 17 --seconds 7200 --out star_mod_Q/anick_chains.json
```

Full polynomial orbits are computed projectively under leaf-alphabet permutations,
with reorientation/monic normalization. They do **not** make a fixed-order GB invariant.
Leading-word patterns and joint parent/child motifs are descriptive groupings, not
an automatically valid S5-equivariant graph quotient. Alphabet renaming of 15 ambient
generators is not the vertex S6 action; full polynomial alphabet mode is restricted to
small alphabets and should be used on the actual star letters.

Anick indexing is homological: C0={1}, C1=generators, C2=obstructions. With that convention,
`chi_d = sum_p (-1)^p c_(p,d)` and `H*chi=1` are checked independently by a normal-word
avoidance automaton. Classical n-chain indexing is shifted by one. Counts are exact
integers and paths are counted by dynamic programming, not enumerated.

These are free-resolution ranks, **not Betti numbers**. Differentials or a minimal
resolution are not computed. The reciprocal identity applies to the actual algebra
only through an independently established GB frontier; leading-word input alone does
not authenticate that frontier. A finite prefix does not prove an all-degree product.

## Scope and budgets

Native GMP handles exact coefficients and arbitrary-length ABI-3 words. Python Fraction
is a separate oracle for controls and audits. No coefficient rounding or high-degree
Hilbert target is used. Runtime jobs have time/term/candidate caps, with exit 77 and an
INCOMPLETE record on exhaustion. A checked nonzero commutator/slice returns exit1,
an invalid input returns exit2; a limited batch is never a successful zero check. Native operations check time at safe points; this is
not a strict preemption-latency guarantee.

`--memory-mib` sets a **per-process address-space** guard, including the entire mapped
basis. It is not an aggregate resident-RAM cap and can reject a very large mmap even
when few pages would be resident. Start with 1–4 workers; each worker has its own GMP
row cache, while immutable file pages may be shared by the OS. Whole-basis dumps or huge
individual polynomial rows can exceed 32 GiB. The high-degree producer remains responsible
for its own memory/resume policy. No universal 32-GiB completion guarantee is made.

The native .so is an audit/normal-form oracle, not fomkyr's optimized completion core.
Performance on the available partial ambient basis exposed hard reductions; it is not
advertised as faster than fomkyr. No new browser implementation, native Singular/Bergman
run, or full current George source checkout was available in this turn.

Read docs/CORRECTNESS.md, docs/FOMKYR_HANDOFF.md and docs/REPORT.md. Supplied evidence
includes both successful controls and the genuinely incomplete high-degree probes.

## Supplied degree-14 chain data

The archive includes the complete leading-word list, chain graph and integer counts
for the previously supplied 28,727-row five-generator degree-14 presentation. The full
84 MB polynomial basis is not duplicated. The source's algebra/completion proof remains
a separate dependency, not an assertion made by counting its leading words.

```bash
python3 tools/replay_anick.py
python3 tools/replay_anick.py --quotient
```

For the second run, Q's nonzero normal form is added at degree exactly14. No new proper
overlap involving that new degree14 leading word can occur at or below14. Therefore
this gives the truncated quotient *of the supplied presentation*, assuming the parent's
GB claim. It does not prove anything about higher quotient degrees or Nichols equality.
The native NF query, appended row and independent count checks are retained. Reproduce
that extension with `tools/same_degree_quotient.py`; degree must equal deg(Q).
