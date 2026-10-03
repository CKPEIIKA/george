# Validation and reproduction

The compact [validation summary](validation-summary.json) records mathematical
coverage, source identities, and pass counts from the previous core release.
Raw logs, resource traces, screenshots, generated oracle scripts and machine
information are local build artifacts. Regression inputs and reference bases
remain in `test/fixtures/`; imported mathematical tests remain beside the core.

## Commands

```sh
npm test
npm run test:fomkyr
npm run test:fomkyr:browser
npm run test:fomkyr:upgrade
npm run test:static
npm run test:fk6
npm run test:fk6:finite
npm run test:fk6:prefixes
node tools/validate-correction-release.mjs
```

`test:fomkyr` checks imported native and Wasm suites and a stratified test matrix
against Bergman and independent Singular calculations. The retained matrix has
95 cases, 380 Wasm variants and 105376 checked critical ambiguities. Kernel
correctness is checked by exact two-way ideal reduction, leading-word comparison,
and bounded critical-pair certificates. Equality of unreduced text is insufficient.

Growing FK6 cases use the 15-generator fixture and a scaled presentation, with
independent Singular checks at matching degree bounds. Finite random FK6-like
cases stop once the next graded component is zero. Each independent oracle job
has a two-minute limit; a timeout is reported as censored, never a successful check.
The prefix suite compares degrees 1–9 with retained exact reference bases and
independently counted Hilbert coefficients.

Browser tests cover Chromium and Firefox, isolated and ordinary static hosts,
root and project paths, workers, storage fallback, resume, Share, cancellation,
mathematical layout and copying. The correction-release test forces a tiny
preview to check full counts, every degree, incremental display, and seconds.

Bergman checks include 37 original legacy outputs, native SBCL comparison,
Singular, OCaml and adapted upstream algebra fixtures. See
[upstream tests](UPSTREAM-TESTS.md), [reader fixes](READER-FIX.md), and
[braid fixes](BRAID-FIX.md) for reproducers and certificate scope.

Validation runners write to `build/validation/` or `local/validation/`, both
ignored by Git. Use `tools/export-validation-summary.mjs` to export selected
mathematical results; inspect the compact summary before committing it.
