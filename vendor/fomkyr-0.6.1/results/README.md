# Result provenance

The 0.6.0 release evidence is indexed by `0.6/release-validation.json`.
The existing suite also writes current bounded test outputs in this directory root.
`0.6/benchmarks/` contains the final paired 0.5/0.6 timings and serialized bases.
`0.6/exploratory/` is exploratory, not the reported matched benchmark.
`0.5/`, `speed/`, `v0.2.0/` and `../reference/` retain earlier-release evidence.
The rational and modular compatibility tests historically write into `0.5`;
`verify_direct.sh` copies the current results into `0.6` for the current release.
The archive keeps their original historical JSONs under `0.5`.
No failed old browser check is reclassified as a passed current browser check.
