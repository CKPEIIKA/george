# C analysis

Run `make analyze` in the Fomkyr directory. The command uses the installed Clang
static analyzer, GCC analyzer and Cppcheck. Diagnostics and `REPORT.json` go to
`results/static-analysis`, which is ignored by Git. The report records missing
or timed-out coverage through the checks actually run; findings cause failure.
The default limit is five minutes per translation unit.

Run `python3 tests/test_fraction_workspace.py` for arithmetic scratch ownership,
noncanonical divisor rejection and error propagation. Run
`python3 tests/test_sector_finisher.py` for checkpoint identity coverage and
scheduler flow. Exact arithmetic, sanitizer and checkpoint checks complement
static analysis.
