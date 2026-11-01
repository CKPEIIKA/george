# Hilbert and associated-monomial Poincaré–Betti series

Fomkyr computes these series in its C kernel. George's **Compute → Hilbert and
Poincaré–Betti series** task calls that kernel through WebAssembly. No Kircracker
installation or Python runtime is needed.

For a homogeneous presentation with completed Gröbner basis G, let M be its
minimal leading-word antichain and let Amon = k⟨X⟩/(M). The output is

    P_Amon(z,t) = Σ β_p,d(Amon) z^p t^d.

The coefficients are the Anick chain counts of Amon. They are exact minimal
Betti numbers for the monomial algebra and coefficientwise upper bounds for
the original algebra's Betti numbers. Fomkyr does not compute the original
Anick differentials or their augmentation ranks. A nonmonomial algebra can
have cancellations that reduce its minimal Betti numbers.

## Run and export

```sh
./dist/fomkyr -i presentation.bg -d 12 --memory 1G --poincare --workdir series-job
```

`--poincare` implies `--hilbert`. The content-keyed job directory contains
`poincare.json`, `poincare.csv` and `result.pb`, in addition to the Hilbert output.
The browser task exposes the same files and displays the nonzero coefficients.
JSON and CSV store counts as decimal strings without a machine-integer limit.
The variables are z = homological degree, t = internal degree. The table includes
β_0,0 = 1, β_1,1 = the number of surviving generators, and β_2,d = the
number of minimal nonlinear leading obstructions of length d. Linear leading
relations eliminate generators before counting. Bergman's legacy `.pb` display
omits homological degrees zero and one; Fomkyr includes them.

The standalone JavaScript API accepts:

```js
const engine = new FomkyrEngine({
  poincare: true, poincareRequired: true,
  hilbert: true, hilbertRequired: true,
  poincareDegree: 12, poincareBudgetBytes: 256 * 1048576
});
```

Set the Gröbner completion bound to at least the series degree. Larger series
degrees are allowed only after global completion of a finite Gröbner basis has
been proved. Imported-dimension assumptions remain attached to the output;
counting does not independently certify those dimensions.

## Counter and guarantees

The counter builds an Aho–Corasick matcher, removes duplicate and redundant
leading words, and builds a graph of one-letter starts and proper obstruction
suffixes. A transition appends a suffix that completes exactly one obstruction
at the end. Paths encode Anick chains; dynamic programming counts them by
homological and internal degree. It enumerates neither all words nor all chains.
Counts use exact multi-limb integers in every supported characteristic.

The browser checks the Euler identity

    H(t) Σ_p,d (-1)^p β_p,d t^d = 1

through the shared computed range, using the independent Hilbert automaton.
This is a consistency check, not a minimality test for the original algebra.

Workspace and output have byte budgets. Exhaustion or cancellation returns an
error, never a fabricated zero. The completed Gröbner checkpoint is retained.
The count graph and temporary arrays are released after export, leaving the
basis unchanged. Partial Gröbner completion certifies only the reported range.

## Validation

`tests/test_poincare.py` compares the C result with an independent small normalized
bar-complex homology calculation, long-word formulas, and counts exceeding 2^64.
The repository's `tools/validate-fomkyr-poincare.mjs` checks four Wasm variants,
native and Wasm CLI output, the George dispatcher, verified modular lifting,
and Bergman's monomial-series computation where it completes. Linear elimination
uses the independent bar test and the truncated-polynomial formula instead of
Bergman's stalled series continuation.

Public C entry points are declared in `src/kernel.h`: `gn_poincare`,
`gn_poincare_limbs`, `gn_poincare_limb`, `gn_poincare_stat`, and
`gn_poincare_release`. Call only at a completed-degree barrier. The counter
does not change record or checkpoint formats.
