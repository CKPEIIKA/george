#!/usr/bin/env python3
"""Fetch the exact reference files cited by the additional algebra fixtures."""
import hashlib
import json
import pathlib
import urllib.request

root = pathlib.Path(__file__).resolve().parents[1]
fixture = json.loads((root / 'test/fixtures/upstream-cases.json').read_text())
target = root / 'build/oracles/upstream-tests'
for source in fixture['sources']:
    output = target / source['repository'].replace('/', '-') / source['path']
    data = output.read_bytes() if output.exists() else b''
    if hashlib.sha256(data).hexdigest() != source['sha256']:
        with urllib.request.urlopen(source['downloadUrl'], timeout=45) as response:
            data = response.read()
        assert hashlib.sha256(data).hexdigest() == source['sha256'], source['id']
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data)
    print(source['id'], source['path'], 'verified')
