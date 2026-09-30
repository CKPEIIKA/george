# Structural Anick resolution export

Default algebra Anick form jobs include `resolution.jsonl`. Legacy sessions
retain their original output. `result.anick` remains the original Bergman
text in both modes; its compact chain names can be ambiguous.

The opt-in `(GEORGEWRITERESOLUTION "filename")` command is implemented in
`ports/common/george-overlay.sl`. It walks `anCHAINS`, chain vertices and
semi-distributed tensor polynomials through Bergman's access macros. It
does not reconstruct chains from printed text or alter the printer.
Uncalculated differentials cause an error instead of being exported as zero.

## Format, version 1

Each line is a complete JSON object. The first line identifies the format,
coefficient field and generator order actually used by Bergman:

```json
{"format":"george-resolution","version":1,"modulus":0,"generators":["a","aa"]}
```

Subsequent lines contain one differential per chain:

```json
{"degree":0,"chain":[1],"terms":[{"target":[],"coefficient":["1","1"],"word":[1]}]}
{"degree":0,"chain":[2],"terms":[{"target":[],"coefficient":["1","1"],"word":[2]}]}
{"degree":1,"chain":[1,1],"terms":[{"target":[1],"coefficient":["1","1"],"word":[1]},{"target":[1],"coefficient":["-1","1"],"word":[]}]}
```

- `degree` is Bergman's chain length: degree 0 is a generator of C₁.
- Words are ordered arrays of **1-based generator indices**; `[]` is 1.
- Each term is `coefficient × target ⊗ word` in a right-module differential.
- `coefficient` is `[numerator, denominator]`, both exact integer **strings**.
  Modulus 0 means Q; a positive prime means its finite field.
- An empty `terms` array is a calculated zero differential.
- Each chain occurs once. Chain identity uses degree and the complete token
  array: `a*a` is `[1,1]`, while `aa` is `[2]`.

The reader checks the version, generators, field, indices, coefficients,
duplicate chains, missing levels and missing target chains. Reversed generator
order is resolved through the header; weights follow names in the form.
The browser separates whole generator tokens with multiplication dots, so
`a*a` and the single generator `aa` are visually distinct.
The homology calculation augments nonempty algebra words to zero after any
monoid shift, uses exact ranks and checks augmented d². The test checker
independently reduces full d² over the presented algebra before augmentation.

For monoid augmentation, the exported indices refer to the shifted generators
u in x = u + 1; the names label those shifted generators, as in the original
resolution file. `homology.json` records `shifted: true`.

The format currently covers ordinary algebra Anick form jobs. Module,
factor-algebra and Hochschild procedures retain their original output.
The historical text reader is retained for single-letter regression fixtures;
it rejects longer names instead of guessing their token boundaries.
