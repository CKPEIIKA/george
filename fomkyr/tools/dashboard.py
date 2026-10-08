#!/usr/bin/env python3
"""Read-only Linux terminal dashboard for native Fomkyr telemetry."""
import argparse
from collections import deque
import json
import math
import os
from pathlib import Path
import re
import select
import shutil
import subprocess
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


ANSI = re.compile(r'\033\[[0-9;?]*[A-Za-z]')
SPARK = '▁▂▃▄▅▆▇█'
EIGHTHS = ' ▏▎▍▌▋▊▉'
ASCII = False


class Style:
    """ANSI colors with a plain fallback (NO_COLOR, pipes, --no-color)."""
    CODES = dict(red='31', green='32', yellow='33', blue='34', cyan='36', gray='90',
                 dim='2', bold='1')

    def __init__(self, enabled):
        self.enabled = enabled

    def __call__(self, text, *names):
        if not self.enabled or not names:
            return text
        return '\033[' + ';'.join(self.CODES[n] for n in names) + 'm' + text + '\033[0m'

    def chip(self, text, color):
        if not self.enabled:
            return f'[{text}]'
        return f"\033[1;7;{self.CODES[color]}m {text} \033[0m"

    def heat(self, fraction):
        return 'green' if fraction < 0.7 else 'yellow' if fraction < 0.9 else 'red'


def visible(text):
    return len(ANSI.sub('', text))


def clip(text, width):
    """Cut to a visible width without splitting escape sequences."""
    if visible(text) <= width:
        return text
    out, seen, pos = [], 0, 0
    for match in ANSI.finditer(text):
        for char in text[pos:match.start()]:
            if seen >= width:
                break
            out.append(char)
            seen += 1
        out.append(match.group())
        pos = match.end()
    for char in text[pos:]:
        if seen >= width:
            break
        out.append(char)
        seen += 1
    return ''.join(out) + ('\033[0m' if ANSI.search(text) else '')


def pad(text, width):
    text = clip(text, width)
    return text + ' ' * (width - visible(text))


def eta(seconds):
    if seconds is None:
        return '?'
    seconds = max(0, int(seconds))
    if seconds >= 100 * 3600:
        return '>99h'
    days, rest = divmod(seconds, 86400)
    hours, rest = divmod(rest, 3600)
    minutes, seconds = divmod(rest, 60)
    if days:
        return f'{days}d{hours:02}h'
    if hours:
        return f'{hours}h{minutes:02}m'
    return f'{minutes}m{seconds:02}s' if minutes else f'{seconds}s'


def bar(fraction, width, color, style):
    width = max(1, width)
    fraction = min(1.0, max(0.0, fraction))
    if ASCII:
        full = int(fraction * width)
        return style('#' * full, color) + style('-' * (width - full), 'gray')
    eighths = int(fraction * width * 8)
    full, part = divmod(eighths, 8)
    body = '█' * full + (EIGHTHS[part] if part and full < width else '')
    return style(body, color) + style('░' * (width - visible(body)), 'gray')


def spark(values, width, style, color='cyan', top=None):
    """Right-aligned sparkline; values are resampled to at most width cells."""
    values = [v for v in values if v is not None]
    if not values or width < 1:
        return ' ' * max(0, width)
    if len(values) > width:
        step = len(values) / width
        values = [sum(chunk) / len(chunk) for chunk in
                  (values[int(i * step):max(int(i * step) + 1, int((i + 1) * step))]
                   for i in range(width))]
    top = max(values) if top is None else top
    glyphs = '_.-^' if ASCII else SPARK
    cells = ''.join(glyphs[min(len(glyphs) - 1, int(max(0, v) / top * (len(glyphs) - 1) + 0.5))]
                    if top > 0 else glyphs[0] for v in values)
    return ' ' * (width - len(cells)) + style(cells, color)


# Current-degree throughput windows (seconds); None is the whole observed degree.
# All end now, so a long reduction lowers the rate rather than hiding the ETA.
WINDOWS = (120, 600, 1800, 7200, None)
LONG_WINDOW, MIN_SPAN, MIN_EVENTS = 600, 5, 8
LOG_STEP, LOG_CAP, SMOOTH = 10, 20000, 120
DEFICIT_WINDOW = 1800


