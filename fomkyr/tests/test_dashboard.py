#!/usr/bin/env python3
"""Small workspace, native telemetry, and read-only dashboard checks."""
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time

root = Path(__file__).resolve().parents[1]
exe = Path(os.environ.get('FOMKYR_NATIVE_EXE', root / 'dist/fomkyr'))
sys.path.insert(0, str(root / 'tools'))
from canonical_audit import records, canonicalize


def run(args, good=True):
    result = subprocess.run([str(exe), *args], cwd=root, capture_output=True,
                            text=True, timeout=15)
    assert (result.returncode == 0) == good, (args, result.stdout, result.stderr)
    return result


with tempfile.TemporaryDirectory() as temporary:
    temporary = Path(temporary)
    reference = None
    for manual in (False, True):
        job = temporary / str(manual)
        telemetry = temporary / ('status-' + str(manual) + '.json')
        options = ['--scratch', '6M', '--row-reserve', '64M', '--large-row-workspaces', '3'] if manual else []
        result = run(['-i', 'fixtures/published/affine-q-serre-q3.json', '-d16', '-j4',
                      '--memory', '256M', '--workdir', str(job), '--telemetry', str(telemetry),
                      '--progress-seconds', '0.1', '--quiet', *options])
        report = json.loads(result.stdout)
        canonical = canonicalize(records(next(job.glob('fomkyr/*/basis.gnb')), 16, 2))[0]
        if reference is None:
            reference = canonical
        assert canonical == reference
        status = json.loads(telemetry.read_text())
        assert status['state'] == 'complete' and status['completedThroughDegree'] == 16
        assert status['allocatedBytes'] <= status['budgetBytes']
        assert status['targetDegree'] == 16
        if manual:
            assert status['ordinaryScratchBytes'] == 6 << 20
            assert status['rowReserveBytes'] == 64 << 20
            assert report['largeRowPool']['workspaces'] == 3
        before = telemetry.read_bytes()
        dashboard = subprocess.run([str(root / 'fomkyr-dashboard.sh'), str(telemetry), '--once'],
                                   cwd=root, text=True, capture_output=True, timeout=5)
        assert dashboard.returncode == 0, dashboard.stderr
        assert 'FOMKYR' in dashboard.stdout and 'Large reserves:' in dashboard.stdout
        assert 'complete' in dashboard.stdout.lower()
        assert telemetry.read_bytes() == before
    for options in (['--scratch', '256M'], ['--row-reserve', '128M', '--scratch', '200M'],
                    ['--progress-seconds', '0'], ['--telemetry', ''], ['--telemetry', 'bad/']):
        run(['-i', 'fixtures/exterior.json', '--memory', '256M', '--dry-run', *options], good=False)
    statusfile = temporary / 'live.json'
    job = temporary / 'live-job'
    with (temporary / 'live.log').open('w') as log:
        process = subprocess.Popen([str(exe), '-i', 'fixtures/published/affine-q-serre-q3.json',
            '-d24', '-j4', '--memory', '256M', '--workdir', str(job), '--telemetry', str(statusfile),
            '--progress-seconds', '0.1', '--quiet'], cwd=root, stdout=log, stderr=log)
        try:
            seen = set()
            deadline = time.monotonic() + 8
            while time.monotonic() < deadline and process.poll() is None:
                try:
                    sample = json.loads(statusfile.read_text())
                    if sample['state'] == 'running':
                        seen.add(sample['sessionElapsedSeconds'])
                        assert sample['progress']['workers'] == 4
                except FileNotFoundError:
                    pass
                if len(seen) >= 2:
                    break
                time.sleep(0.02)
            assert len(seen) >= 2, 'Native telemetry did not refresh during computation'
        finally:
            if process.poll() is None:
                process.send_signal(signal.SIGTERM)
            process.wait(timeout=10)
        assert json.loads(statusfile.read_text())['state'] == 'stopped'

spec = importlib.util.spec_from_file_location('dashboard', root / 'tools/dashboard.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
sample = module.process_sample(os.getpid())
assert sample and sample['rss'] > 0
assert module.process_sample(2 ** 30) is None
assert module.duration(3661) == '01:01:01'
cpu, threads = module.cpu_usage({'ticks': 300, 'threads': {1: 300}},
                               {'ticks': 100, 'threads': {1: 100}}, 1, 100)
assert cpu == 200 and threads == [(1, 200)]
assert 'last saved sample' in module.render({'state': 'running', 'pid': 42}, None, {}).lower()
assert not module.health({'state': 'running', 'updatedUnixSeconds': 2000}, {}, {}, None, 100, wall=2001)
assert any('status not updating for 50s' in message for _, message in
           module.health({'state': 'running', 'updatedUnixSeconds': 1950}, {}, {}, None, 100, wall=2000))
assert module.eta(3 * 3600 + 20 * 60) == '3h20m' and module.eta(45) == '45s' and module.eta(None) == '?'
colored = module.Style(True)('abcdef', 'red')
assert module.visible(module.clip(colored, 3)) == 3 and module.visible(module.clip(colored, 99)) == 6
tracker = module.Tracker()
fake = dict(state='running', pid=1, targetDegree=14, cumulativeElapsedSeconds=0, progress=dict(degree=5, resolvedOverlaps=0, totalOverlaps=100))
for tick in range(10):
    fake['progress']['resolvedOverlaps'] = tick * 5
    tracker.update(tick, fake, {'rss': 1}, 100)
assert abs(tracker.rate(9, 300) - 5) < 1e-9
low, mid, high = tracker.degree_eta(9, 55)
assert abs(mid - 11) < 1e-9
for width, height in ((140, 50), (80, 24), (60, 10), (30, 4)):
    text = module.render(dict(fake, updatedUnixSeconds=time.time()), {'rss': 1}, {}, tracker, width, height, module.Style(True))
    assert all(module.visible(line) <= width for line in text.splitlines()) and len(text.splitlines()) <= height
print('Workspace parity, three-reserve admission, native telemetry and dashboard passed')
