# Optional FK6 dimension profile

Fomkyr 0.7.0 can use imported dimensions over Q through degree 17 for the
original FK6 presentation and generator order. Enable `--fk-gate` in the native
CLI, or **Accept imported FK6 dimension profile** in George’s mathematical settings.
The option is off in general settings and enabled by the dedicated FK6 preset.
Other presentations and fields use ordinary reduction.

The runtime counts irreducible words in each product-permutation component.
Equality with its imported dimension allows redundant reductions in that component
to be skipped. Whole-degree closure also requires a fresh total count.
`--fk-total-only` enables only whole-degree closure; `--fk-gate-memory 128M`
sets temporary counting workspace within the overall memory allowance.

Results, exports and ABI-5 checkpoint metadata record
`conditionalOnImportedFkDimensions: true` and `fkGateProofReplayedHere: false`.
The external proof package is not bundled or replayed here; external specialist
review is pending. Bounded independent tests check actual reductions and completion.
These checks do not certify the high-degree imported dimensions.
Completed jobs can export a [verification bundle](../fk_gate/docs/PROOF_OF_COMPUTATION.md)
that binds the exact input, basis, checkpoint and authority files. Its independent
Python checker verifies the resulting bounded basis without relying on imported
dimensions; a successful checker report is separate from the solver's completion.

The table headers and public provenance have a byte-bound profile identity.
Private artifact names are omitted; artifact digests and the original provenance
checksum are retained. The current upstream authority identity and both prior 0.3.0 identities remain
accepted on resume. All prior dimensions through degree 16 are unchanged; the
0.3.1 profile adds degree 17 with total dimension 4,735,557,180. Matching profile opt-in is required
before a dependent job can be resumed. Existing external Hilbert dependencies
also remain required. Basis records stay ABI 3. Keep a copy before any downgrade.

```sh
./dist/fomkyr --resume fk6-job -d 14 -j 4 --memory auto \
  --fk-gate --export --human
```
