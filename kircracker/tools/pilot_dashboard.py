"""Internal views used by the single Kircracker terminal dashboard."""
import json
import fcntl
import os
from pathlib import Path
import shutil
import sys
import time
from verified_bounds import apply_upper_overlay


def read(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def process(pid, expected=None):
    try:
        root = Path('/proc') / str(pid)
        command = (root / 'cmdline').read_bytes().split(b'\0')
        if expected and os.fsencode(str(expected)) not in command:
            return None
        fields = (root / 'stat').read_text().rsplit(')', 1)[1].split()
        if fields[0] == 'Z':
            return None
        ticks = os.sysconf('SC_CLK_TCK')
        cpu = (int(fields[11]) + int(fields[12])) / ticks
        elapsed = float(Path('/proc/uptime').read_text().split()[0]) - int(fields[19]) / ticks
        status = dict(line.split(':', 1) for line in (root / 'status').read_text().splitlines() if ':' in line)
        memory = int(status.get('VmRSS', '0 kB').split()[0]) * 1024
        return cpu, memory, max(elapsed, .001)
    except (OSError, ValueError, IndexError):
        return None


def find_run(pipeline):
    """Prefer a live pilot over the legacy controller's finished queue."""
    config = read(pipeline / 'config.json')
    work = Path(config['h22Work']).expanduser() if config.get('h22Work') else pipeline
    candidates = []
    strategies = []
    for path in [work / 'STATE.json', *work.glob('*/STATE.json')]:
        state = read(path)
        pointer = state.get('upperStrategy', {})
        if pointer.get('directory'):
            strategy = read(Path(pointer['directory']) / 'STATE.json')
            if strategy.get('pid') == state.get('pid') and strategy.get('startedUnix'):
                strategies.append((strategy.get('startedUnix', 0),
                                   strategy.get('updatedUnix', 0), path.parent))
        replay = 'active' in state and 'memoryGiBPerWorker' in state
        if 'pilotDiscoveryDeadlineUnix' not in state and not replay:
            continue
        alive = (any(process(t.get('pid', 0)) for t in state.get('active', []))
                 if replay else process(state.get('pid', 0)) is not None)
        terminal = state.get('stage') in {'PILOT_FINISHED', 'CONTROLLER_ERROR', 'FINISHED', 'RESIDUAL_DEPENDENCY_REQUIRED'}
        candidates.append((alive and not terminal, state.get('startedUnix', 0), path.parent))
    if strategies:
        return max(strategies)[-1]
    if not candidates:
        return None
    live, started, root = max(candidates)
    legacy = read(pipeline / 'STATE.json')
    legacy_started = max(legacy.get('h22StartedUnix', 0), legacy.get('h23StartedUnix', 0))
    return root if live or started >= legacy_started else None


def duration(seconds):
    seconds = max(0, int(seconds))
    if seconds >= 3600:
        return f'{seconds // 3600}h{seconds // 60 % 60:02d}m'
    return f'{seconds // 60}m{seconds % 60:02d}s' if seconds >= 60 else f'{seconds}s'


class EventSink:
    def add(self, *args, **kwargs):
        pass


class RecentProgress:
    """Retain the visible window across discovery/audit process changes."""
    def __init__(self):
        self.samples = {}

    def observe(self, grade, log, rank, columns, now):
        samples = self.samples.setdefault(grade, {})
        samples.update((t, (r, c)) for t, r, c in log.samples)
        samples[now] = rank, columns
        ordered = sorted(samples)
        keep = next((i for i, t in enumerate(ordered) if t >= now - 600), len(ordered))
        for t in ordered[:max(0, keep - 1)]:
            del samples[t]

    def change(self, grade, now, seconds, field):
        samples = sorted(self.samples[grade].items())
        before = samples[0]
        for sample in samples:
            if sample[0] > now - seconds:
                break
            before = sample
        end = samples[-1]
        return max(0, end[1][field] - before[1][field]), max(0, end[0] - before[0])


class AuditedGaps:
    """Persist observed bound changes across dashboard restarts, never discovery ranks."""
    def __init__(self, root):
        self.path = root / 'audited-gap-history.jsonl'
        self.rows = []
        self.token = None
        self.saved = True
        self.observed_at = 0

    def observe(self, result, now):
        bounds = {}
        for name in ('FK6', 'B6'):
            value = result.get(name, {})
            lo, hi = value.get('lower'), value.get('upper')
            if type(lo) is int and type(hi) is int and 0 <= lo <= hi:
                bounds[name] = {'lower': lo, 'upper': hi, 'gap': hi - lo}
        token = json.dumps([result.get('degree'), bounds], sort_keys=True)
        if not bounds or token == self.token and now - self.observed_at < 60:
            return
        self.token = token
        self.observed_at = now
        row = {'unix': now, 'degree': result.get('degree'), 'bounds': bounds,
               'source': result.get('boundObservationSource', 'audited RESULT.json observed by dashboard')}
        try:
            with self.path.open('a+') as stream:
                fcntl.flock(stream, fcntl.LOCK_EX)
                stream.seek(0)
                rows = []
                for line in stream:
                    try:
                        item = json.loads(line)
                        if (item.get('degree') == row['degree'] and
                                isinstance(item.get('unix'), (int, float)) and
                                isinstance(item.get('bounds'), dict)):
                            rows.append(item)
                    except (ValueError, TypeError):
                        continue
                rows.sort(key=lambda item: item['unix'])
                if not rows or rows[-1]['bounds'] != bounds or now - rows[-1]['unix'] >= 60:
                    # Recover from an interrupted final line before appending.
                    stream.seek(0, 2)
                    if stream.tell():
                        stream.seek(stream.tell() - 1)
                        if stream.read(1) != '\n':
                            stream.write('\n')
                    stream.write(json.dumps(row, separators=(',', ':')) + '\n')
                    stream.flush()
                    os.fsync(stream.fileno())
                    rows.append(row)
                self.rows = rows
                self.saved = True
        except OSError:
            if not self.rows or self.rows[-1]['bounds'] != bounds:
                self.rows.append(row)
            self.saved = False

    def window(self, name, now, seconds):
        rows = [r for r in self.rows if name in r['bounds']]
        before = next((r for r in reversed(rows) if r['unix'] <= now - seconds), None)
        if before is None or not rows or now - seconds - before['unix'] > 120:
            return None
        return before['bounds'][name]['gap'] - rows[-1]['bounds'][name]['gap']

    def lines(self, degree, now, paint):
        rows = self.rows
        if not rows:
            return []
        lines = [paint('AUDITED GAPS  |  zero closes the bound interval', 'bold'),
                 '             Remaining gap       shrink / 10m       shrink / 1h']
        for name, label in [('FK6', f'h{degree}'), ('B6', f'b{degree}')]:
            known = [r for r in rows if name in r['bounds']]
            if not known:
                continue
            value = known[-1]['bounds'][name]
            changes = [self.window(name, now, seconds) for seconds in (600, 3600)]
            text = ['no sample' if x is None else f'{x:+,d}' for x in changes]
            shade = 'green' if value['gap'] == 0 or any(x is not None and x > 0 for x in changes) else 'yellow'
            lines.append(paint(f'{label:<7s} {value["gap"]:>18,d} {text[0]:>18s} {text[1]:>18s}', shade))
            first = known[0]
            reduction = first['bounds'][name]['gap'] - value['gap']
            initial = first['bounds'][name]['gap']
            percent = f' ({100 * reduction / initial:.1f}% of initial gap)' if initial else ''
            changes = [(a, b) for a, b in zip(known, known[1:])
                       if a['bounds'][name]['gap'] != b['bounds'][name]['gap']]
            last = ''
            if changes:
                a, b = changes[-1]
                delta = a['bounds'][name]['gap'] - b['bounds'][name]['gap']
                last = f' | last observed {delta:+,d}, {duration(now - b["unix"])} ago'
            lines.append(paint(f'  Since {time.strftime("%d %b %H:%M", time.localtime(first["unix"]))}: shrink {reduction:,}{percent}{last}', 'dim'))
        if not self.saved:
            lines.append(paint('Gap history is in memory only: history file is not writable.', 'yellow'))
        return lines


def discovery_source(root, task):
    """Keep discovery history visible while its candidate is being audited."""
    key = task['grade']
    taskfile = Path(task.get('taskFile', root / 'attempts' / f'{key}-{task.get("attempts", 0)}.json'))
    logpath = Path(task.get('logPath', taskfile.with_suffix('.log')))
    if '.verify-pending.' in logpath.name:
        logpath = logpath.with_name(logpath.name.replace('.verify-pending.', '.discover.'))
        taskfile = logpath.with_suffix('.task.json')
    if not logpath.is_file():
        matches = list((root / 'minors').glob(f'{key}*.discover.log'))
        if matches:
            logpath = max(matches, key=lambda p: p.stat().st_mtime)
            taskfile = logpath.with_suffix('.task.json')
    try:
        started = taskfile.stat().st_mtime
    except OSError:
        started = read(root / 'STATE.json').get('startedUnix', time.time())
    return logpath, started


def audit_phase(task):
    """A CPU-bound determinant is different from a quiet discovery column."""
    path = task.get('logPath')
    if not path:
        return 'REPLAY'
    try:
        with Path(path).open('rb') as stream:
            stream.seek(max(0, Path(path).stat().st_size - 65536))
            lines = stream.read().decode('utf8', 'replace').splitlines()
        for line in reversed(lines):
            try:
                event = json.loads(line)
            except ValueError:
                continue
            kind = event.get('type')
            if kind in {'verification_entries_complete', 'verification_factorization_start'}:
                return 'FACTOR'
            if kind == 'verification_entries_progress':
                return 'REPLAY'
    except OSError:
        pass
    return 'REPLAY'


def external_replays(root, exclude):
    """Read independent recovery workers beside the selected continuation."""
    found = {}
    for path in root.parent.glob('*/STATE.json'):
        state = read(path)
        if 'memoryGiBPerWorker' not in state:
            continue
        for task in state.get('active', []):
            pid = task.get('pid')
            if pid and pid not in exclude and process(pid):
                found[pid] = task.get('grade', '?')
    return found


def show_replays(root, *, once, color):
    """Independent audit recovery has no new discovery cursor to display."""
    tty = sys.stdout.isatty() and not once
    use_color = color == 'always' or color == 'auto' and sys.stdout.isatty() and 'NO_COLOR' not in os.environ
    previous = {}

    def paint(text, code):
        return f'\033[{code}m{text}\033[0m' if use_color else text

    if tty:
        print('\033[?1049h\033[2J\033[?25l', end='', flush=True)
    try:
        while True:
            now = time.time()
            state, result = read(root / 'STATE.json'), read(root / 'RESULT.json')
            active = {t['grade']: t['pid'] for t in state.get('active', [])}
            pending = set(state.get('pending', []))
            completed = {t['grade']: t for t in state.get('tasks', [])}
            audits = {p.name.removesuffix('.audit.json'): read(p) for p in root.glob('*.audit.json')}
            grades = sorted(set(active) | pending | set(completed) | set(audits))
            rows, rss, cpu, live = [], 0, 0, 0
            for grade in grades:
                audit, pid = audits.get(grade, {}), active.get(grade)
                info = process(pid) if pid else None
                phase = 'VERIFIED' if audit.get('passed') else 'AUDITING' if info else 'WAITING' if grade in pending else 'FAILED'
                cpu_text, ram_text, age = '-', '-', '-'
                if info:
                    ticks, memory, elapsed = info
                    old = previous.get(pid)
                    rate = 100 * (ticks - old[1]) / max(now - old[0], .001) if old else 100 * ticks / elapsed
                    previous[pid] = now, ticks
                    cpu += rate
                    rss += memory
                    live += 1
                    cpu_text, ram_text, age = f'{rate:.0f}%', f'{memory / 2**30:.2f}', duration(elapsed)
                elif grade in completed:
                    age = duration(completed[grade].get('seconds', 0))
                rank = f'{audit["rank"]:,}' if audit.get('passed') else '-'
                code = 32 if phase == 'VERIFIED' else 36 if phase == 'AUDITING' else 33
                rows.append(paint(f'{grade} {phase:10s} {rank:>9s} {cpu_text:>6s} {ram_text:>6s} {age:>9s}', code))
            heartbeat = max(0, now - state.get('updatedUnix', now))
            terminal = state.get('stage') == 'FINISHED'
            errors = state.get('errors', [])
            health = 'CHECK ERRORS' if errors else 'REPLAY FINISHED' if terminal else 'STALE CONTROLLER' if heartbeat > 15 else 'INDEPENDENT REPLAY'
            tint = 31 if errors or heartbeat > 15 and not terminal else 32 if terminal else 36
            end = state.get('finishedUnix', now)
            verified = sum(bool(a.get('passed')) for a in audits.values())
            lines = [paint(f'KIRCRACKER degree {result.get("degree", "?")} | {health} | {time.strftime("%H:%M:%S")}', tint),
                     f'Elapsed {duration(end - state.get("startedUnix", now))} | workers {live}/{state.get("maxWorkers", "?")} | CPU {cpu:.0f}%',
                     f'RAM {rss / 2**30:.1f} GiB workers | limit {state.get("memoryGiBPerWorker", "?")} GiB per worker | disk free {shutil.disk_usage(root).free / 2**30:.1f} GiB',
                     f'Audits passed {verified}/{len(grades)} | queued {len(pending)} | heartbeat {duration(heartbeat)} | errors {len(errors)}',
                     '', paint('Grade  Phase        Audited rank    CPU    GiB      Time', 1), '-' * 64, *rows,
                     '', paint('AUDITED BOUNDS', 1)]
            for name, label in [('B6', 'b'), ('FK6', 'h')]:
                value = result.get(name, {})
                if 'lower' in value and 'upper' in value:
                    lines.append(f'{label}{result.get("degree", "?")}: {value["lower"]:,} .. {value["upper"]:,} | gap {value["upper"] - value["lower"]:,}')
            lines += ['', 'Replaying saved minors; discovery and original checkpoints are preserved.',
                      'Audited ranks update when a whole minor passes. Active CPU shows replay work.',
                      'Refresh 1s | Ctrl-C closes this UI; computation continues.']
            if errors:
                lines.append(paint(str(errors[-2:]), 31))
            if tty:
                print('\033[H' + '\n'.join(line + '\033[K' for line in lines) + '\033[J', flush=True)
            else:
                print('\n'.join(lines), flush=True)
            if once:
                return
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        if tty:
            print('\033[?25h\033[?1049l', end='', flush=True)


def upper_strategy(state):
    """Read the separately checkpointed, finite upper-bound queue."""
    pointer = state.get('upperStrategy', {})
    if not pointer.get('directory'):
        return {}
    data = read(Path(pointer['directory']) / 'STATE.json')
    if data.get('pid') != state.get('pid'):
        return {}
    data['componentWorkDirectory'] = pointer['directory']
    progress = {}
    log = data.get('workerLog')
    if log and data.get('stage') == 'UPPER_REMAINDER_DISCOVERY':
        try:
            with Path(log).open('rb') as stream:
                stream.seek(max(0, Path(log).stat().st_size-16384))
                for line in reversed(stream.read().decode(errors='replace').splitlines()):
                    try:
                        value = json.loads(line)
                    except ValueError:
                        continue
                    if value.get('type') == 'chart_progress':
                        progress = value
                        break
        except OSError:
            pass
    data['screenProgress'] = progress
    return data


def q22_status(root):
    """Read the separate Q22 job without changing its ownership or checkpoint."""
    pointer = read(root.parent / 'resume-both-20261021' / 'Q22_CURRENT.json')
    if not pointer.get('directory'):
        return {}
    data = read(Path(pointer['directory']) / 'STATE.json')
    pid = data.get('numericPID')
    data['live'] = bool(pid and data.get('solve') and process(pid, Path(data['solve'])))
    return data


def modular_discovery_status(root):
    """An optional isolated pilot; its ranks never enter the audited bounds."""
    pointer = read(root / 'MODULAR_DISCOVERY.json')
    if not pointer.get('directory'):
        return {}
    directory = Path(pointer['directory'])
    data = read(directory / 'STATE.json')
    data['audit'] = read(directory / 'AUDIT_STATE.json')
    data['sourceReplay'] = read(directory / 'SOURCE_REPLAY_PROGRESS.json')
    data['fieldReplay'] = read(directory / 'pilot' / 'FIELD_REPLAY_PROGRESS.json')
    data['sourcesVerified'] = read(directory / 'VERIFIED_SOURCES.json')
    data['fieldVerified'] = read(directory / 'VERIFIED_FIELD.json')
    data['progress'] = read(directory / 'pilot' / 'PROGRESS.json')
    pid = data.get('workerPID')
    data['live'] = bool(pid and process(pid, directory / 'pilot'))
    if not data['live']:
        audit = data['audit']
        pid = audit.get('workerPID')
        if pid and (process(pid, directory) or process(pid, directory / 'pilot')):
            data.update(workerPID=pid, live=True)
            data['progress']['phase'] = audit.get('stage', 'REPLAYING')
    return data


def coordinate_reconstruction_status(root):
    pointer = read(root / 'MAP_RECONSTRUCTION.json')
    if not pointer.get('directory') or not pointer.get('source'):
        return {}
    directory, source = Path(pointer['directory']), Path(pointer['source'])
    data = read(directory / 'STATE.json')
    pid = data.get('workerPID')
    expected = [directory / 'checkpoints', source / 'module_rational.cpp',
                source / 'verify_model.cpp']
    data['live'] = bool(pid and any(process(pid, path) for path in expected))
    # Older queue wrappers did not copy native progress into STATE.json. Read
    # only the bounded tail of the verified worker's regular stdout log.
    if data['live']:
        try:
            log = Path(data['currentLog']) if data.get('currentLog') else (Path('/proc') / str(pid) / 'fd/1').resolve(strict=True)
            if log.is_file():
                with log.open('rb') as stream:
                    stream.seek(max(0, log.stat().st_size - 16384))
                    tail = stream.read().decode(errors='replace').splitlines()
                for line in reversed(tail):
                    try:
                        progress = json.loads(line)
                    except ValueError:
                        continue
                    if isinstance(progress, dict) and 'degree' in progress:
                        data['progress'] = progress
                        break
        except OSError:
            pass
    return data


def coxeter_discovery_status(root):
    pointer = read(root / 'COXETER_DISCOVERY.json')
    if not pointer.get('directory'):
        return {}
    directory = Path(pointer['directory'])
    result = {}
    for mode in ['dual', 'contexts']:
        lane_directory = Path(pointer.get('lanes', {}).get(mode, directory / mode))
        data = read(lane_directory / 'STATE.json')
        data['live'] = bool(data.get('pid') and process(data['pid'], lane_directory))
        result[mode] = data
    return result


def whitney_status(root):
    pointer = read(root / 'WHITNEY_COMPUTATION.json')
    if not pointer.get('directory'):
        return {}
    directory = Path(pointer['directory'])
    data = read(directory / 'STATE.json')
    data['progress'] = read(directory / 'progress.json')
    data['liveWorkers'] = []
    pid = data.get('workerPID')
    if pid:
        try:
            for task in (Path('/proc') / str(pid) / 'task').iterdir():
                for child in (task / 'children').read_text().split():
                    child = int(child)
                    if process(child, directory / 'cache'):
                        data['liveWorkers'].append(child)
        except OSError:
            pass
    return data


def compact_research_lines(state, result, strategy, q22, modular, resources,
                           available, disk_free, now, watches, paint, coordinates=None, coxeter=None, whitney=None):
    """Keep stopped Hilbert work visibly separate from active Q22 jobs."""
    def resource(pid):
        cpu, memory = resources.get(pid, (0, 0))
        return f'CPU {cpu:.0f}% | RAM {memory / 2**30:.1f} GiB'

    def motion(key, counters, live):
        old = watches.get(key)
        if old is None:
            watches[key] = {'values': counters, 'started': now, 'changed': None}
            return 'Observing activity...', 'dim'
        if old['values'] != counters:
            old.update(values=counters, changed=now)
        if not live:
            return 'No active worker.', 'yellow'
        age = now - (old['changed'] or old['started'])
        if age > 120:
            return f'CHECK: no work-counter change for {duration(age)}.', 'red'
        if old['changed'] is None:
            return 'Running; waiting for the next counter update.', 'cyan'
        return f'Work advancing; counter changed {duration(age)} ago.', 'cyan'

    stage = state.get('stage')
    blocked = stage == 'RESIDUAL_DEPENDENCY_REQUIRED'
    coordinate_stage = str(stage).startswith('RESIDUAL_') and not blocked
    worker = strategy.get('workerPID')
    h23_live = worker in resources
    maps_running = bool(coordinates and coordinates.get('live'))
    if maps_running:
        lines = [paint('H23 / B23: COORDINATE PREPARATION RUNNING', 'cyan')]
        lines.append('Building the missing exact component maps; accepted gaps have not closed yet.')
    elif coordinate_stage and h23_live:
        progress = strategy.get('progress', {})
        directory = strategy.get('componentWorkDirectory')
        inputs = read(Path(directory) / 'INPUTS.json') if directory else {}
        seed_total = inputs.get('seedRecords', 29870)
        labels = {
            'RESIDUAL_PAIRING_FACTOR_PREPARE': 'PREPARING RESIDUAL TEST',
            'RESIDUAL_PAIRING_FACTOR': 'RESTORING ACCEPTED PAIRING FACTOR',
            'RESIDUAL_SCHUR_PROBE': 'TESTING ONE RESIDUAL DIRECTION',
            'RESIDUAL_NEW_MINOR_REPLAY': 'VERIFYING NEW INDEPENDENCE WITNESS',
            'RESIDUAL_RELATION_PREPARE': 'PREPARING TARGETED RELATION WORK',
            'RESIDUAL_RELATION_DISCOVERY': 'DECIDING UNRESOLVED RELATION DIRECTIONS',
            'RESIDUAL_RELATION_REPLAY': 'VERIFYING NEW RELATION IDENTITIES',
            'RESIDUAL_RELATION_ASSEMBLY': 'ASSEMBLING VERIFIED BOUNDS',
        }
        label = labels.get(stage, 'BUILDING RESIDUAL COORDINATES')
        lines = [paint(f'H23 / B23: {label} (1 worker)', 'cyan'), resource(worker)]
        elapsed = duration(now - strategy.get('phaseStartedUnix', now))
        kind = progress.get('type', '')
        if stage == 'RESIDUAL_PAIRING_FACTOR':
            if kind == 'verification_entries_progress':
                done, total = progress.get('columns', 0), progress.get('rank', 0)
                lines.append(f'Pairing columns replayed {done:,}/{total:,} | phase {elapsed}')
                text, shade = motion('h23-factor', (kind, done), True)
                lines.append(paint(text, shade))
            elif kind == 'verification_factorization_start':
                lines.append(f'Factoring accepted matrix | reused rank {progress.get("cachedRank", 0):,} | phase {elapsed}')
                lines.append('No inner factorization counter; CPU shows activity, not proof progress.')
            else:
                lines.append(f'{str(kind).replace("_", " ")} | phase {elapsed}')
        elif stage == 'RESIDUAL_SCHUR_PROBE':
            lines.append(f'Target coordinates {progress.get("row", 0):,}/{progress.get("rank", 0):,} | new duals tried {progress.get("newDualsTried", 0):,} | phase {elapsed}')
        elif stage == 'RESIDUAL_NEW_MINOR_REPLAY':
            lines.append(f'Independent determinant replay | phase {elapsed}')
        elif stage == 'RESIDUAL_RELATION_DISCOVERY':
            if progress.get('stage') == 'RESTORING_VERIFIED_REMAINDER_BANK':
                lines.append(f'Restoring accepted remainder records {progress.get("seedRecords", 0):,}/{seed_total:,} | phase {elapsed}')
            else:
                lines.append(f'Residual queries {progress.get("queries", 0):,}/{strategy.get("selectedCount", 0):,} | new relation candidates {progress.get("newRelations", 0):,} | phase {elapsed}')
                lines.append(f'Partial reductions retained {progress.get("retainedPartialRows", 0):,}; no unfinished row is called zero.')
        elif stage == 'RESIDUAL_RELATION_REPLAY':
            lines.append(f'Seed replay {progress.get("seedRecords", 0):,}/{seed_total:,} | new rows {progress.get("newRecords", 0):,} | phase {elapsed}')
            lines.append(f'New relations checked {progress.get("verifiedNewRelations", 0):,}; accepted prefixes update the bounds below.')
            if directory:
                try:
                    path = Path(directory) / 'BOUND_PROGRESS.jsonl'
                    with path.open('rb') as stream:
                        stream.seek(max(0, path.stat().st_size - 8192))
                        last_bound = json.loads(stream.read().splitlines()[-1])
                    gain = last_bound['cumulativeUpperReduction']
                    age = duration(now - last_bound['unix'])
                    lines.append(paint(f'Accepted upper-bound improvement this pass: {gain:,} | latest certificate {age} ago.', 'green'))
                except (OSError, ValueError, KeyError, IndexError):
                    pass
        else:
            rows = progress.get('rowsProcessed', progress.get('rows', 0))
            lines.append(f'{str(stage).replace("_", " ").lower()} | processed rows {rows:,} | phase {elapsed}')
    elif stage == 'RESIDUAL_NEW_WITNESS_VERIFIED':
        lines = [paint('H23 / B23: NEW WITNESS VERIFIED (0 workers)', 'green')]
        lines.append('A new minor passed replay. Scalar bounds await certificate assembly.')
    elif stage == 'RESIDUAL_RELATIONS_VERIFIED':
        lines = [paint('H23 / B23: RELATION PASS VERIFIED (0 workers)', 'green')]
        lines.append(f'New independent relations {strategy.get("verified", {}).get("newIndependentRelations", 0):,} | scalar upper bound reduced by {strategy.get("certifiedUpperReduction", 0):,}.')
    elif stage == 'RESIDUAL_NEEDS_COMPLETE_ORACLE':
        lines = [paint('H23 / B23: RESIDUAL UNDECIDED (0 workers)', 'yellow')]
        lines.append('The selected dual tests did not decide this direction; complete separation coverage is missing.')
    elif stage == 'RESIDUAL_COORDINATES_READY':
        value = strategy.get('result', {})
        lines = [paint('H23 BRIDGE: COORDINATES VERIFIED (0 workers)', 'green')]
        lines.append(f'Residual chart directions: {value.get("residualChartComplementDimension", 0):,}; next: derivative/oracle bridge.')
    elif stage == 'RESIDUAL_COORDINATE_ERROR':
        lines = [paint('H23 BRIDGE: ERROR - CHECK LOG (0 workers)', 'red')]
        lines.append(str(strategy.get('errors', ['unknown error'])[-1]).splitlines()[-1][:180])
    elif coordinate_stage:
        controller_live = process(strategy.get('pid', 0)) is not None
        text = 'BETWEEN PHASES' if controller_live else 'STOPPED - CHECK CONTROLLER'
        lines = [paint(f'H23 BRIDGE: {text} (0 numerical workers)', 'cyan' if controller_live else 'red')]
    else:
        lines = [paint(f'H23 / B23: {"IDLE - MISSING INPUTS" if blocked else "IDLE - SEARCH STOPPED"} (0 workers)', 'yellow')]
    if maps_running:
        lines.append('Next gate: independent map replay, then exact zero/nonzero query controls.')
    elif blocked:
        lines.append('Next solver step is not implemented: residual coordinates + degree-22 oracle/boundary map.')
    elif not coordinate_stage:
        lines.append('The finite search has stopped. No Hilbert-coefficient worker is running.')
    for name, label in [('FK6', 'h23'), ('B6', 'b23')]:
        value = result.get(name, {})
        if 'lower' in value and 'upper' in value:
            lines.append(f'{label}: {value["lower"]:,} .. {value["upper"]:,} | gap {value["upper"]-value["lower"]:,}')
    if coordinate_stage:
        lines.append('Bounds stay unchanged until a new relation or independence witness is accepted.')
    else:
        lines.append(f'Last completed bound pass: gap reduced by {strategy.get("certifiedUpperReduction") or 0:,}; unresolved.')
    lines.append('')
    if coordinates:
        active = coordinates.get('live', False)
        phase = coordinates.get('stage', 'UNKNOWN')
        lines.append(paint(f'DEGREE-22 COORDINATES: {phase.replace("_", " ")} | {resource(coordinates.get("workerPID"))}', 'cyan' if active else 'yellow'))
        cp = coordinates.get('progress', {})
        lines.append(f'Sector 214356 | {coordinates.get("threads", 0)} threads | degree {cp.get("degree", coordinates.get("completedThrough", 16))} | source rows {cp.get("sourceRow", 0):,}/{cp.get("sourceRows", 0):,}')
        lines.append('Original 248-relation module maps; no new Hilbert value claimed by this reconstruction.')
        lines.append('')
    if q22:
        qp = q22.get('progress', {})
        active = q22.get('live', False)
        lines.append(paint(f'Q22 CENTRALITY: {"RUNNING" if active else "STOPPED"} | {resource(q22.get("numericPID"))}', 'cyan' if active else 'yellow'))
        phase = str(qp.get('activity', q22.get('stage', 'unknown'))).replace('_', ' ').lower()
        lines.append(f'{phase} | bank pivots {qp.get("pivotRows", 0):,} | target terms {qp.get("unresolvedQueryTerms", 0):,}')
        text, shade = motion('q22', (qp.get('rowCoefficientUpdates'), qp.get('normalizationSteps'), qp.get('pivotRows')), active)
        lines.append(paint(text + ' Centrality is unproved.', shade))
        lines.append('')
    if modular:
        mr = modular.get('result', {})
        if not isinstance(mr, dict):
            mr = {}
        mp = modular.get('progress', {})
        audit = modular.get('audit', {})
        discovery_live = bool(modular.get('live') and modular.get('stage') == 'UNPROJECTED_MODULAR_NEW_CONTEXT_DISCOVERY')
        lines.append(paint('Q22 MODULAR DISCOVERY: ' + ('RUNNING' if discovery_live else 'FINISHED'), 'cyan' if discovery_live else 'dim'))
        count = mr.get('newPivots', mp.get('newPivots', 0))
        zero = 'modular zero found; exact recovery required' if mr.get('modularZero') else 'no zero dependency found'
        lines.append(f'{count:,} new field pivots | {zero}. These do not change h23/b23 bounds.')
        audit_stage = audit.get('stage', '')
        if modular.get('live') and not discovery_live:
            lines.append(paint(f'Q22 REPLAY: RUNNING | {resource(modular.get("workerPID"))}', 'cyan'))
            if audit_stage == 'REPLAYING_EXACT_NEW_CONTEXT_IDENTITIES':
                rp = modular.get('sourceReplay', {})
                lines.append(f'Exact source identities: {rp.get("rows", 0):,}/{count:,} rows | {rp.get("exactRewriteSteps", 0):,} rewrite steps')
                counters = (audit_stage, rp.get('rows'), rp.get('exactRewriteSteps'))
            else:
                rp = modular.get('fieldReplay', {})
                lines.append(f'Field-operation replay: {rp.get("newRowsReplayed", 0):,}/{count:,} rows | {rp.get("coefficientUpdatesReplayed", 0):,} updates')
                counters = (audit_stage, rp.get('newRowsReplayed'), rp.get('coefficientUpdatesReplayed'))
            text, shade = motion('modular-replay', counters, True)
            lines.append(paint(text, shade))
        elif audit_stage in {'PREPARING_FIELD_REPLAY', 'REPLAYING_EXACT_NEW_CONTEXT_IDENTITIES', 'REPLAYING_FIELD_ROW_OPERATIONS'}:
            lines.append(paint('Q22 REPLAY: PREPARING NEXT CHECK', 'cyan'))
        elif not discovery_live:
            passed = modular.get('sourcesVerified', {}).get('passed') and modular.get('fieldVerified', {}).get('passed')
            label = 'PASSED' if passed else 'INCOMPLETE / CHECK RECEIPTS'
            lines.append(paint('Q22 REPLAY: ' + label, 'green' if passed else 'yellow'))
        lines.append('')
    if coxeter:
        lines.append(paint('Q22 NEW CONTEXT SEARCH: finite field; exact replay required', 'cyan'))
        for mode, lane in coxeter.items():
            stage = lane.get('stage', 'WAITING')
            lines.append(f"{mode}: {stage} | +{lane.get('newPivots', 0):,} pivots | remainder {lane.get('targetTerms', 0):,} terms | {resource(lane.get('pid'))}")
        lines.append('Remainder size is not percent completion. Centrality remains unproved.')
        lines.append('')
    if whitney:
        layers = whitney.get('progress', {}).get('layers', [])
        done = sum(x.get('completed', 0) for x in layers)
        total = sum(x.get('needed', 0) for x in layers)
        lines.append(paint(f"WHITNEY: {whitney.get('stage', 'UNKNOWN')} | target degree {whitney.get('degree', '?')} | {len(whitney.get('liveWorkers', []))} workers | GF(2)", 'cyan'))
        if whitney.get('manager') == 'HyperQueue':
            lines.append(f"HyperQueue job {whitney.get('hqJob', '?')} | task {whitney.get('hqTask', '?')}")
        lines.append(f'Dependency checkpoints {done:,}/{total:,}. Rational equality requires the separate sandwich certificate.')
        lines.append('')
    lines.append(f'Arithmetic processes: {len(resources)} | CPU {sum(v[0] for v in resources.values()):.0f}% | RAM {sum(v[1] for v in resources.values()) / 2**30:.1f} GiB')
    lines.append(f'Available RAM {available:.1f} GiB | free disk {disk_free:.1f} GiB | {time.strftime("%H:%M:%S")}')
    lines.append(paint('Refresh 1s | Ctrl-C closes only this UI; computation continues.', 'dim'))
    return lines


def show_dashboard(root, *, once=False, color='auto', search_log):
    root = root.expanduser()
    state = read(root / 'STATE.json')
    if 'active' in state and 'memoryGiBPerWorker' in state:
        return show_replays(root, once=once, color=color)
    tty = sys.stdout.isatty() and not once
    colors = color == 'always' or color == 'auto' and sys.stdout.isatty() and 'NO_COLOR' not in os.environ
    palette = {'green': 32, 'yellow': 33, 'red': 31, 'cyan': 36, 'dim': 90, 'bold': 1}

    def paint(text, key):
        return f'\033[{palette[key]}m{text}\033[0m' if colors else text

    logs, previous_cpu = {}, {}
    progress = RecentProgress()
    watches = {}
    gaps = AuditedGaps(root)
    if tty:
        print('\033[?1049h\033[2J\033[?25l', end='', flush=True)
    try:
        while True:
            now = time.time()
            state, result = read(root / 'STATE.json'), read(root / 'RESULT.json')
            result = apply_upper_overlay(root, result)
            gaps.observe(result, now)
            if not state:
                lines = [paint('KIRCRACKER | STATUS UNAVAILABLE', 'red'), str(root)]
            else:
                stage = state.get('stage', 'UNKNOWN')
                terminal = stage in {'PILOT_FINISHED', 'CONTROLLER_ERROR', 'FINISHED', 'UPPER_QUEUE_FINISHED', 'UPPER_STRATEGY_PAUSED', 'RESIDUAL_DEPENDENCY_REQUIRED'}
                strategy = upper_strategy(state)
                q22 = q22_status(root)
                modular = modular_discovery_status(root)
                coordinates = coordinate_reconstruction_status(root)
                coxeter = coxeter_discovery_status(root)
                whitney = whitney_status(root)
                heartbeat = now - state.get('updatedUnix', state.get('startedUnix', now))
                live, total_gain, rows = 0, 0, []
                minute_gain, minute_columns, active_audits = 0, 0, 0
                pending_ranks = 0
                progress_events = []
                total_rss, total_cpu = 0, 0
                activity_resources = {}
                latest_motion = []
                for task in state.get('tasks', []):
                    key = task['grade']
                    attempt = task.get('attempts', 0)
                    taskfile = Path(task.get('taskFile', root / 'attempts' / f'{key}-{attempt}.json'))
                    logpath, started = discovery_source(root, task)
                    token = (key, str(logpath), started)
                    if token not in logs:
                        logs[token] = search_log(logpath, key, started, EventSink())
                    log = logs[token]
                    log.update()
                    rank = max(task['savedRank'], log.rank or 0)
                    pending_ranks += max(0, rank - task['verifiedRank'])
                    progress.observe(key, log, rank, max(task.get('columnsScanned', 0), log.columns or 0), now)
                    gain, _ = progress.change(key, now, 600, 0)
                    columns, window = progress.change(key, now, 60, 1)
                    total_gain += gain
                    recent_gain, _ = progress.change(key, now, 60, 0)
                    minute_gain += recent_gain
                    minute_columns += columns
                    if log.last_gain and now - log.last_gain < 600:
                        progress_events.append((log.last_gain,
                            f'{key}: discovery rank {rank:,} | +{recent_gain:,} in last min', 'green'))
                    info = process(task.get('pid', 0), taskfile) if task.get('pid') else None
                    phase = task.get('phase', 'UNKNOWN')
                    is_audit = phase == 'AUDITING'
                    if is_audit:
                        phase = audit_phase(task)
                    cpu_text, memory_text = '-', '-'
                    if info:
                        live += 1
                        cpu_time, memory, elapsed = info
                        old = previous_cpu.get(task['pid'])
                        cpu = 100 * (cpu_time - old[1]) / max(now - old[0], .001) if old else 100 * cpu_time / elapsed
                        previous_cpu[task['pid']] = now, cpu_time
                        cpu_text, memory_text = f'{cpu:.0f}%', f'{memory / 2**30:.2f}'
                        total_cpu += cpu
                        total_rss += memory
                        activity_resources[task['pid']] = cpu, memory
                        if phase == 'DISCOVERY' and log.last_move:
                            latest_motion.append(log.last_move)
                    elif task.get('pid') and not terminal:
                        phase = 'EXITING'
                    scan = f'{columns / window:.1f}' if info and phase == 'DISCOVERY' and window else '-'
                    quiet = duration(now - log.last_gain) if info and phase == 'DISCOVERY' and log.last_gain else '-'
                    if task.get('checkpointAgeSeconds', 0) > now - state.get('startedUnix', now):
                        checkpoint = 'prior run'
                    else:
                        checkpoint = duration(task.get('checkpointAgeSeconds', 0) + max(0, heartbeat))
                    tint = 'cyan' if info else 'dim'
                    if is_audit:
                        tint = 'cyan'
                        active_audits += bool(info)
                    elif phase == 'DISCOVERY' and log.last_gain and now - log.last_gain > 300:
                        tint = 'yellow'
                    elif phase == 'DISCOVERY' and recent_gain:
                        tint = 'green'
                    text = (f'{key} {phase:10s} {rank:>8,d} {task["verifiedRank"]:>8,d} '
                            f'{gain:>6,d} {scan:>6s} {quiet:>6s} {cpu_text:>5s} {memory_text:>5s} {checkpoint:>9s}')
                    rows.append(paint(text, tint))
                own_pids = {t.get('pid') for t in state.get('tasks', []) if t.get('pid')}
                external = external_replays(root, own_pids)
                upper_pid = strategy.get('workerPID')
                if upper_pid and upper_pid not in own_pids and process(upper_pid):
                    external[upper_pid] = 'upper-bound'
                q22_pid = q22.get('numericPID') if q22.get('live') else None
                if q22_pid:
                    external[q22_pid] = 'Q22-centrality'
                if coordinates.get('live'):
                    external[coordinates['workerPID']] = 'degree22-coordinates'
                if modular.get('live'):
                    external[modular['workerPID']] = 'modular-context-discovery'
                for pid in whitney.get('liveWorkers', []):
                    external[pid] = 'Whitney-GF2'
                for mode, lane in coxeter.items():
                    if lane.get('live'):
                        external[lane['pid']] = 'Q22-' + mode
                for pid in external:
                    info = process(pid)
                    if not info:
                        continue
                    cpu_time, memory, elapsed = info
                    old = previous_cpu.get(pid)
                    cpu = 100 * (cpu_time - old[1]) / max(now - old[0], .001) if old else 100 * cpu_time / elapsed
                    previous_cpu[pid] = now, cpu_time
                    total_cpu += cpu
                    total_rss += memory
                    activity_resources[pid] = cpu, memory
                errors = state.get('errors', [])
                if stage == 'CONTROLLER_ERROR' or errors:
                    health, tint = 'CHECK ERRORS', 'red'
                elif stage == 'RESIDUAL_DEPENDENCY_REQUIRED':
                    health, tint = 'H23 NEEDS COORDINATE CERTIFICATE', 'yellow'
                elif stage == 'UPPER_QUEUE_FINISHED':
                    health, tint = 'BOUNDED QUEUE FINISHED', 'green' if strategy.get('certifiedUpperReduction') else 'yellow'
                elif stage == 'UPPER_STRATEGY_PAUSED':
                    health, tint = 'UPPER STRATEGY PAUSED', 'yellow'
                elif strategy and process(state.get('pid', 0)):
                    health, tint = 'CERTIFYING UPPER BOUNDS', 'cyan'
                elif terminal:
                    health, tint = 'PILOT FINISHED', 'green'
                elif heartbeat > 15 or not process(state.get('pid', 0)):
                    health, tint = 'STALE CONTROLLER', 'red'
                elif total_gain:
                    health, tint = 'ADVANCING', 'green'
                elif live and latest_motion and now - max(latest_motion) < 120:
                    health, tint = 'SCANNING', 'yellow'
                elif live:
                    health, tint = 'VERIFYING / FACTORING', 'cyan'
                else:
                    health, tint = 'WAITING FOR RESOURCES', 'yellow'
                mem = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())
                available = int(mem['MemAvailable'].split()[0]) / 2**20
                end = strategy.get('finishedUnix', now) if strategy else state.get('finishedUnix', now)
                began = strategy.get('startedUnix', state['startedUnix']) if strategy else state['startedUnix']
                remaining = state.get('pilotDiscoveryDeadlineUnix', now) - now
                degree = result.get('degree', 23)
                lines = [paint(f'KIRCRACKER degree {degree} | {health} | {stage} | {time.strftime("%H:%M:%S")}', tint),
                         f'Elapsed {duration(end - began)} | workers {live + len(external)}/{state.get("globalMathWorkerCeiling", state.get("maxWorkers", 5))} ({live} pairing + {len(external)} supporting) | CPU {total_cpu:.0f}%',
                         f'RAM {total_rss / 2**30:.1f} GiB workers / {available:.1f} GiB available | disk free {shutil.disk_usage(root).free / 2**30:.1f} GiB',
                         paint(f'Last 1 min: +{minute_gain:,} ranks, {minute_columns:,} columns | last 10 min: +{total_gain:,} ranks', 'green' if minute_gain else 'yellow'),
                         f'Audits active {active_audits + sum(pid not in {upper_pid, q22_pid} for pid in external)} | unverified rank gains {pending_ranks:,} | heartbeat {duration(heartbeat)} | errors {len(errors)}',
                         'Checkpointed continuation; no attempt-count cap' if state.get('continuousDiscovery')and not terminal else ('Discovery window remaining ' + duration(remaining) + '; independent audits may finish later') if remaining > 0 and not terminal else 'Discovery window closed; saved progress retained',
                         '', *gaps.lines(degree, now, paint),
                         '', paint('Grade  Phase          Rank  Audited   +10m  col/s  last+   CPU   GiB Checkpoint', 'bold'),
                         '-' * 90, *rows, '', paint('AUDITED BOUNDS', 'bold')]
                if strategy:
                    pending = strategy.get('screenProgress', {})
                    queue = f"Upper strategy: {strategy.get('profile', '-')} / sector {strategy.get('group', '-')} / {strategy.get('stage', '-')}"
                    lines.insert(6, paint(queue, 'cyan'))
                    detail = f"This strategy's certified gap reduction: {strategy.get('certifiedUpperReduction') or 0:,}"
                    if pending:
                        detail += f" | scanned {pending.get('words', 0):,} words | current-pass relations {pending.get('relationsCandidate', 0):,} awaiting replay"
                    symmetry = strategy.get('symmetryProgress', {})
                    if stage in {'BUILDING_PROVED_S5_RULES', 'NORMALIZING_PROVED17'} and symmetry:
                        if 'sourceCursor' in symmetry:
                            detail += (f" | source relations {symmetry['sourceCursor']:,}/{symmetry.get('sourceTotal', 0):,}"
                                       f" | candidate rules {symmetry.get('acceptedRelations', 0):,}; replay required")
                        else:
                            detail += f" | {symmetry.get('phase', '')}: {symmetry.get('rows', symmetry.get('sources', 0)):,}"
                    lines.insert(7, paint(detail, 'green' if strategy.get('certifiedUpperReduction') else 'cyan'))
                    if stage == 'RESIDUAL_DEPENDENCY_REQUIRED':
                        lines[5] = 'H23 unresolved: degree-22 Nichols coordinate oracle and boundary transport required.'
                    elif stage == 'UPPER_QUEUE_FINISHED':
                        lines[5] = 'H23 IDLE: finite strategy finished; coefficient remains unresolved.'
                    else:
                        lines[5] = 'Exhausted pairing pool preserved; bounded exact relation work is active.'
                    provenance = strategy.get('normalized17', {}) or {}
                    if provenance.get('passed'):
                        lines.insert(8, paint(
                            f"Rules independently replayed: {provenance.get('newFullyReduced17Rules', 0):,}"
                            f" | unknown source reductions: {provenance.get('sourceRelationsUnknown', 0):,}"
                            ' | no complete degree-17 basis claimed', 'cyan'))
                    if all(t.get('phase') == 'CANDIDATES_EXHAUSTED' for t in state.get('tasks', [])):
                        table = lines.index(paint('Grade  Phase          Rank  Audited   +10m  col/s  last+   CPU   GiB Checkpoint', 'bold'))
                        stop = lines.index(paint('AUDITED BOUNDS', 'bold'))
                        lines[table:stop] = [paint(
                            f"Historical pairing pools: {len(rows)} exhausted; audited checkpoints preserved.",
                            'dim'), '']
                if q22:
                    qp = q22.get('progress', {})
                    label = 'RUNNING' if q22.get('live') else q22.get('stage', 'UNKNOWN')
                    lines.insert(2, paint(
                        f"Q22 centrality: {label} | {q22.get('stage', 'UNKNOWN')}"
                        f" | pivots {qp.get('pivotRows', 0):,}"
                        f" | goal terms {qp.get('unresolvedQueryTerms', 0):,}"
                        ' | centrality unproved', 'cyan' if q22.get('live') else 'yellow'))
                if modular:
                    mp = modular.get('progress', {})
                    lines.insert(3, paint(
                        f"Modular contexts: {mp.get('phase', modular.get('stage', 'UNKNOWN'))}"
                        f" | seed {mp.get('seedRowsLoaded', 0):,}"
                        f" | new contexts {mp.get('newContextsAttempted', 0):,}"
                        f" | new pivots {mp.get('newPivots', 0):,}"
                        f" | remainder terms {mp.get('queryTerms', 0):,}"
                        ' | discovery only', 'cyan' if modular.get('live') else 'yellow'))
                for name, label in [('B6', f'b{degree}'), ('FK6', f'h{degree}')]:
                    value = result.get(name, {})
                    if 'lower' in value and 'upper' in value:
                        lines.append(f'{label}: {value["lower"]:,} .. {value["upper"]:,} | gap {value["upper"] - value["lower"]:,}')
                overlay = result.get('upperBoundOverlay')
                if overlay:
                    lines.append(paint('Bounds include a separately replayed upper certificate.', 'cyan'))
                if result.get('upperBoundOverlayError'):
                    lines.append(paint('Upper certificate rejected: ' + result['upperBoundOverlayError'], 'red'))
                lines += ['', paint('RECENT ACTIVITY', 'bold')]
                recent = []
                try:
                    with (root / 'events.jsonl').open('rb') as stream:
                        stream.seek(max(0, (root / 'events.jsonl').stat().st_size - 32768))
                        for raw in stream:
                            try:
                                event = json.loads(raw)
                            except ValueError:
                                continue
                            text = event.get('event', event.get('type', '?')).replace('_', ' ')
                            for name in ['grade', 'rank', 'candidateRank', 'nextColumn', 'cursor', 'exit']:
                                if name in event:
                                    text += f' | {name} {event[name]}'
                            stamp = event.get('unix', state['startedUnix'] + event.get('elapsedSeconds', 0))
                            kind = event.get('event', event.get('type', ''))
                            shade = 'green' if kind in {'block_verified', 'block_verified_minor_retained', 'block_reused'} else 'red' if kind in {'block_incomplete', 'controller_error'} else 'cyan' if kind == 'block_awaiting_audit' else 'dim'
                            recent.append((stamp, text, shade))
                except OSError:
                    pass
                recent.extend(progress_events)
                if strategy.get('finishedUnix'):
                    recent.append((strategy['finishedUnix'],
                        f"Upper strategy finished | certified gap reduction {strategy.get('certifiedUpperReduction') or 0:,}",
                        'green' if strategy.get('certifiedUpperReduction') else 'yellow'))
                for proof in result.get('proofs', []):
                    try:
                        audit = Path(proof['audit'])
                        stamp = audit.stat().st_mtime
                        recent.append((stamp, f'{audit.name.split(".")[0]}: independent audit passed | rank {proof["rank"]:,}', 'green'))
                    except (KeyError, OSError):
                        pass
                recent.sort(key=lambda event: event[0])
                lines += [paint(f'{time.strftime("%H:%M:%S", time.localtime(stamp))} ({duration(now - stamp)} ago)  {text}', shade)
                          for stamp, text, shade in recent[-3:]] or [paint('Waiting for the first controller event.', 'dim')]
                if errors:
                    lines += [paint(str(errors[-2:]), 'red')]
                lines += [paint('Green: rank gain / verified audit. Cyan: auditing. Yellow: scanning without recent rank gains.', 'dim'),
                          paint('Discovery ranks await independent audit. Audit ranks publish after a complete replay.', 'dim'),
                          paint('Refresh 1s | Ctrl-C closes only this UI; computation continues.', 'dim')]
                if not live and (str(stage).startswith('RESIDUAL_') or stage in {'UPPER_QUEUE_FINISHED', 'UPPER_STRATEGY_PAUSED'} and not upper_pid):
                    lines = compact_research_lines(
                        state, result, strategy, q22, modular, activity_resources,
                        available, shutil.disk_usage(root).free / 2**30,
                        now, watches, paint, coordinates=coordinates, coxeter=coxeter, whitney=whitney)
            if tty:
                print('\033[H' + '\n'.join(line + '\033[K' for line in lines) + '\033[J', flush=True)
            else:
                print('\n'.join(lines), flush=True)
            if once:
                return
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        if tty:
            print('\033[?25h\033[?1049l', end='', flush=True)
