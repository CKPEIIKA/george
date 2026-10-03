#!/usr/bin/env python3
"""Export a compact README figure from the serial FK6 resource benchmark."""
import argparse
import csv
import json
import os
from pathlib import Path

os.environ.setdefault('MPLCONFIGDIR', '/tmp/george-matplotlib')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
from matplotlib.ticker import MaxNLocator
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('report', type=Path)
parser.add_argument('--out', type=Path, default=Path('docs/benchmarks'))
args = parser.parse_args()
report = json.loads(args.report.read_text())
assert report['state'] == 'complete'
audit = json.loads((args.report.parent / 'leading-word-audit.json').read_text())
assert audit['state'] == 'complete'
assert audit['runs'] == sum(row['status'] == 'complete' for row in report['rows'])
assert report['degrees'] == list(range(1, 11))
args.out.mkdir(parents=True, exist_ok=True)
rows = report['rows']
limit = report['timeLimitSeconds']
assert len(rows) == 50
assert all(row['memoryMiB'] == min(report['memoryMiB'], 4095 if row['id'] == 'compiled' else report['memoryMiB'])
           and row['timeLimitSeconds'] == limit for row in rows)
assert report.get('v8NoLiftoff', False) is False, 'Use the ordinary browser engine for the README comparison'

def point(ident, degree):
    matches = [row for row in rows if row['id'] == ident and row['degree'] == degree]
    assert len(matches) == 1, (ident, degree, len(matches))
    return matches[0]

selected = []
for degree in report['degrees']:
    modes = [point(mode, degree) for mode in ['compiled', 'memory64']]
    complete = [row for row in modes if row['status'] == 'complete']
    # Choose RAM from the same successful mode that supplies the time.
    browser = min(complete, key=lambda row: row['coldWallSeconds']) if complete else modes[0]
    selected.append({**browser, 'curve': 'browser-bergman'})
    for ident in ['sbcl', 'singular', 'fomkyr']:
        selected.append({**point(ident, degree), 'curve': ident})

