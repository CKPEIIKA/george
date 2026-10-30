#!/usr/bin/env python3
"""Kircracker terminal dashboard: read-only progress, audits and resource use."""
import argparse
from collections import deque
import json
import os
from pathlib import Path
import shutil
import struct
import sys
import time

# Resolve compatibility symlinks before importing the internal view module.
sys.path.insert(0, str(Path(__file__).resolve().parent))


def read(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def duration(seconds):
    seconds = max(0, int(seconds))
    if seconds >= 3600:
        return f'{seconds//3600}h{seconds//60%60:02d}m'
    return f'{seconds//60}m{seconds%60:02d}s' if seconds >= 60 else f'{seconds}s'


def process(pid):
    try:
        p = Path('/proc')/str(pid)
        fields = (p/'stat').read_text().rsplit(')', 1)[1].split()
        status = dict(x.split(':', 1) for x in (p/'status').read_text().splitlines() if ':' in x)
        return (int(pid), (int(fields[11])+int(fields[12]))/os.sysconf('SC_CLK_TCK'),
                int(status.get('VmRSS', '0 kB').split()[0])/1024**2)
    except (OSError, ValueError, IndexError):
        return None


def workers(pid):
    result = {}
    try:
        children = Path(f'/proc/{pid}/task/{pid}/children').read_text().split()
    except OSError:
        return result
    for child in children:
        try:
            args = Path(f'/proc/{child}/cmdline').read_bytes().split(b'\0')
            if any(Path(os.fsdecode(x)).name == 'worker_state.py' for x in args[:3] if x):
                value = process(child)
                if value:
                    result[Path(os.fsdecode(args[2])).name.split('.')[0]] = value
        except (OSError, IndexError):
            pass
    return result


class Events:
    def __init__(self):
        self.items = {}

    def add(self, key, stamp, text, color='cyan'):
        self.items[key] = (stamp, text, color)
        if len(self.items) > 400:
            self.items = dict(sorted(self.items.items(), key=lambda x: x[1][0])[-200:])

    def recent(self, count):
        return sorted(self.items.values(), reverse=True)[:count]


class SearchLog:
    """Follow logs incrementally; recover recent history when the UI reopens."""
    def __init__(self, path, key, started, events):
        self.path, self.key, self.events = path, key, events
        self.position, self.inode, self.partial = 0, None, b''
        self.base, self.loaded = started, 0
        self.rank = self.columns = None
        self.last_gain = self.last_move = None
        self.samples = deque()

    def update(self):
        try:
            with self.path.open('rb') as stream:
                stat = os.fstat(stream.fileno())
                if self.inode != stat.st_ino or stat.st_size < self.position:
                    self.position = 0
                    self.partial = b''
                    self.inode = stat.st_ino
                stream.seek(self.position)
                raw = self.partial+stream.read()
                self.position = stream.tell()
            lines = raw.split(b'\n')
            self.partial = lines.pop()
            for line in lines:
                try:
                    event = json.loads(line)
                except ValueError:
                    continue
                kind = event.get('type')
                if kind == 'adaptive_launch':
                    self.base, self.loaded = event['unix'], 0
                    self.events.add(('launch', self.key, self.base), self.base,
                                    f'{self.key}: resumed search; cap {event["rankCap"]:,}', 'blue')
                elif kind == 'pair_state_loaded':
                    self.loaded = event['nextColumn']
                    self.rank = event.get('rank', self.rank)
                    self.columns = self.loaded
                    if self.rank is not None:
                        self.samples.append((self.base, self.rank, self.columns))
                elif kind == 'residual_filter_created':
                    self.events.add(('residual', self.key, self.base), self.base,
                                    f'{self.key}: residual filter uses {event["support"]:,} rows', 'cyan')
                elif kind == 'discovery_progress':
                    stamp = self.base+event['seconds']
                    rank, columns = event['rank'], self.loaded+event['offeredColumns']
                    self.record(stamp, rank, columns)
                elif event.get('pendingVerification') and 'candidateRank' in event:
                    self.record(self.base + event['discoverySeconds'],
                                event['candidateRank'], event['nextColumn'])
        except OSError:
            pass

    def record(self, stamp, rank, columns):
        if self.rank is None or rank > self.rank:
            self.last_gain = stamp
        if self.columns is None or columns > self.columns:
            self.last_move = stamp
        self.rank, self.columns = rank, columns
        self.samples.append((stamp, rank, columns))
        while len(self.samples) > 1 and stamp - self.samples[1][0] > 600:
            self.samples.popleft()

    def change(self, now, seconds, field):
        if not self.samples or self.samples[-1][0] < now-seconds:
            return 0, 0
        before = self.samples[0]
        for sample in self.samples:
            if sample[0] > now-seconds:
                break
            before = sample
        end = self.samples[-1]
        return max(0, end[field]-before[field]), max(0, end[0]-before[0])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pipeline', type=Path)
    parser.add_argument('--run', type=Path, help='Show a checkpointed pilot data directory')
    parser.add_argument('--once', action='store_true')
    parser.add_argument('--color', choices=['auto', 'always', 'never'], default='auto')
    args = parser.parse_args()
    if not args.pipeline and not args.run:
        parser.error('provide --pipeline or --run')
    from pilot_dashboard import find_run, show_dashboard
    pilot = args.run.expanduser() if args.run else find_run(args.pipeline.expanduser())
    if pilot is not None:
        show_dashboard(pilot, once=args.once, color=args.color, search_log=SearchLog)
        return
    root = args.pipeline.expanduser()
    config = read(root/'config.json')
    work = Path(config['h22Work'])
    tty = sys.stdout.isatty() and not args.once
    colors = args.color == 'always' or args.color == 'auto' and sys.stdout.isatty() and 'NO_COLOR' not in os.environ
    palette = {'green': '32', 'yellow': '33', 'red': '31', 'blue': '94', 'cyan': '36', 'dim': '90', 'bold': '1'}

    def paint(text, color):
        return f'\033[{palette[color]}m{text}\033[0m' if colors else text

    logs, cpu_previous, phase_previous = {}, {}, {}
    events = Events()
    relation_token, relation_move, relation_samples = None, time.time(), deque()
    scheduler_offset = {}
    if tty:
        print('\033[?1049h\033[2J\033[?25l', end='', flush=True)
    try:
        while True:
            now = time.time()
            parent = read(root/'STATE.json')
            degree = 23 if parent.get('stage', '').startswith('H23') or parent.get('stage') == 'FINISHED' and parent.get('h23State') else 22
            q = parent.get('h23State') or parent if degree == 23 else parent
            data_root = root/'degree23' if degree == 23 else root
            stage, prefix = q.get('stage', 'STATUS UNAVAILABLE'), f'h{degree}'
            terminal = stage in {'FINISHED', 'FAILED', 'H22_UNRESOLVED', 'H22_FINISHED', 'H23_FINISHED'}
            started = q.get(prefix+'StartedUnix', now)
            taskfile = work/'round22/tasks.json' if degree == 22 else work/'paired23/selected-tasks.json'
            statedir = work/'round22' if degree == 22 else work/'paired23/lower/d23'
            tasks = read(taskfile).get('tasks', [])
            live, upper = workers(q.get('pid', 0)), read(data_root/'UPPER_WORK.json')
            relation_workers = q.get(prefix+'RelationWorkers', 0)
            upper_proc = process(upper.get('childPid', 0)) if relation_workers else None
            mem = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())
            available = int(mem['MemAvailable'].split()[0])/1024**2
            rss = sum(v[2] for v in live.values())+(upper_proc[2] if upper_proc else 0)
            rows, total_gain, closed, last_motion = [], 0, 0, []
            for task in tasks:
                key = ''.join(map(str, task['grade']))
                cap = q.get(prefix+'RankCaps', {}).get(key, task['rows'])
                log = logs.setdefault((degree, key), SearchLog(data_root/prefix/(key+'.log'), key, started, events))
                log.update()
                rank = None
                try:
                    with (statedir/(key+'.state')).open('rb') as stream:
                        h = stream.read(100)
                    if len(h) == 100 and h[:8] in {b'FKPAIR01', b'FKPAIR02'}:
                        rank = struct.unpack('<7i', h[72:])[6]
                except OSError:
                    pass
                if log.rank is not None:
                    rank = max(rank or 0, log.rank)
                auditfile = Path(task['output'])
                audit, progressfile = read(auditfile), auditfile.with_suffix('.progress.json')
                progress = read(progressfile)
                audited = audit.get('rank', 0) if audit.get('passed') else 0
                try:
                    finished = audit.get('passed') and auditfile.stat().st_mtime >= started
                except OSError:
                    finished = False
                try:
                    verifying = progressfile.stat().st_mtime >= started and progress.get('stage') == 'independent-integer-replay'
                except OSError:
                    verifying = False
                phase = 'QUEUED'
                color, cpu = 'dim', '-'
                if key in live:
                    phase = 'VERIFY' if verifying else 'SEARCH'
                    color = 'cyan' if verifying else 'blue'
                    pid, ticks, memory = live[key]
                    previous = cpu_previous.get(pid)
                    if previous:
                        cpu = f'{100*(ticks-previous[1])/(now-previous[0]):.0f}%'
                    cpu_previous[pid] = (now, ticks)
                    if phase == 'SEARCH' and log.last_move:
                        last_motion.append(log.last_move)
                        if log.last_gain and now-log.last_gain > 300:
                            color = 'yellow'
                elif audited >= cap:
                    phase, color = 'VERIFIED', 'green'
                    closed += 1
                elif q.get(prefix+'CandidateListExhausted'):
                    phase, color = 'EXHAUSTED', 'yellow'
                elif log.rank is not None:
                    phase = 'WAITING'
                if finished:
                    stamp = auditfile.stat().st_mtime
                    events.add(('audit', degree, key, audited), stamp,
                               f'{key}: independent minor replay passed, rank {audited:,}', 'green')
                if key in live and verifying:
                    stamp = progressfile.stat().st_mtime
                    events.add(('verify', degree, key, progress.get('candidateRank')), stamp,
                               f'{key}: independent verification started, rank {progress.get("candidateRank", 0):,}', 'cyan')
                gain, _ = log.change(now, 600, 1)
                columns, window = log.change(now, 60, 2)
                total_gain += gain
                scan = f'{columns/window:.1f}' if key in live and phase == 'SEARCH' and window > 0 else '-'
                quiet = duration(now-log.last_gain) if log.last_gain and phase == 'SEARCH' else '-'
                ranktext = f'{rank:,}' if rank is not None else '?'
                gap = f'{cap-rank:,}' if rank is not None else '?'
                text = f'{key} {phase:8s} {ranktext:>7s}/{cap:<6,d} {gap:>6s} {audited:>7,d} {gain:>6,d} {scan:>6s} {quiet:>6s} {cpu:>5s}'
                rows.append(paint(text, color))
                old_phase = phase_previous.get((degree, key))
                if old_phase and old_phase != phase and phase == 'WAITING':
                    events.add(('waiting', degree, key, now), now, f'{key}: search checkpoint retained; waiting for a lane', 'dim')
                phase_previous[degree, key] = phase
            for proof in q.get(prefix+'UpperProofs', []):
                delta = proof['oldUpper']-proof['upper']
                text = f'g{proof["group"]}: relation replay passed; cap {proof["upper"]:,}'
                text += f' (tightened by {delta:,})' if delta else ' (unchanged)'
                events.add(('upper-proof', proof['receiptSHA256']), proof['completedUnix'], text, 'green')
            journal = data_root/prefix/'scheduler-events.jsonl'
            try:
                with journal.open('rb') as stream:
                    stream.seek(scheduler_offset.get(str(journal), 0))
                    for line in stream:
                        try:
                            event = json.loads(line)
                        except ValueError:
                            continue
                        key = ''.join(map(str, event['grade']))
                        events.add(('scheduler', event['unix'], key), event['unix'],
                                   f'{key}: {event["reason"]}; retained rank {event["retainedRank"]:,}', 'yellow')
                    scheduler_offset[str(journal)] = stream.tell()
            except OSError:
                pass
            relation_lines = []
            if relation_workers:
                detail, event = upper.get('stage', '?'), {}
                try:
                    folder = Path(config['adaptiveUpperRoot'])/f'g{upper["group"]:03d}-adaptive'
                    path = folder/('replay.log' if detail == 'source-replay' else 'upper.log')
                    with path.open('rb') as stream:
                        stream.seek(max(0, path.stat().st_size-8192))
                        for line in reversed(stream.read().decode(errors='replace').splitlines()):
                            try:
                                candidate = json.loads(line)
                            except ValueError:
                                continue
                            if candidate.get('type') == 'upper_progress':
                                event = candidate
                                break
                    token = (upper.get('group'), detail, event.get('phase'), event.get('sourceRow'), event.get('relation'), event.get('context'), event.get('cacheMiB'))
                    if token != relation_token:
                        relation_token, relation_move = token, now
                    last_motion.append(relation_move)
                    count = event.get('sourceRow', 0)
                    group = upper.get('group')
                    relation_samples.append((now, group, detail, event.get('phase'), count))
                    while len(relation_samples)>1 and now-relation_samples[1][0]>60:
                        relation_samples.popleft()
                    before = next((s for s in relation_samples if s[1:4] == (group, detail, event.get('phase'))), relation_samples[-1])
                    advance = max(0, count-before[4])
                    span = now-before[0]
                    rate = f'{advance/span:.1f} rows/s' if span >= 5 else 'warming up'
                    relation_lines.append(paint(f'Relations g{group}: {detail} / {event.get("phase", "starting")} | row {count:,} | {rate}', 'cyan'))
                    relation_lines.append(paint(f'  cache {event.get("cacheMiB", 0):,} MiB | cursor changed {duration(now-relation_move)} ago | remaining at launch {upper.get("remainingSourceRows", 0):,}', 'dim'))
                except (OSError, KeyError, ValueError):
                    relation_lines.append(paint(f'Relations: {detail}; waiting for source-row telemetry', 'yellow'))
                events.add(('upper-start', upper.get('startedUnix')), upper.get('startedUnix', now),
                           f'g{upper.get("group")}: relation continuation started ({upper.get("remainingSourceRows", 0):,} source rows left)', 'blue')
            heartbeat = now-q.get('updatedUnix', now)
            errors = q.get(prefix+'Errors', [])
            if terminal:
                exact = q.get(prefix+'Status', '').startswith('EXACT')
                health, health_color = ('CERTIFIED' if exact else 'UNRESOLVED'), ('green' if exact else 'yellow')
                if stage == 'FAILED':
                    health, health_color = 'CHECK ERRORS', 'red'
            elif errors or heartbeat > 30 and not (live and q.get(prefix+'ResidualFilter')):
                health, health_color = ('CHECK ERRORS' if errors else 'STALE CONTROLLER'), 'red'
            elif last_motion and now-max(last_motion) > 120:
                health, health_color = 'CHECK LONG ROW / COLUMN', 'yellow'
            elif total_gain or closed == len(tasks) and tasks:
                health, health_color = 'ADVANCING', 'green'
            elif last_motion:
                health, health_color = 'SCANNING / RANK PLATEAU', 'yellow'
            else:
                health, health_color = 'VERIFYING / WAITING', 'cyan'
            width, height = shutil.get_terminal_size((100, 34))
            heartbeat_text = 'finished' if terminal else duration(heartbeat)
            lines = [paint(f'KIRCRACKER h{degree}  {health}  |  {stage}  |  {time.strftime("%H:%M:%S")}', health_color),
                     f'Elapsed {duration(now-started)} | independently closed {closed}/{len(tasks)} | pairing {len(live)} + relations {relation_workers} / 4',
                     f'RAM {rss:.1f} GiB workers / {available:.1f} GiB available | free disk {shutil.disk_usage(work).free/1024**3:.1f} GiB data, {shutil.disk_usage(root).free/1024**3:.1f} GiB home',
                     paint(f'Last 10 min: +{total_gain:,} discovery ranks | heartbeat {heartbeat_text} | errors {len(errors)}', 'green' if total_gain else 'yellow'),
                     '', paint('Grade  Phase       Rank / cap     Gap Audited   +10m  col/s  last+   CPU', 'bold'),
                     '-'*85, *rows, '', *relation_lines, '', paint('RECENT MILESTONES', 'bold')]
            event_slots = max(2, min(7, height-len(lines)-5))
            for stamp, text, color in events.recent(event_slots):
                lines.append(paint(f'{time.strftime("%H:%M:%S", time.localtime(stamp))}  {text}', color))
            lines += ['', paint(f'Rotations {q.get(prefix+"AdaptiveRotations", 0)} | retargets {q.get(prefix+"BoundRetargets", 0)} | refresh 1s | Ctrl-C closes UI', 'dim'),
                      paint('Audited = independently verified. col/s measures scanning; last+ measures time since a rank gain.', 'dim')]
            if q.get(prefix+'CandidateListExhausted'):
                bounds = read(data_root/'BEST_BOUNDS.json')
                for label, field in [('b', 'B6'), ('h', 'FK6')]:
                    value = bounds.get(field, {})
                    if 'lower' in value and 'upper' in value:
                        lines.append(paint(f'{label}{degree}: {value["lower"]:,} .. {value["upper"]:,}', 'yellow'))
            if errors:
                lines.append(paint(str(errors), 'red'))
            # Erase individual line tails to keep shorter updates from leaving text behind.
            if tty:
                print('\033[H'+'\n'.join(line+'\033[K' for line in lines)+'\033[J', flush=True)
            else:
                print('\n'.join(lines), flush=True)
            if args.once:
                break
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        if tty:
            print('\033[?25h\033[?1049l', end='', flush=True)


if __name__ == '__main__':
    main()
