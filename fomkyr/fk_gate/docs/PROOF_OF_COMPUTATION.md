# Computation verification bundle

George offers **Download verification bundle** for completed Fomkyr results in
persistent storage. The ZIP includes the complete binary basis, text export,
exact input, checkpoint, hashed manifest, imported profile and independent
standard-library Python checker. Generation is on demand and does not alter
solver timings.

For native jobs, use `python3 tools/export-verification.py JOB --out result.zip`.
Verify with `python3 tools/verify-computation.py result.zip --out verification.json`.

The manifest records the final scalar recount and the imported proof digest.
`independentCheckStatus` starts as `not-run`; hashes and the solver recount do
not set `independentGroebnerCertificate`. The full checker verifies each output
rule belongs to the defining ideal using an independent exact completion,
every defining relation has zero output normal form, all overlap and inclusion
compositions through the claimed degree vanish, and an independent forbidden-word
automaton gives the Hilbert prefix. Successful checks set the certificate flag.
The check is degree-bounded and does not assert unrestricted completion.

The default check has a 120-second and two-million-term allowance. Exhaustion
reports `incomplete`; larger runs can adjust both allowances. The independent
Python checker can cost much more than the C solver. It does not replay the
external profile proof, and its basis check does not rely on that proof.