curves = [
    ('browser-bergman', 'Bergman / C–ECL (browser)', '#0072B2', '-', '^'),
    ('sbcl', 'Bergman / SBCL (native)', '#009E73', '--', 's'),
    ('singular', 'Singular 4.4.1 / Letterplace', '#D55E00', '-.', 'D'),
    ('fomkyr', 'Fomkyr 0.6.4 (browser, 4 workers)', '#CC79A7', ':', 'o'),
]
style = {
    'font.family': 'sans-serif', 'font.sans-serif': ['Liberation Sans', 'DejaVu Sans'],
    'font.size': 8, 'axes.labelsize': 8, 'axes.titlesize': 8,
    'xtick.labelsize': 7, 'ytick.labelsize': 7, 'legend.fontsize': 7,
    'lines.linewidth': 1.2, 'lines.markersize': 3.5, 'lines.markeredgewidth': 0.7,
    'axes.linewidth': 0.6, 'xtick.major.width': 0.6, 'ytick.major.width': 0.6,
    'xtick.major.size': 3, 'ytick.major.size': 3,
    'xtick.direction': 'in', 'ytick.direction': 'in',
    'figure.dpi': 150, 'savefig.dpi': 600,
    'pdf.fonttype': 42, 'svg.fonttype': 'none',
    'axes.grid': True, 'grid.alpha': 0.25, 'grid.linewidth': 0.45,
    'legend.frameon': False,
}
with plt.rc_context(style):
    fig, axes = plt.subplots(1, 2, figsize=(190 / 25.4, 100 / 25.4))
    # Full linear scales preserve the large-degree costs. A linear inset makes
    # the smaller-degree measurements readable without clipping the main plot.
    completed = [row for row in selected if row['status'] == 'complete']
    wall_max = max(row['coldWallSeconds'] for row in completed)
    zoom_time = wall_max > 4 * max(row['coldWallSeconds'] for row in completed if row['degree'] <= 8)
    inset = axes[0].inset_axes([0.095, 0.47, 0.51, 0.46]) if zoom_time else None
    ram_inset = axes[1].inset_axes([0.095, 0.47, 0.51, 0.46])
    handles = []
    unfinished = False
    for ident, label, color, dash, marker in curves:
        data = [row for row in selected if row['curve'] == ident]
        x = [row['degree'] for row in data]
        wall = [row['coldWallSeconds'] if row['status'] == 'complete' else np.nan for row in data]
        ram = [row['peakPssMiB'] / 1024 if row['status'] == 'complete' else np.nan for row in data]
        for ax, values in zip(axes, [wall, ram]):
            line, = ax.plot(x, values, color=color, linestyle=dash, marker=marker,
                            markerfacecolor='white', label=label)
            if ax is axes[0]:
                handles.append(line)
        if inset is not None:
            inset.plot(x[:8], wall[:8], color=color, linestyle=dash, marker=marker,
                       markerfacecolor='white', markersize=2.5)
        if ident in ['sbcl', 'singular']:
            ram_inset.plot(x[:8], [value * 1024 for value in ram[:8]], color=color,
                           linestyle=dash, marker=marker, markerfacecolor='white', markersize=2.5)
        for row in data:
            if row['status'] == 'complete':
                continue
            assert row['status'] in ['timeout', 'oom'], row
            unfinished = True
            offset = {'browser-bergman': -0.065, 'sbcl': 0, 'singular': 0.065}[ident]
            # An OOM run has no completion time. Only its observed RAM is drawn.
            axes[1].scatter([row['degree'] + offset], [row['peakPssMiB'] / 1024], marker='x', s=25,
                            color=color, linewidth=1.1, zorder=4, clip_on=False)
            if row['status'] == 'timeout' and limit > 0:
                axes[0].scatter([row['degree'] + offset], [limit], marker='x', s=25,
                                color=color, linewidth=1.1, zorder=4, clip_on=False)
    if unfinished:
        handles.append(Line2D([], [], color='0.3', marker='x', linestyle='none', label='Unfinished (observed RAM)'))
    axes[0].set_title('(a) Elapsed time', loc='left', fontweight='bold')
    axes[1].set_title('(b) Physical RAM', loc='left', fontweight='bold')
    axes[0].set_ylabel('Cold elapsed time (s)')
    axes[0].set_ylim(0, limit if limit else wall_max * 1.08)
    axes[0].yaxis.set_major_locator(MaxNLocator(nbins=5))
    axes[0].ticklabel_format(axis='y', style='plain', useOffset=False)
    axes[1].set_ylabel('Peak process-tree PSS (GiB)')
    axes[1].set_ylim(0, max(row['peakPssMiB'] for row in selected) / 1024 * 1.08)
    axes[1].yaxis.set_major_locator(MaxNLocator(nbins=5))
    if inset is not None:
        inset.set_title('Degrees 1–8 · seconds', fontsize=7, pad=3)
        inset.set_ylim(0, max(row['coldWallSeconds'] for row in completed if row['degree'] <= 8) * 1.10)
    ram_inset.set_title('Native RAM · degrees 1–8 · MiB', fontsize=7, pad=3)
    ram_inset.set_ylim(0, max(row['peakPssMiB'] for row in completed
                            if row['curve'] in ['sbcl', 'singular'] and row['degree'] <= 8) * 1.10)
    for inner in [inset, ram_inset]:
        if inner is None:
            continue
        inner.set_xlim(0.8, 8.2)
        inner.set_xticks([1, 4, 8])
        inner.yaxis.set_major_locator(MaxNLocator(nbins=3))
        inner.tick_params(labelsize=6.5, length=2)
        inner.spines[['right', 'top']].set_visible(False)
        inner.patch.set_alpha(1)
    for ax in axes:
        ax.set_xlabel('Maximal degree')
        ax.set_xticks(report['degrees'])
        ax.set_xlim(0.8, 10.2)
        ax.spines[['right', 'top']].set_visible(False)
    fig.suptitle('FK6 over Q · degrees 1–10', fontsize=9, y=0.98)
    fig.subplots_adjust(left=0.085, right=0.985, top=0.87, bottom=0.25, wspace=0.32)
    fig.legend(handles=handles, loc='lower center', bbox_to_anchor=(0.5, 0.015),
               ncol=2, handlelength=2.8, columnspacing=1.6)
    for extension in ['svg', 'pdf', 'png']:
        fig.savefig(args.out / ('fk6-0.6.4.' + extension))
    from PIL import Image
    Image.open(args.out / 'fk6-0.6.4.png').convert('L').save(args.report.parent / 'plot-grayscale.png')
    plt.close(fig)

