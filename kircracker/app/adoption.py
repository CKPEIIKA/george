"""Adopt an existing worker without restarting its native calculation."""
from pathlib import Path
import json
import os

from .util import Invalid, load, sha


def process_identity(pid):
    try:
        fields = Path(f'/proc/{pid}/stat').read_text().rsplit(')', 1)[1].split()
        return fields[0], int(fields[19])
    except (OSError, ValueError, IndexError):
        return None


class AdoptedAudit:
    """Popen-compatible read-only observer; successful exit requires its receipt."""
    def __init__(self, descriptor, task, fingerprint):
        self.pid = int(descriptor['pid'])
        self.task = task
        self.fingerprint = fingerprint
        self.started = float(descriptor['startedUnix'])
        self.expected_rank = int(descriptor['candidateRank'])
        self.start_ticks = int(descriptor['startTicks'])
        self.args = list(descriptor['args'])
        self.returncode = None
        self.kind = task['_workerKind']
        if self.kind not in {'verify-pending', 'discover'}:
            raise Invalid('Unsupported adopted worker kind')
        if self.args[-2:] != [descriptor['taskFile'], task['output']]:
            raise Invalid('Adopted worker arguments do not match the audit')
        if task['fingerprint'] != fingerprint:
            raise Invalid('Adopted audit verifier differs from the continuation')
        identity = process_identity(self.pid)
        if identity and identity[1] != self.start_ticks:
            raise Invalid('Adopted worker PID was reused')
        if identity and identity[0] != 'Z':
            actual = Path(f'/proc/{self.pid}/cmdline').read_bytes().split(b'\0')
            actual = [os.fsdecode(a) for a in actual if a]
            if actual != self.args or os.getpgid(self.pid) != self.pid:
                raise Invalid('Adopted audit process identity changed')

    def poll(self):
        if self.returncode is not None:
            return self.returncode
        identity = process_identity(self.pid)
        if identity and identity[1] == self.start_ticks and identity[0] != 'Z':
            return None
        try:
            output = Path(self.task['output'])
            if self.kind == 'discover':
                output = output.with_suffix('.discovery.json')
                receipt = load(output)
                passed = (output.stat().st_mtime >= self.started
                          and receipt.get('taskBinding') == self.task['binding'])
                if receipt.get('pendingVerification'):
                    passed = (passed and receipt.get('candidateRank', 0) >= self.expected_rank
                              and sha(Path(receipt['pending'])) == receipt.get('pendingSHA256'))
                else:
                    passed = passed and receipt.get('passed') is True and receipt.get('rank') == 0
            else:
                receipt = load(output)
                passed = (output.stat().st_mtime >= self.started
                      and receipt.get('passed') is True
                      and receipt.get('taskBinding') == self.task['binding']
                      and receipt.get('verifierFingerprint') == self.fingerprint
                      and receipt.get('rank', 0) >= self.expected_rank
                      and sha(Path(self.task['minor'])) == receipt.get('minorSHA256'))
        except (OSError, ValueError, KeyError):
            passed = False
        self.returncode = 0 if passed else 1
        return self.returncode
