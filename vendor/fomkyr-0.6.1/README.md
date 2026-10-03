# fomkyr 0.6.1 sources

This curated import contains the unchanged C kernel, runtime, build scripts,
tests, mathematical fixtures and MIT notice used by George. `SOURCE.json`
records the original archive digest and hashes of retained build/test inputs.
The packaged Wasm modules are unchanged prebuilt upstream binaries.

Build in a staging directory with `tools/build-fomkyr-backend.sh` from the
George repository root. `npm run test:fomkyr` runs imported suites and bounded
comparisons against Bergman and Singular.

The three binary files and minimal checkpoint metadata in `results/speed/` are fixtures consumed by
`tests/test_progress_integration.mjs`. Generated reports, benchmark stores,
obsolete imports and development notes are local artifacts.
