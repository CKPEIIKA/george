"""Fail-closed handoff from finite sampling to component certificate solving.

This module does not implement a Nichols coordinate oracle. It records exactly
which inputs are missing instead of treating an exhausted sampling family as a
decision procedure. Counts in an unbound chart are never subtracted here.
"""
from __future__ import annotations

from .util import atomic_json, load, sha, Incomplete


def require_component_solver(runner, degree):
    """Stop automatic high-degree sampling with a persistent dependency request.

    Explicit prepend/both discovery remains available as a bounded experiment.
    It cannot satisfy this request merely by exhausting its candidate list.
    """
    directory = runner.work / 'residual' / f'd{degree:02d}'
    catalog = runner.work / 'lower' / f'd{degree:02d}' / 'catalog.json'
    audit = runner.work / 'verified' / f'd{degree:02d}' / 'complete.json'
    retained = {}
    if catalog.exists() and audit.exists():
        from .lower import validate_catalog
        from .scheduler import verifier_fingerprint
        certificate = load(audit)
        if (certificate.get('passed')
                and certificate.get('catalogSHA256') == sha(catalog)
                and certificate.get('fingerprint') == verifier_fingerprint()):
            validate_catalog(catalog)
            retained = {
                'catalog': str(catalog.resolve()), 'catalogSHA256': sha(catalog),
                'audit': str(audit.resolve()), 'auditSHA256': sha(audit),
                'rankLowerBound': certificate['rankLowerBound'],
            }
    request = {
        'schema': 'kir-residual-component-request-1', 'degree': degree,
        'status': 'MISSING_DEPENDENCY', 'exactDimensionClaim': False,
        'automaticFamilyExpansion': False, 'retainedLowerWitnesses': retained,
        'requiredDependencies': [
            {'id': 'COMMON_COMPONENT_COORDINATES',
             'requires': 'Hash-bound spanning chart, accepted relation rows, and '
                         'accepted lower primal embeddings in that same component.'},
            {'id': 'RELATIVE_BOUNDARY_PAIRING_TRANSPORT',
             'requires': 'Checked lift/projector and complementary pairing '
                         'annihilator, with reversal and derivative conventions.'},
            {'id': 'NICHOLS_PREVIOUS_DEGREE_ZERO_OR_WITNESS',
             'degree': degree - 1,
             'requires': 'Certified coordinates or complete separating coverage '
                         'for every reachable derivative component. A scalar '
                         'dimension or an FK/(Q14) model is insufficient.'},
            {'id': 'INDEPENDENT_ORACLE_REPLAY',
             'requires': 'Replay on an already closed component before using '
                         'the oracle to decide new residual directions.'},
        ],
        'acceptance': {
            'independence': 'A replayed functional increases the accepted lower '
                            'rank in the bound component.',
            'relation': 'A replayed relation decreases its spanning upper bound '
                        'in the declared algebra namespace.',
            'completion': 'All residual directions decided, with equal bounds '
                          'in common coordinates and independent replay.',
            'notCertificates': ['candidate exhaustion', 'timeout',
                                'zero modulo one prime', 'unbound count subtraction'],
        },
        'solverImplemented': False,
    }
    path = directory / 'REQUEST.json'
    atomic_json(path, request)
    runner.event('residual_dependency_required', degree=degree,
                 request=str(path), automaticFamilyExpansion=False,
                 message='Automatic sampling stopped: a component coordinate '
                         'and zero-or-witness certificate is required.')
    raise Incomplete(f'degree-{degree} automatic discovery needs a residual '
                     f'component solver; missing dependencies recorded in {path}. '
                     'Saved witnesses are retained. Explicit --dual-mode '
                     'prepend/both selects a sampling experiment, not a decision oracle.')
