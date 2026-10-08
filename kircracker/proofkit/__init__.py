__version__='0.1.0'

# Assertion-bearing reference verifiers must not silently run with checks removed.
import sys
if sys.flags.optimize: raise RuntimeError('Proofkit requires Python assertions enabled; do not use -O/PYTHONOPTIMIZE.')
