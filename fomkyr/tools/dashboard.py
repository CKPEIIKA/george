#!/usr/bin/env python3
"""Read-only Linux terminal dashboard for native Fomkyr telemetry."""
import argparse
from collections import deque
import json
import os
from pathlib import Path
import shutil
import sys
import time

GIB = 1 << 30


def size(value):
    return '-' if value is None else f'{value / GIB:.2f} GiB'


def duration(value):
    value = max(0, int(value or 0))
    hours, remainder = divmod(value, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f'{hours:02}:{minutes:02}:{seconds:02}'


def process_sample(pid, proc_root=Path('/proc')):
    proc = proc_root / str(pid)
    try:
        def ticks(path):
            # comm can contain whitespace or parentheses; fields follow its last ).
            fields = path.read_text().rsplit(')', 1)[1].split()
            return int(fields[11]) + int(fields[12])
        status = {}
        for line in (proc / 'status').read_text().splitlines():
            key, _, value = line.partition(':')
            if key in ('VmRSS', 'VmSwap'):
                status[key] = int(value.split()[0]) * 1024
        threads = {}
        for entry in (proc / 'task').iterdir():
            try:
                threads[int(entry.name)] = ticks(entry / 'stat')
            except (OSError, ValueError):
                pass
        return {'ticks': ticks(proc / 'stat'), 'threads': threads,
                'rss': status.get('VmRSS'), 'swap': status.get('VmSwap')}
    except (OSError, ValueError, IndexError):
        return None


def host_memory(proc_root=Path('/proc')):
    try:
        return {key: int(value.split()[0]) * 1024
                for key, value in (line.split(':', 1) for line in
                                   (proc_root / 'meminfo').read_text().splitlines())
                if key in ('MemTotal', 'MemAvailable')}
    except (OSError, ValueError):
        return {}


def resolve_status(argument=None):
    if argument:
        path = Path(argument)
        return path / 'status.json' if path.is_dir() else path
    root = Path(__file__).resolve().parents[1]
    candidates = set()
    for base in (Path.cwd(), root):
        for name in ('status.json', 'fk6-job/status.json', 'fomkyr-job/status.json'):
            path = base / name
            if path.is_file():
                candidates.add(path)
        candidates.update(base.glob('*/status.json'))
    return max(candidates, key=lambda p: p.stat().st_mtime) if candidates else root / 'fk6-job/status.json'


def cpu_usage(current, previous, span, hz):
    if not current or not previous or span <= 0:
        return None, []
    percent = max(0, current['ticks'] - previous['ticks']) * 100 / (span * hz)
    threads = sorted(((pid, max(0, ticks - previous['threads'].get(pid, ticks))
                       * 100 / (span * hz)) for pid, ticks in current['threads'].items()),
                     key=lambda row: row[1], reverse=True)
    return percent, threads


def render(status, process, memory, cpu=None, threads=(), rates=None, now=None):
    now = time.time() if now is None else now
    progress = status.get('progress') or {}
    degree = progress.get('degree', status.get('currentDegree', '?'))
    completed = progress.get('completedThroughDegree', status.get('completedThroughDegree', '?'))
    workers = progress.get('workers', status.get('workers', '?'))
    state = status.get('state', 'unknown')
    alive = process is not None
    if not alive and state in ('starting', 'running'):
        state = 'PROCESS ENDED / last saved sample'
    lines = ['FOMKYR  |  ' + state.upper() + '  |  PID ' + str(status.get('pid', '?')),
             '-' * 78,
             f'Degree: {degree}   completed through: {completed}   workers: {workers}',
             'Elapsed: ' + duration(status.get('cumulativeElapsedSeconds'))
             + '   this session: ' + duration(status.get('sessionElapsedSeconds'))
             + f"   status age: {max(0, now-status.get('updatedUnixSeconds', now)):.1f}s"]
    resolved, total = progress.get('resolvedOverlaps'), progress.get('totalOverlaps')
    if resolved is not None and total is not None:
        fraction = f'{resolved / total:.2%}' if total else '-'
        lines.append(f'Overlaps: {resolved:,} / {total:,}  ({fraction} frontier coverage)')
    gate = status.get('fkGate')
    if gate:
        lines.append(f"FK gate: {gate.get('closedSectors', 0)} / {gate.get('totalSectors', 360)} components closed"
                     + f"   dimension deficit: {gate.get('deficit', 0):,}")
    if rates:
        lines.append(f"Recent rate: {rates['overlaps']:.1f} overlaps/min"
                     + f"   {rates['rewrites']:,.0f} rewrites/s")
    if cpu is not None:
        lines.append(f'CPU: {cpu:.0f}%  ({cpu / 100:.2f} cores busy)'
                     + f"   reductions: {progress.get('activeLanes', '-')} active")
        lines.append('Thread CPU: ' + ' '.join(f'{pid}:{value:.0f}%' for pid, value in threads[:8]))
    else:
        lines.append('CPU: sampling...' if alive else 'CPU: process ended')
    lines += [f"RAM: {size(process.get('rss') if process else None)} resident"
              + f"   swap: {size(process.get('swap') if process else None)}",
              f"Host available: {size(memory.get('MemAvailable'))} / {size(memory.get('MemTotal'))}",
              f"Budget: {size(status.get('budgetBytes'))}"
              + f"   allocated: {size(status.get('allocatedBytes'))}",
              f"Ordinary scratch: {size(status.get('ordinaryScratchBytes'))}"
              + f"   each large reserve: {size(status.get('rowReserveBytes'))}",
              f"Large reserves: {progress.get('activeLargeRowWorkspaces', status.get('activeLargeRowWorkspaces', '-'))} active"
              + f" / {progress.get('largeRowWorkspaces', status.get('largeRowWorkspaces', '-'))} admitted"
              + f"   parked rows: {progress.get('parkedReductions', '-')}",
              f"Shared cache: {size(status.get('sharedCacheUsedBytes'))} used"
              + f" / {size(status.get('sharedCacheBytes'))}",
              f"Basis: {status.get('basisSize', 0):,} rules"
              + f"   disk: {size(status.get('diskBytes'))}",
              f"Checkpoint: #{status.get('checkpointSequence', '?')}"
              + f"   age: {status.get('checkpointAgeSeconds', 0):.1f}s",
              'Dimension assistance: external total=' + ('on' if status.get('hilbertAssumed') else 'off')
              + '  FK gate=' + ('on' if status.get('fkGateEnabled') else 'off')
              + '  components=' + ('on' if status.get('fkSectorsEnabled') else 'off'),
              '-' * 78,
              'Lane   Pair / commit       Terms       Capacity    Coeff used / pool MiB']
    for row in progress.get('lanes', []):
        big = row.get('bigRow', {})
        pair = f"{row['leftRule']}/{row['rightRule']}" if 'leftRule' in row else f"commit {row.get('batchTask', '?')}"
        lines.append(f"{row['lane']:>4}   {pair:<18} {row.get('activeTerms', 0):>11,}"
                     + f" {big.get('capacity', 0):>13,}"
                     + f" {big.get('coefficientPoolUsedBytes', 0)/(1<<20):>8.1f}"
                     + f" / {big.get('coefficientPoolBytes', 0)/(1<<20):.1f}")
    lines.append('Ctrl+C closes this dashboard. The calculation continues.')
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('status', nargs='?', help='job directory or telemetry JSON file')
    parser.add_argument('--once', action='store_true', help='print one snapshot and exit')
    parser.add_argument('--interval', type=float, default=1, help='refresh seconds (default 1)')
    args = parser.parse_args()
    if args.interval < 0.1:
        parser.error('interval must be at least 0.1 seconds')
    path = resolve_status(args.status)
    previous = None
    history = deque()
    last_pid = None
    tty = sys.stdout.isatty() and not args.once
    hz = os.sysconf('SC_CLK_TCK')
    try:
        if tty:
            sys.stdout.write('\033[?25l')
        while True:
            before = time.monotonic()
            try:
                if path.stat().st_size > 2 << 20:
                    raise ValueError('status file is too large')
                status = json.loads(path.read_text())
                pid = int(status['pid'])
                if last_pid != pid:
                    previous = None
                    history.clear()
                    last_pid = pid
                sample = process_sample(pid)
                cpu, threads = cpu_usage(sample, previous[1] if previous else None,
                                         before-previous[0] if previous else 0, hz)
                previous = (before, sample)
                progress = status.get('progress') or {}
                if history and history[-1][1] != progress.get('degree'):
                    history.clear()
                if progress:
                    history.append((before, progress.get('degree'), progress.get('resolvedOverlaps', 0),
                                    progress.get('sampledRewrites', 0)))
                while len(history) > 1 and before-history[0][0] > 60:
                    history.popleft()
                rates = None
                if len(history) > 1:
                    span = before-history[0][0]
                    rates = dict(overlaps=max(0, history[-1][2]-history[0][2])*60/span,
                                 rewrites=max(0, history[-1][3]-history[0][3])/span)
                screen = render(status, sample, host_memory(), cpu, threads, rates)
            except (OSError, ValueError, KeyError, TypeError) as error:
                screen = f'Waiting for Fomkyr status: {path}\n{error}\nEnable --telemetry FILE --progress-seconds 1 in the solver.'
            if tty:
                width, height = shutil.get_terminal_size((100, 30))
                screen = '\n'.join(line[:width] for line in screen.splitlines()[:height-1])
                sys.stdout.write('\033[H\033[2J')
            print(screen, flush=True)
            if args.once:
                break
            time.sleep(max(0, args.interval-(time.monotonic()-before)))
    except KeyboardInterrupt:
        pass
    finally:
        if tty:
            sys.stdout.write('\033[?25h\n')
            sys.stdout.flush()


if __name__ == '__main__':
    main()