# Publish only the measurements needed to interpret/replot the figure. Raw
# process traces, machine identifiers and private directory names stay local.
columns = ['id', 'degree', 'status', 'coldWallSeconds', 'cpuSeconds', 'cpuSource', 'peakPssMiB',
           'basisSize', 'memoryMiB', 'workers']
with (args.out / 'fk6-0.6.4.csv').open('w', newline='') as file:
    writer = csv.DictWriter(file, fieldnames=columns)
    writer.writeheader()
    for row in sorted(rows, key=lambda row: (row['id'], row['degree'])):
        writer.writerow({**{key: row.get(key, '') for key in columns},
                         'cpuSource': row.get('cpuSource', 'sampled process-tree CPU'),
                         'workers': (row.get('native') or {}).get('workers', 1)})
summary = {
    'schema': 1, 'coreVersion': '0.6.4', 'degrees': report['degrees'],
    'input': 'test/fixtures/fomin-kirillov-user.json', 'inputSha256': report['inputSha256'],
    'variables': report['variables'], 'relations': report['relations'],
    'field': 'Q', 'order': 'degree followed by left lexicographic',
    'runsPerModeAndDegree': 1, 'timeLimitSeconds': limit,
    'timeLimitInterpretation': '0 disables the timeout; unfinished runs have no completion time.',
    'memoryAllowanceMiB': report['memoryMiB'],
    'memoryAllowanceMiBByMode': {ident: point(ident, 1)['memoryMiB']
                                for ident in ['compiled', 'memory64', 'fomkyr', 'sbcl', 'singular']},
    'browser': 'Chromium ' + rows[0]['environment']['userAgent'].split('Chrome/')[1].split()[0],
    'browserBergmanModes': ['C/ECL O3 + LTO wasm32', 'C/ECL O3 + LTO memory64'],
    'selectedBrowserBergmanModes': {str(row['degree']): row['id'] for row in selected if row['curve'] == 'browser-bergman'},
    'fomkyr': {'bits': 64, 'workers': 4, 'memoryPolicy': 'auto', 'batchPairs': 128},
    'timing': 'Fresh engine/process, computation, text export and result delivery. Browser launch, page rendering and the full-output reread used for audit are excluded. No checkpoint reuse or Hilbert counting. Bergman and Singular export reduced monic bases; Fomkyr exports primitive rows without global tail interreduction.',
    'ram': 'Peak sum of process-tree PSS, including browser/runtime. Browser sampled every 250 ms; native programs every 20 ms. Brief peaks can be missed.',
    'limits': 'Browser kernel/Lisp heap, SBCL dynamic space and Singular virtual address space use the recorded allowances. Wasm32 is capped at 4095 MiB. These constrain different allocations; the complete browser process tree can exceed the kernel allowance.',
    'censored': 'Crosses in the RAM panel mark unfinished runs and show the observed peak before stopping. Heap exhaustion has no completion-time point. A time-limited pass marks timeouts at its cap. Neither is extrapolated.',
    'singularOptions': report['nativeProvenance']['singularOptions'],
    'degreeOne': report['nativeProvenance']['degreeOne'],
    'selection': 'Fastest completed browser Bergman addressing mode at each degree; RAM comes from the same run. If both modes are unfinished, show the wasm32 observation.',
    'audit': {'completedRuns': audit['runs'], 'method': audit['method']},
    'scope': 'One cold run per point on one Linux host; platform and run-to-run variation affect comparisons.',
    'engineHashes': {key.removeprefix('web/engine/'): value for key, value in report['sourceHashes'].items()
                     if key in ['web/engine/compiled/ecl.wasm', 'web/engine/memory64/ecl.wasm', 'web/engine/ecl.data', 'web/engine/fomkyr/fomkyr64.wasm']},
    'nativeHashes': {key: value for key, value in report['nativeProvenance'].items() if key.endswith('Sha256')},
    'singularArithmeticModuleHashes': report['nativeProvenance']['singularArithmeticModules'],
}
saved_comparison = args.report.parent / 'singular-baseline-check.json'
if saved_comparison.exists():
    comparison = json.loads(saved_comparison.read_text())
    assert comparison['passed']
    summary['savedSingularComparison'] = comparison
(args.out / 'fk6-0.6.4.json').write_text(json.dumps(summary, indent=2) + '\n')
print(args.out / 'fk6-0.6.4.svg')
