# Idempotent braid resolution fix

The default-mode stall for `a^2-a, b^2-b, b*a*b-a*b*a` is resolved.
Changes live on `fix/anick-braid`; the published release is kept on
`gh-pages` until the user publishes the fix.

## Causes and changes

1. `MonNonCommify` selected the lexicographic shortcut for degreewise
   processing even in safe mode, where terms can have different degrees.
   A braid S-polynomial became the false reductor `aba-aba`. Normal-form
   subtraction then repeated forever. `behavior-patches.py` makes safe
   degreewise comparisons use the full configured monomial order. Its
   legacy branch is selected dynamically, including switches after setup.
2. After fixing that stall, a degree-eight resolution failed with
   `No prolongation found in anPROLONGCHAIN`. The tensor shortcut selected
   a chain with a constant coefficient ahead of a larger complete tensor
   word. Safe-mode tensor comparison now uses the chain followed by the
   coefficient's leading word. Multiplication sorts after normal-form
   reduction; addition merges by chain identity and sorts afterward.
   `anick-tensor.sl` supplies stable insertion sorting, avoiding the old
   restore routine's insertion one position after the intended predecessor.

Both changes affect default safe mode. The original routines remain in
legacy mode. Original vendored sources are unchanged; patches are applied
only to build copies. Native traces and failed prototypes are retained in
the ignored `build/braid-fix/` directory.

## Independent algebraic certificate

The quotient has normal-word dimensions `1, 2, 2, 1, 0`, hence dimension 6.
For augmentation `a,b -> 0`, use

`e = 1-a-b+ab+ba-aba`.

For augmentation `a,b -> 1`, use `e = aba`.

The independent exact checker verifies `e^2=e`, `epsilon(e)=1`, and
`e*x=x*e=epsilon(x)*e` for both generators. Thus the augmentation module
is the one-dimensional direct summand `eA` of the free module `A`, so it
is projective. Its higher Tor groups vanish over each tested field. This
checks the reported homology independently of Bergman's differential code.

## Weighted truncation

A degree limit can omit heavier incoming chains at a lower homological
degree even while higher homological degrees occur in the output. The
weighted braid case exposed such a partial H4 rank. It must not be shown
as a Betti number of the algebra.

For a complete basis, let `W` be the largest generator weight, `R` the
largest relation degree, and `t = max(0,R-min(generator weights))`.
Every C_(n+1) chain has degree at most `W+n*t`. Homology is reported only
where that bound fits the computation limit, or where the finite tail is
certified complete. `homology.json` retains unreported partial dimensions
under `truncatedBetti`; the EN/RU interface explains how to increase the limit.
This is a conservative certificate, so some available ranks remain unreported.

## Verification

Run `npm run test:braid` after building the native reference and Wasm engine.
The twenty cases cover Q, F2, F3, F5 and F101; direct degreewise execution,
the production two-stage path, overlapping names, monoid augmentation,
unequal weights and reversed generators. Native and Wasm basis, raw Anick
output and structural export agree exactly. They pass 860 full d² identities,
220 basis ambiguities, projectivity checks and a legacy-mode switching probe.
Chromium additionally computes the braid at `/` and `/george/` and verifies
the weighted cutoff notice. See [braid.json](validation/braid.json) and
[the diagnostic history](validation/resolution-limits.json).

The original 37-output suites in both modes, all 24 OCaml aliases, all 51
algebra/oracle cases, twenty longer-name cases, extra sessions and form
presets are rerun for the new engine. Their current evidence is linked from
[summary.json](validation/summary.json).