class Tracker:
    """Rolling history that turns raw telemetry into rates and ETAs."""

    def __init__(self):
        self.reset()

    def reset(self):
        self.samples = deque(maxlen=7200)
        self.degree_times = {}
        self.degree = None
        self.degree_start = None
        self.degree_start_known = False
        self.last_move = None
        self.last_resolved = None
        self.degree_log = []
        self.deficit_log = []
        self.smooth = None

    def seed_log(self, now, status, path):
        """Read existing human progress so opening the dashboard retains its ETA."""
        degree = (status.get('progress') or {}).get('degree', status.get('currentDegree'))
        session = status.get('sessionElapsedSeconds')
        if not path or not isinstance(session, (int, float)):
            return
        try:
            with Path(path).open('rb') as stream:
                stream.seek(max(0, Path(path).stat().st_size - 4 * 1048576))
                text = stream.read().decode(errors='replace')
        except OSError:
            return
        # An appended log may contain older sessions. Only the last native start
        # and matching active degree contribute to this process's estimate.
        starts = list(re.finditer(r'^Fomkyr .*native C;', text, re.M))
        if starts:
            text = text[starts[-1].start():]
        points, stamp = [], None
        for line in text.splitlines():
            match = re.search(r'Degree (\d+): .*Elapsed: ([\d.]+) s', line)
            if match:
                stamp = float(match[2]) if int(match[1]) == degree else None
            match = re.search(r'FK6 degree (\d+): .*dimension deficit (\d+)', line)
            if match and int(match[1]) == degree and stamp is not None and 0 <= stamp <= session:
                point = (now - session + stamp, int(match[2]))
                if points and (point[0] < points[-1][0] or point[1] > points[-1][1]):
                    points = []
                if points and point[0] == points[-1][0]:
                    points[-1] = point
                else:
                    points.append(point)
        self.deficit_log = points[-LOG_CAP:]

    def update(self, now, status, sample, cpu):
        progress = status.get('progress') or {}
        degree = progress.get('degree', status.get('currentDegree'))
        resolved = progress.get('resolvedOverlaps')
        elapsed = status.get('cumulativeElapsedSeconds', 0)
        if degree is not None and degree != self.degree:
            if self.degree is not None and self.degree_start_known:
                self.degree_times[self.degree] = max(0.0, elapsed - self.degree_start)
            previous_degree = self.degree
            self.degree, self.degree_start = degree, elapsed
            # A degree seen from its start (or entered while watching) has a known duration.
            self.degree_start_known = previous_degree is not None or not resolved
            self.last_resolved = None
            self.degree_log, self.smooth = [], None
            self.deficit_log = []
        if resolved != self.last_resolved:
            self.last_resolved, self.last_move = resolved, now
        if self.last_move is None:
            self.last_move = now
        # A coarse log of the whole degree outlives the fine sample window.
        if resolved is not None and (not self.degree_log or now - self.degree_log[-1][0] >= LOG_STEP):
            self.degree_log.append((now, resolved))
            if len(self.degree_log) > LOG_CAP:
                self.degree_log = self.degree_log[::2]
        gate = status.get('fkGate') or {}
        deficit = gate.get('deficit') if gate.get('degree') == degree and status.get('fkGateEnabled') else None
        if deficit is not None:
            if self.deficit_log and deficit > self.deficit_log[-1][1]:
                self.deficit_log = []
            if not self.deficit_log or now - self.deficit_log[-1][0] >= LOG_STEP:
                self.deficit_log.append((now, deficit))
                if len(self.deficit_log) > LOG_CAP:
                    self.deficit_log = self.deficit_log[::2]
        self.samples.append(dict(
            t=now, degree=degree, resolved=resolved, total=progress.get('totalOverlaps'),
            rewrites=progress.get('sampledRewrites', 0), cpu=cpu,
            rss=sample.get('rss') if sample else None,
            alloc=status.get('allocatedBytes'), closed=gate.get('closedSectors'),
            deficit=deficit))

    def finish(self, status):
        """Record the final degree's duration once the solver reports the end."""
        if self.degree is not None and self.degree_start_known and self.degree not in self.degree_times:
            self.degree_times[self.degree] = max(0.0, status.get('cumulativeElapsedSeconds', 0) - self.degree_start)

    def current(self):
        return [s for s in self.samples if s['degree'] == self.degree]

    def points(self):
        fine = [(s['t'], s['resolved']) for s in self.current() if s['resolved'] is not None]
        start = fine[0][0] if fine else float('inf')
        return [p for p in self.degree_log if p[0] < start] + fine

    def window(self, now, window):
        """(elapsed seconds, finished overlaps) since the window start, up to now."""
        points = self.points()
        if not points:
            return None
        since = now - window if window else -float('inf')
        first = next((p for p in points if p[0] >= since), points[0])
        return now - first[0], max(0, points[-1][1] - first[1])

    def rate(self, now, window):
        found = self.window(now, window)
        if not found or found[0] <= 0 or found[1] <= 0:
            return None
        return found[1] / found[0]

    def window_rates(self, now):
        rates, seen = [], set()
        for window in WINDOWS:
            found = self.window(now, window)
            if not found or found in seen:
                continue
            seen.add(found)
            elapsed, done = found
            if elapsed >= MIN_SPAN and done >= MIN_EVENTS:
                rates.append((window, elapsed, done / elapsed))
        return rates

    def degree_eta(self, now, remaining):
        """(low, mid, high) seconds for the current degree, or None.

        The central rate is the median over long windows (or all when the
        degree is young), smoothed in log space; the range covers all windows."""
        rates = self.window_rates(now)
        if not rates or remaining is None:
            return None
        long = [r for window, _, r in rates if window is None or window >= LONG_WINDOW]
        values = sorted(long or [r for _, _, r in rates])
        central = values[len(values) // 2]
        if self.smooth is None:
            self.smooth = (now, math.log(central))
        else:
            t, value = self.smooth
            a = 1 - math.exp(-max(0, now - t) / SMOOTH)
            self.smooth = (now, value + a * (math.log(central) - value))
        mid = remaining / math.exp(self.smooth[1])
        every = [r for _, _, r in rates]
        return min(mid, remaining / max(every)), mid, max(mid, remaining / min(every))

    def observed(self, now):
        """Longest throughput window behind the current ETA, in seconds."""
        rates = self.window_rates(now)
        return max(elapsed for _, elapsed, _ in rates) if rates else None

    def deficit_eta(self, now, deficit):
        """Remaining deficit / its arithmetic mean decrease per second.

        Prefer the last 30 minutes; use available history for a younger session.
        Idle intervals remain in the denominator. The range compares 10, 20 and
        30 minute averages and is a sensitivity range, not a confidence interval.
        """
        fine = [(s['t'], s['deficit']) for s in self.current() if s['deficit'] is not None]
        start = fine[0][0] if fine else float('inf')
        points = [p for p in self.deficit_log if p[0] < start] + fine
        if deficit == 0:
            return (0, 0, 0), None, None
        if not points:
            return None, None, None
        rates = []
        for window in (600, 1200, DEFICIT_WINDOW):
            first = next((p for p in points if p[0] >= now - window), points[0])
            elapsed, drop = now - first[0], first[1] - deficit
            if elapsed >= MIN_SPAN and drop >= MIN_EVENTS:
                rates.append((window, elapsed, drop / elapsed))
        if not rates:
            observed = now - max(points[0][0], now - DEFICIT_WINDOW)
            return None, observed, 0 if observed >= MIN_SPAN and points[0][1] == deficit else None
        _, observed, average = rates[-1]
        mid = deficit / average
        estimates = [deficit / rate for _, _, rate in rates]
        return (min(estimates), mid, max(estimates)), observed, average

    def series(self, key, now, seconds=1e9):
        return [s[key] for s in self.samples if now - s['t'] <= seconds]

    def rate_series(self):
        out, previous = [], None
        for s in self.samples:
            if previous and s['degree'] == previous['degree'] and s['resolved'] is not None \
                    and previous['resolved'] is not None and s['t'] > previous['t']:
                out.append(max(0, s['resolved'] - previous['resolved']) * 60 / (s['t'] - previous['t']))
            elif previous:
                out.append(0)
            previous = s
        return out

    def memory_hit(self, now, budget):
        points = [s for s in self.samples if now - s['t'] <= 300 and s['alloc'] is not None]
        if budget is None or len(points) < 10 or points[-1]['t'] - points[0]['t'] < 30:
            return None
        slope = (points[-1]['alloc'] - points[0]['alloc']) / (points[-1]['t'] - points[0]['t'])
        left = budget - points[-1]['alloc']
        return left / slope if slope > 1024 and 0 <= left / slope < 86400 else None

    def projection(self, now, current_eta, remaining_degrees, elapsed_in_degree):
        """Rough overall ETA: extrapolate the per-degree time growth ratio."""
        times = [self.degree_times[k] for k in sorted(self.degree_times)]
        projected = None
        if current_eta is not None and self.degree_start_known:
            projected = elapsed_in_degree + current_eta
            times.append(projected)
        ratios = [b / a for a, b in zip(times, times[1:]) if a > 1]
        if current_eta is None or not ratios:
            return None
        ratios = sorted(ratios[-3:])
        ratio = max(1.0, ratios[len(ratios) // 2])
        last, total = times[-1], current_eta
        for _ in range(max(0, remaining_degrees)):
            last *= ratio
            total += last
        return total, ratio


def health(status, process, memory, tracker, now, wall=None):
    issues = []
    state = status.get('state')
    if process is None and state in ('starting', 'running'):
        issues.append(('red', 'process ended (showing last saved sample)'))
    wall = time.time() if wall is None else wall
    age = max(0, wall - status.get('updatedUnixSeconds', wall))
    if process is not None and age > 5:
        issues.append(('red' if age > 20 else 'yellow', f'status not updating for {age:.0f}s'))
    if process and process.get('swap'):
        issues.append(('yellow', f"swapping {size(process['swap'])}"))
    budget, alloc = status.get('budgetBytes'), status.get('allocatedBytes')
    if budget and alloc and alloc / budget > 0.9:
        issues.append(('yellow', f'workspace at {alloc / budget:.0%} of budget'))
    if memory.get('MemAvailable') is not None and memory.get('MemTotal') and \
            memory['MemAvailable'] / memory['MemTotal'] < 0.05:
        issues.append(('red', 'host memory nearly exhausted'))
    if process is not None and state == 'running' and tracker and tracker.last_move is not None:
        idle = now - tracker.last_move
        recent = [s['cpu'] for s in list(tracker.samples)[-10:] if s['cpu'] is not None]
        busy = bool(recent) and sum(recent) / len(recent) > 50
        if idle > 60 and busy:
            issues.append(('cyan', f'no overlap finished for {eta(idle)}: big row in progress'))
        elif idle > 60 and recent:
            issues.append(('red', f'STALLED: no progress for {eta(idle)} and CPU idle'))
    cp = status.get('checkpointAgeSeconds', 0)
    if state == 'running' and cp > 600:
        issues.append(('yellow', f'last checkpoint {eta(cp)} ago'))
    return issues


def analyse(status, process, memory, tracker, now):
    """Numbers shared by every layout."""
    progress = status.get('progress') or {}
    degree = progress.get('degree', status.get('currentDegree'))
    done = progress.get('completedThroughDegree', status.get('completedThroughDegree'))
    target = status.get('targetDegree') or None
    resolved, total = progress.get('resolvedOverlaps'), progress.get('totalOverlaps')
    fraction = resolved / total if resolved is not None and total else None
    remaining = total - resolved if fraction is not None else None
    finished = status.get('state') == 'complete'
    info = dict(progress=progress, degree=degree, done=done, target=target, resolved=resolved,
                total=total, fraction=fraction, remaining=remaining, finished=finished,
                eta=None, eta_basis='overlaps', deficit_rate=None, overall=None,
                elapsed_in_degree=None, overall_fraction=None)
    if tracker and status.get('state') == 'running' and process is not None:
        gate = status.get('fkGate') or {}
        if status.get('fkGateEnabled') and gate.get('degree') == degree and gate.get('deficit') is not None:
            info['eta_basis'] = 'deficit'
            info['eta'], info['observed'], info['deficit_rate'] = tracker.deficit_eta(now, gate['deficit'])
        else:
            info['eta'] = tracker.degree_eta(now, remaining)
            info['observed'] = tracker.observed(now)
        if tracker.degree_start_known and tracker.degree == degree:
            info['elapsed_in_degree'] = max(0.0, status.get('cumulativeElapsedSeconds', 0)
                                            - tracker.degree_start)
        if info['eta'] and target and isinstance(degree, int):
            info['overall'] = tracker.projection(now, info['eta'][1], target - degree,
                                                 info['elapsed_in_degree'] or 0)
    if finished:
        info['overall_fraction'] = 1.0
    elif info['overall']:
        # Time-based: degree counts mislead because later degrees take far longer.
        spent = status.get('cumulativeElapsedSeconds', 0)
        info['overall_fraction'] = spent / (spent + info['overall'][0]) if spent + info['overall'][0] else None
    elif target and isinstance(done, int):
        info['overall_fraction'] = min(1.0, (done + (fraction or 0)) / target) if \
            isinstance(degree, int) and degree > done else min(1.0, done / target)
    return info


def header_lines(status, process, info, style, width, wall=None):
    state = status.get('state', 'unknown')
    alive = process is not None
    if not alive and state in ('starting', 'running'):
        label, color = 'ENDED', 'red'
    else:
        label, color = state.upper(), {'running': 'green', 'complete': 'cyan', 'starting': 'yellow',
                                       'stopped': 'yellow'}.get(state, 'gray')
    wall = time.time() if wall is None else wall
    now_age = max(0, wall - status.get('updatedUnixSeconds', wall))
    line = (style.chip(label, color) + style('  FOMKYR', 'bold')
            + f"  PID {status.get('pid', '?')}  elapsed {duration(status.get('cumulativeElapsedSeconds'))}"
            + style(f"  session {duration(status.get('sessionElapsedSeconds'))}"
                    f"  age {now_age:.1f}s", 'gray'))
    return [line, style('─' * width if not ASCII else '-' * width, 'gray')]


def progress_block(status, info, style, width, now_wall):
    degree, target = info['degree'], info['target']
    degree_text = f"degree {degree}/{target}" if target else f"degree {degree}"
    wbar = max(8, min(50, width - 46))
    lines = []
    overall = info['overall_fraction']
    line = style('Overall ', 'bold') + (bar(overall, wbar, 'blue', style) + f' {overall:5.1%}'
                                         if overall is not None else '(target unknown)')
    line += '  ' + degree_text
    if info['overall']:
        total, ratio = info['overall']
        finish = time.strftime('%a %H:%M', time.localtime(now_wall + total))
        line += '  ' + style(f'ETA ~{eta(total)}', 'bold', 'cyan') + style(f' (≈{finish}; rough, ×{ratio:.2f}/deg)', 'gray')
    elif info['finished']:
        line += '  ' + style('done', 'green')
    lines.append(line)
    if info['fraction'] is not None:
        line = style(f'Degree {degree}'.ljust(7) + ' ', 'bold') + bar(info['fraction'], wbar, 'green', style) \
            + f" {info['fraction']:5.1%}  {info['resolved']:,}/{info['total']:,} overlaps"
        if info['eta'] and info['eta_basis'] == 'overlaps':
            low, mid, high = info['eta']
            line += '  ' + style(f'ETA ~{eta(mid)}', 'bold', 'cyan')
            if high > low * 1.2:
                line += style(f' ({eta(low)}–{eta(high)})', 'gray')
            if info.get('observed'):
                line += style(f" · {eta(info['observed'])} observed", 'gray')
        lines.append(line)
    elif info['progress'] == {}:
        lines.append(style('Degree progress appears once the solver starts reducing.', 'gray'))
    gate = status.get('fkGate')
    if gate:
        closed, sectors = gate.get('closedSectors', 0), gate.get('totalSectors', 360)
        lines.append(style('FK gate ', 'bold') + bar(closed / sectors if sectors else 0, wbar, 'cyan', style)
                     + f" {closed}/{sectors} components   deficit {gate.get('deficit', 0):,}")
        if info['eta_basis'] == 'deficit':
            if info['eta']:
                low, mid, high = info['eta']
                line = style(f'ETA ~{eta(mid)}', 'bold', 'cyan')
                if high > low * 1.2:
                    line += style(f' ({eta(low)}–{eta(high)})', 'gray')
                lines.append(line + style(' · deficit average', 'gray'))
                if info['deficit_rate'] is not None:
                    lines.append(f"  {info['deficit_rate'] * 60:.1f}/min over {eta(info['observed'])}; rough estimate")
            else:
                lines.append(style('ETA unavailable: deficit not decreasing' if info['deficit_rate'] == 0
                                   else 'ETA: collecting deficit history', 'gray'))
    return lines


def trend_arrow(values, style, good_down=True):
    values = [v for v in values if v is not None]
    if len(values) < 5 or values[0] == values[-1]:
        return ''
    down = values[-1] < values[0]
    arrow = ('v' if ASCII else '▼') if down else ('^' if ASCII else '▲')
    return ' ' + style(arrow, 'green' if down == good_down else 'red')


def health_block(issues, style):
    if not issues:
        return [style(('+' if ASCII else '✔') + ' healthy', 'green')]
    return [style(('!' if ASCII else '▲') + ' ' + text, color) for color, text in issues]


def memory_block(status, process, memory, tracker, style, width, now):
    wbar = max(8, min(40, width - 44))
    budget, alloc = status.get('budgetBytes'), status.get('allocatedBytes')
    lines = []
    if budget:
        fraction = (alloc or 0) / budget
        line = style('Budget  ', 'bold') + bar(fraction, wbar, style.heat(fraction), style) \
            + f' {fraction:5.1%}  {size(alloc)} / {size(budget)}'
        hit = tracker.memory_hit(now, budget) if tracker else None
        if hit is not None:
            line += style(f'  full in ~{eta(hit)}', 'yellow')
        lines.append(line)
    rss = process.get('rss') if process else None
    swap = process.get('swap') if process else None
    avail, total = memory.get('MemAvailable'), memory.get('MemTotal')
    line = style('RAM     ', 'bold') + f'resident {size(rss)}   swap ' \
        + style(size(swap), 'yellow' if swap else 'gray')
    if avail is not None and total:
        used = 1 - avail / total
        line += f'   host free {size(avail)}/{size(total)} ' + style(f'({used:.0%} used)', style.heat(used))
    lines.append(line)
    return lines


def cpu_block(status, process, cpu, threads, tracker, style, width, now):
    if cpu is None:
        return [style('CPU     ', 'bold') + ('sampling…' if process else 'process ended')]
    workers = (status.get('progress') or {}).get('workers', status.get('workers')) or 1
    load = cpu / 100 / workers if isinstance(workers, int) else 0
    line = style('CPU     ', 'bold') + style(f'{cpu:4.0f}%', 'green' if load > 0.6 else 'yellow' if load > 0.3 else 'red') \
        + f' ({cpu / 100:.1f}/{workers} cores)'
    spark_width = max(0, min(60, width - visible(line) - 3))
    if spark_width >= 8:
        line += '  ' + spark(tracker.series('cpu', now, 300) if tracker else [], spark_width, style, top=max(100, cpu))
    lines = [line]
    if threads:
        cells = ''.join(style((SPARK if not ASCII else '_.-^')[min(3 if ASCII else 7, int(v / 100 * (3 if ASCII else 7) + 0.5))],
                              'green' if v > 60 else 'yellow' if v > 20 else 'gray')
                        for _, v in sorted(threads))
        lines.append(style('Threads ', 'bold') + cells + style(f'  busiest {threads[0][1]:.0f}%', 'gray'))
    return lines


def plots_block(info, tracker, style, width, now):
    if not tracker or len(tracker.samples) < 3:
        return [style('Plots appear after a few samples.', 'gray')]
    w = max(10, min(70, width - 26))
    lines = []
    rates = tracker.rate_series()
    if rates:
        current = rates[-1] if rates else 0
        lines.append(style('overlaps/min ', 'bold') + spark(rates, w, style, 'green')
                     + f' {current:,.0f}' + trend_arrow(rates[-30:], style, good_down=False))
    alloc = [v for v in tracker.series('alloc', now) if v is not None]
    if alloc:
        lines.append(style('workspace    ', 'bold') + spark(alloc, w, style, 'yellow', top=max(alloc) or 1)
                     + f' {size(alloc[-1])}' + trend_arrow(alloc[-30:], style, good_down=True))
    deficit = [v for v in tracker.series('deficit', now) if v is not None]
    if deficit and max(deficit) > 0:
        lines.append(style('FK deficit   ', 'bold') + spark(deficit, w, style, 'cyan', top=max(deficit))
                     + f' {deficit[-1]:,}' + trend_arrow(deficit[-30:], style, good_down=True))
    return lines


def degree_chart(info, tracker, style, width, rows):
    if not tracker:
        return []
    times = dict(tracker.degree_times)
    current = info['degree']
    projected = None
    if info['eta'] and info['elapsed_in_degree'] is not None:
        projected = info['elapsed_in_degree'] + info['eta'][1]
    if not times and projected is None:
        return []
    top = max(list(times.values()) + [projected or 0, 1])
    wbar = max(8, min(50, width - 22))
    lines = [style('Time per degree', 'bold')]
    items = [(k, times[k], None) for k in sorted(times)]
    if projected is not None:
        items.append((current, info['elapsed_in_degree'], projected))
    for key, value, proj in items[-max(1, rows - 1):]:
        shown = proj if proj is not None else value
        row = f'  d{key:<3}' + bar(value / top, wbar, 'blue' if proj is None else 'green', style)
        if proj is not None:
            row = f'  d{key:<3}' + bar(value / top, wbar, 'green', style)
            row += style(f' {eta(value)} → ~{eta(proj)}', 'gray')
        else:
            row += f' {eta(value)}'
        lines.append(row)
    return lines[:rows]


def lanes_block(progress, style, width, rows):
    lanes = progress.get('lanes', [])
    if not lanes or rows < 2:
        return []
    header = style('Lane  Pair / commit     Terms        Capacity  Coeff MiB used/pool', 'bold')
    lanes = sorted(lanes, key=lambda r: r.get('activeTerms', 0), reverse=True)
    shown = lanes[:max(0, rows - 1 - (1 if len(lanes) > rows - 1 else 0))]
    top = max([r.get('activeTerms', 0) for r in lanes] + [1])
    lines = [header]
    for row in shown:
        big = row.get('bigRow', {})
        pair = f"{row['leftRule']}/{row['rightRule']}" if 'leftRule' in row else f"commit {row.get('batchTask', '?')}"
        terms = row.get('activeTerms', 0)
        text = (f"{row['lane']:>4}  {pair:<16} {terms:>12,} {big.get('capacity', 0):>13,}"
                f"  {big.get('coefficientPoolUsedBytes', 0)/(1<<20):>7.1f} / {big.get('coefficientPoolBytes', 0)/(1<<20):.1f}")
        lines.append(style(text, 'gray') if not terms else
                     style(text, 'yellow') if terms == top and len(lanes) > 1 and terms > 1e6 else text)
    if len(shown) < len(lanes):
        lines.append(style(f'  +{len(lanes) - len(shown)} more lanes', 'gray'))
    return lines


def details_block(status, progress, style):
    return [
        f"Scratch {size(status.get('ordinaryScratchBytes'))}   reserve/row {size(status.get('rowReserveBytes'))}"
        f"   shared cache {size(status.get('sharedCacheUsedBytes'))}/{size(status.get('sharedCacheBytes'))}",
        f"Large reserves: {progress.get('activeLargeRowWorkspaces', status.get('activeLargeRowWorkspaces', '-'))} active"
        f" / {progress.get('largeRowWorkspaces', status.get('largeRowWorkspaces', '-'))} admitted"
        f"   parked rows: {progress.get('parkedReductions', '-')}",
        f"Basis {status.get('basisSize', 0):,} rules   disk {size(status.get('diskBytes'))}"
        f"   checkpoint #{status.get('checkpointSequence', '?')} ({status.get('checkpointAgeSeconds', 0):.0f}s ago)",
        'Assistance: external total=' + ('on' if status.get('hilbertAssumed') else 'off')
        + '  FK gate=' + ('on' if status.get('fkGateEnabled') else 'off')
        + '  components=' + ('on' if status.get('fkSectorsEnabled') else 'off')]


def fit(blocks, rows, width):
    """blocks: (priority, order, make(rows)->lines). Keep best-priority ones that fit."""
    chosen, left = {}, rows
    for priority, order, make in sorted(blocks, key=lambda b: b[0]):
        natural = make(max(left, 0))
        if natural and len(natural) <= left:
            chosen[order] = natural
            left -= len(natural)
    return [line for order in sorted(chosen) for line in chosen[order]]


def finish_screen(status, tracker, style, width, height, details):
    """The summary shown once the solver has finished or stopped."""
    ok = status.get('state') == 'complete'
    done, target = status.get('completedThroughDegree'), status.get('targetDegree') or None
    elapsed = status.get('cumulativeElapsedSeconds', 0)
    reached = f'degree {done} of {target}' if target else f'degree {done}'
    if ok:
        glyphs, colors = ('*+.' if ASCII else '✦✧·'), ('yellow', 'cyan', 'green', 'blue')
        confetti = ' '.join(style(glyphs[i % len(glyphs)], colors[i % len(colors)]) for i in range(max(4, min(36, width // 2 - 1))))
        lines = [style.chip('COMPLETE', 'green') + style('  FOMKYR', 'bold') + '  ' + style('Calculation finished!', 'bold', 'green'),
                 confetti,
                 style('✔ ' if not ASCII else '+ ', 'green') + style(f'Reached {reached}', 'bold') + f' in {duration(elapsed)}']
    else:
        lines = [style.chip('STOPPED', 'yellow') + style('  FOMKYR', 'bold') + '  ' + style('Calculation stopped.', 'bold', 'yellow'),
                 style('─' * width if not ASCII else '-' * width, 'gray'),
                 f'Completed {reached} in {duration(elapsed)}; resuming continues from the last checkpoint.']
    budget = status.get('budgetBytes')
    peaks = [s['alloc'] for s in (tracker.samples if tracker else []) if s.get('alloc') is not None] + [status.get('allocatedBytes') or 0]
    lines += ['',
              f"  Basis       {status.get('basisSize', 0):,} rules   disk {size(status.get('diskBytes'))}"
              f"   checkpoints {status.get('checkpointSequence', 0)}",
              f'  Workspace   peak {size(max(peaks))}' + (f' of {size(budget)}' if budget else '')
              + f"   workers {status.get('workers', '?')}"]
    times = dict(tracker.degree_times) if tracker else {}
    if times:
        slowest = max(times, key=times.get)
        lines.append(f'  Watched     {len(times)} degree(s); slowest d{slowest} {eta(times[slowest])}')
        top, wbar = max(times.values()) or 1, max(8, min(40, width - 24))
        lines += [''] + [style('Time per degree', 'bold')] + [
            f'  d{k:<3}' + bar(times[k] / top, wbar, 'green' if ok else 'blue', style) + f' {eta(times[k])}'
            for k in sorted(times)[-max(1, height - len(lines) - 8):]]
    if details:
        lines += [''] + details_block(status, {}, style)
    footer = style(f"q quit  d details {'on' if details else 'off'}", 'gray')
    lines = lines[:max(1, height - 2)] + ['', footer]
    return '\n'.join(clip(line, width) for line in lines[:max(1, height - 1)])


def render(status, process, memory, tracker=None, width=100, height=40, style=None,
           cpu=None, threads=(), now=None, details=False, wall=None):
    style = style or Style(False)
    if status.get('state') in ('complete', 'stopped') and process is None:
        return finish_screen(status, tracker, style, width, height, details)
    now = time.monotonic() if now is None else now
    wall = time.time() if wall is None else wall
    info = analyse(status, process, memory, tracker, now)
    progress = info['progress']
    issues = health(status, process, memory, tracker, now, wall)
    rows = height - 1
    if rows < 6 or width < 60:                       # compact: the answer in two lines
        overall, fraction = info['overall_fraction'], info['fraction']
        parts = [style.chip(status.get('state', '?').upper(), 'red' if issues and issues[0][0] == 'red' else 'green'),
                 f"d{info['degree']}/{info['target'] or '?'}"]
        if overall is not None:
            parts.append(f'{overall:.0%}')
        if info['overall']:
            parts.append('ETA ~' + eta(info['overall'][0]))
        lines = [' '.join(parts)]
        if fraction is not None:
            lines.append(f"deg {fraction:.0%}" + (f" {info['eta_basis']} ~{eta(info['eta'][1])}" if info['eta'] else '')
                         + (f" cpu {cpu:.0f}%" if cpu is not None else ''))
        return '\n'.join(clip(line, width) for line in lines[:max(1, rows)])
    top = header_lines(status, process, info, style, width, wall)
    two = width >= 110 and rows >= 22
    colw = (width - 3) // 2 if two else width
    left_blocks = [
        (0, 0, lambda r: progress_block(status, info, style, colw, wall)),
        (1, 1, lambda r: health_block(issues, style)),
        (4, 3, lambda r: plots_block(info, tracker, style, colw, now)),
        (6, 4, lambda r: degree_chart(info, tracker, style, colw, min(r, 9))),
    ]
    right_blocks = [
        (2, 0, lambda r: memory_block(status, process, memory, tracker, style, colw, now)),
        (3, 1, lambda r: cpu_block(status, process, cpu, threads, tracker, style, colw, now)),
        (7, 3, lambda r: lanes_block(progress, style, colw, r)),
    ]
    if details:
        right_blocks.append((1.5, 2, lambda r: details_block(status, progress, style)))
    body_rows = rows - len(top) - 1
    if two:
        left = fit(left_blocks, body_rows, colw)
        right = fit(right_blocks, body_rows, colw)
        sep = style(' │ ' if not ASCII else ' | ', 'gray')
        lines = [pad(a, colw) + sep + b for a, b in
                 zip(left + [''] * (max(len(left), len(right)) - len(left)),
                     right + [''] * (max(len(left), len(right)) - len(right)))]
    else:
        lines = fit(left_blocks + [(p + 0.5, o + 10, m) for p, o, m in right_blocks], body_rows, width)
    footer = style(f"q quit  d details {'on' if details else 'off'}  p pause  │  closing leaves the calculation running", 'gray')
    out = top + lines
    if rows - len(out) >= 1:
        out.append(footer)
    return '\n'.join(clip(line, width) for line in out[:rows])


def keypress(timeout):
    # Read the descriptor directly: Python's buffered stdin can hold a second
    # key where select() no longer sees it.
    try:
        ready, _, _ = select.select([sys.stdin.fileno()], [], [], timeout)
        return os.read(sys.stdin.fileno(), 1).decode(errors='ignore') if ready else None
    except (OSError, ValueError):
        time.sleep(timeout)
        return None


def announce(status):
    """Bell, window title and (when available) a desktop notification."""
    ok = status.get('state') == 'complete'
    text = (f"Reached degree {status.get('completedThroughDegree')} in {duration(status.get('cumulativeElapsedSeconds'))}"
            if ok else f"Stopped after degree {status.get('completedThroughDegree')}")
    sys.stdout.write('\a\033]0;fomkyr: ' + ('complete' if ok else 'stopped') + '\007')
    sys.stdout.flush()
    notify = shutil.which('notify-send')
    if notify:
        try:
            subprocess.Popen([notify, 'fomkyr ' + ('finished' if ok else 'stopped'), text],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except OSError:
            pass


def main():
    global ASCII
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('status', nargs='?', help='job directory or telemetry JSON file')
    parser.add_argument('--once', action='store_true', help='print one snapshot and exit')
    parser.add_argument('--interval', type=float, default=1, help='refresh seconds (default 1)')
    parser.add_argument('--color', action='store_true', help='force ANSI colors even when piped')
    parser.add_argument('--no-color', action='store_true', help='plain text (also honors NO_COLOR)')
    parser.add_argument('--ascii', action='store_true', help='avoid Unicode block characters')
    parser.add_argument('--no-bell', action='store_true', help='no bell, title or desktop notice when the run ends')
    parser.add_argument('--log', help='native --human progress log to seed the deficit average immediately')
    args = parser.parse_args()
    if args.interval < 0.1:
        parser.error('interval must be at least 0.1 seconds')
    path = resolve_status(args.status)
    ASCII = args.ascii or 'utf' not in (sys.stdout.encoding or '').lower()
    tty = sys.stdout.isatty() and not args.once
    colors = args.color or (sys.stdout.isatty() and not os.environ.get('NO_COLOR')
                            and os.environ.get('TERM') != 'dumb')
    style = Style(colors and not args.no_color)
    tracker, last_pid = Tracker(), None
    previous = None
    details, paused, last_screen = args.once, False, ''
    last_state, last_inputs = None, None
    hz = os.sysconf('SC_CLK_TCK')
    keys = tty and sys.stdin.isatty()
    saved = None
    try:
        if keys:
            import termios, tty as ttymod
            saved = termios.tcgetattr(sys.stdin)
            ttymod.setcbreak(sys.stdin)
        if tty:
            sys.stdout.write('\033[?1049h\033[?25l')
        while True:
            before = time.monotonic()
            width, height = shutil.get_terminal_size((120, 60))
            if args.once:
                height = 10 ** 6
            if not paused:
                try:
                    if path.stat().st_size > 2 << 20:
                        raise ValueError('status file is too large')
                    status = json.loads(path.read_text())
                    pid = int(status['pid'])
                    changed_pid = last_pid != pid
                    if changed_pid:
                        previous, last_pid = None, pid
                        tracker.reset()
                    sample = process_sample(pid)
                    cpu, threads = cpu_usage(sample, previous[1] if previous else None,
                                             before - previous[0] if previous else 0, hz)
                    previous = (before, sample)
                    if sample is not None and status.get('state') in ('running', 'starting'):
                        tracker.update(before, status, sample, cpu)
                        if changed_pid:
                            tracker.seed_log(before, status, args.log)
                    state = status.get('state')
                    if last_state in ('running', 'starting') and state in ('complete', 'stopped'):
                        tracker.finish(status)
                        if tty and not args.no_bell:
                            announce(status)
                    last_state = state
                    last_inputs = (status, sample, host_memory(), cpu, threads, before)
                    last_screen = render(status, sample, last_inputs[2], tracker, width, height,
                                         style, cpu, threads, before, details)
                except (OSError, ValueError, KeyError, TypeError) as error:
                    last_screen = (f'Waiting for Fomkyr status: {path}\n{error}\n'
                                   'Enable --telemetry FILE --progress-seconds 1 in the solver.')
            screen = last_screen + (style('\n  PAUSED (p to resume)', 'yellow') if paused else '')
            if tty:
                lines = [clip(line, width) for line in screen.splitlines()[:height - 1]]
                sys.stdout.write('\033[H' + ''.join(line + '\033[K\n' for line in lines) + '\033[J')
                sys.stdout.flush()
            else:
                print(screen, flush=True)
            if args.once:
                break
            key = keypress(max(0, args.interval - (time.monotonic() - before))) if keys else \
                time.sleep(max(0, args.interval - (time.monotonic() - before)))
            if key in ('q', 'Q'):
                break
            if key in ('d', 'D'):
                details = not details
                if paused and last_inputs:
                    status, sample, mem, cpu, threads, at = last_inputs
                    last_screen = render(status, sample, mem, tracker, width, height, style, cpu, threads, at, details)
            if key in ('p', 'P'):
                paused = not paused
    except KeyboardInterrupt:
        pass
    finally:
        if saved is not None:
            termios.tcsetattr(sys.stdin, termios.TCSADRAIN, saved)
        if tty:
            sys.stdout.write('\033[?25h\033[?1049l')
            sys.stdout.flush()


if __name__ == '__main__':
    main()
