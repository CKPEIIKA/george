#!/usr/bin/env python3
"""Plot Linux browser and native resource measurements as a two-panel figure."""
import argparse
import csv
import json
import os
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", "/tmp/george-matplotlib")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator, NullFormatter, FuncFormatter
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("report", type=Path)
parser.add_argument("--out", type=Path)
args = parser.parse_args()
report = json.loads(args.report.read_text())
out = args.out or args.report.parent
out.mkdir(parents=True, exist_ok=True)

STYLE = {
    "font.family": "sans-serif",
    "font.sans-serif": ["Liberation Sans", "DejaVu Sans"],
    "font.size": 8, "axes.labelsize": 8, "axes.titlesize": 8,
    "xtick.labelsize": 7, "ytick.labelsize": 7, "legend.fontsize": 7,
    "lines.linewidth": 1.2, "lines.markersize": 3.2, "lines.markeredgewidth": 0.7,
    "axes.linewidth": 0.6, "xtick.major.width": 0.6, "ytick.major.width": 0.6,
    "xtick.minor.width": 0.4, "ytick.minor.width": 0.4,
    "xtick.major.size": 3, "ytick.major.size": 3,
    "xtick.direction": "in", "ytick.direction": "in",
    "figure.dpi": 150, "savefig.dpi": 600,
    "pdf.fonttype": 42, "ps.fonttype": 42, "svg.fonttype": "none",
    "axes.grid": True, "grid.alpha": 0.25, "grid.linewidth": 0.45,
    "legend.frameon": False,
}
CURVES = {
    "standard": ("Lisp / ECL O2", "#222222", "-", "o"),
    "optimized": ("Lisp / ECL O3 + LTO", "#777777", "--", "s"),
    "compiled": ("C / ECL O3 + LTO", "#004488", "-", "^"),
    "memory64": ("C / ECL O3 + LTO (memory64)", "#004488", "--", "v"),
    "native": ("Native NC (memory64, Chromium, 4 workers)", "#994455", "-", "D"),
    "native-firefox": ("Native NC (memory64, Firefox, 1 worker)", "#994455", ":", "X"),
    "fomkyr": ("fomkyr 0.3 (memory64, Chromium, 4 workers)", "#994455", "-", "D"),
    "fomkyr-firefox": ("fomkyr 0.3 (memory64, Firefox, 4 workers)", "#994455", ":", "X"),
    "sbcl": ("Bergman / SBCL (native)", "#009E73", "-.", "P"),
    "singular": ("Singular / Letterplace (native)", "#D55E00", (0, (4, 1, 1, 1)), "*"),
}
degrees = sorted(report["degrees"])
rows = report["rows"]
limit = float(report.get("timeLimitSeconds", 120))
columns = ["id", "browser", "degree", "trial", "status", "basisSize", "coldWallSeconds",
           "cpuSeconds", "averageCpuPercent", "baselinePssMiB", "peakPssMiB", "peakRssMiB",
           "peakAllocatedWasmMiB", "memoryMiB", "workers"]
with (out / "backend-resources.csv").open("w", newline="") as file:
    writer = csv.DictWriter(file, fieldnames=columns)
    writer.writeheader()
    for row in sorted(rows, key=lambda r: (r["id"], r["degree"], r["trial"])):
        writer.writerow({**{key: row.get(key, "") for key in columns},
                         "workers": (row.get("native") or {}).get("workers", 1)})

# Preserve the original pilot rows in CSV; derive the figure's capped window
# from their actual recorded traces, without extrapolating CPU or RAM.
plot_rows = []
for original in rows:
    row = dict(original)
    wall = row.get("coldWallSeconds", row.get("measuredWallSeconds", 0))
    if wall > limit + 0.5:
        trace = json.loads((args.report.parent / row["samplesFile"]).read_text())
        prefix = [s for s in trace if s["seconds"] <= limit]
        if not prefix:
            raise ValueError("No measured samples in the capped interval")
        row.update(cpuSeconds=prefix[-1]["cpuSeconds"],
                   peakPssMiB=max(s["pssMiB"] for s in prefix),
                   coldWallSeconds=limit, status="timeout", traceCensored=True)
    row["additionalPssMiB"] = max(0, row["peakPssMiB"] - row.get("baselinePssMiB", 0))
    row["cpuAbovePlotLimit"] = row["cpuSeconds"] > limit
    plot_rows.append(row)
with (out / "backend-resources-capped.csv").open("w", newline="") as file:
    fields = ["id", "degree", "status", "cpuSeconds", "coldWallSeconds", "additionalPssMiB",
              "peakPssMiB", "baselinePssMiB", "cpuAbovePlotLimit", "traceCensored"]
    writer = csv.DictWriter(file, fieldnames=fields)
    writer.writeheader()
    writer.writerows({key: row.get(key, "") for key in fields} for row in plot_rows)

with plt.rc_context(STYLE):
    fig, axes = plt.subplots(1, 2, figsize=(190 / 25.4, 132 / 25.4))
    handles, labels = [], []
    for config in report["configurations"]:
        ident = config["id"]
        label, color, linestyle, marker = CURVES[ident]
        cpu, ram = [], []
        for degree in degrees:
            matches = [r for r in plot_rows if r["id"] == ident and r["degree"] == degree and r["status"] == "complete"]
            cpu.append(float(np.median([r["cpuSeconds"] for r in matches])) if matches and all(r["cpuSeconds"] <= limit for r in matches) else np.nan)
            ram.append(float(np.median([r["additionalPssMiB"] for r in matches])) if matches else np.nan)
        for ax, values in zip(axes, [cpu, ram]):
            line, = ax.plot(degrees, values, color=color, linestyle=linestyle, marker=marker,
                            markerfacecolor="white", label=label)
            if ax is axes[0]:
                handles.append(line)
                labels.append(label)
        for row in plot_rows:
            if row["id"] != ident:
                continue
            if ident in {"standard", "optimized"} and row["status"] != "complete":
                continue
            if row["status"] == "complete" and not row["cpuAbovePlotLimit"]:
                continue
            for ax, value in zip(axes, [row.get("cpuSeconds"), row.get("additionalPssMiB")]):
                if ax is axes[1] and row["status"] == "complete":
                    continue
                if value is not None and value > 0:
                    y = min(value, limit) if ax is axes[0] else value
                    x = row["degree"] + ({"standard": -0.035, "optimized": 0.035}.get(ident, 0))
                    ax.scatter([x], [y], marker="x" if row["status"] != "complete" else "^",
                               s=26, color=color, zorder=4, clip_on=False)
    axes[0].set_title("(a) CPU time", loc="left", fontweight="bold")
    axes[1].set_title("(b) Additional physical RAM", loc="left", fontweight="bold")
    axes[0].set_ylabel("Total CPU time (core s)")
    axes[0].set_yscale("log")
    positive = [r["cpuSeconds"] for r in plot_rows if r["cpuSeconds"] > 0]
    axes[0].set_ylim(bottom=min(positive) / 1.5, top=limit)
    ticks = [10.0 ** n for n in range(-6, 4) if min(positive) / 1.5 <= 10.0 ** n <= limit / 2]
    axes[0].set_yticks(ticks + [limit])
    axes[0].yaxis.set_major_formatter(FuncFormatter(lambda value, _: f"{value:g}"))
    axes[0].yaxis.set_minor_formatter(NullFormatter())
    if any(row['id'] in {'standard', 'optimized'} and row['status'] != 'complete' for row in plot_rows):
        axes[0].text(0.04, 0.91, "Lisp / ECL exceeds 120 s\nat degrees 6–8", transform=axes[0].transAxes,
                     fontsize=7, va='top')
        axes[0].annotate('', xy=(0.67, 1.035), xytext=(0.67, 0.86), xycoords='axes fraction',
                         arrowprops={'arrowstyle': '-|>', 'color': '#222222', 'lw': 1.0}, annotation_clip=False)
    axes[1].set_ylabel("Peak PSS above idle baseline (MiB)")
    axes[1].set_ylim(bottom=0)
    axes[1].yaxis.set_major_locator(MaxNLocator(nbins=6))
    for ax in axes:
        ax.set_xlabel("Maximal degree")
        ax.set_xticks(degrees)
        ax.set_xlim(min(degrees) - 0.15, max(degrees) + 0.25)
        ax.spines[["right", "top"]].set_visible(False)
    fig.suptitle(f"Fomin–Kirillov case: {report['variables']} generators, {report['relations']} relations over Q",
                 y=0.98, fontsize=10, fontweight="bold")
    fig.subplots_adjust(left=0.085, right=0.985, top=0.89, bottom=0.41, wspace=0.30)
    fig.legend(handles, labels, loc="lower center", bbox_to_anchor=(0.5, 0.16), ncol=2,
               columnspacing=2, handlelength=2.7, labelspacing=0.6)
    repetitions = sorted(set(sum(r['id'] == c['id'] and r['degree'] == d
                                  for r in rows) for c in report['configurations'] for d in degrees))
    trial_note = "One cold run per point." if repetitions == [1] else "Median of available cold runs; see CSV for trial counts."
    fig.text(0.085, 0.125, f"Serial cold jobs; {limit:g} s cap. Browser budgets: {report['memoryMiB'] / 1024:g} GiB. Bergman pruning enabled.", fontsize=7)
    fig.text(0.085, 0.094, "CPU includes engine startup, computation and export. PSS subtracts each run’s pre-engine baseline.", fontsize=7)
    fig.text(0.085, 0.063, "RAM sampling: browsers 0.25 s, native CLI 0.02 s. Unfinished Lisp points are omitted; ↑ indicates the limit.", fontsize=7)
    fig.text(0.085, 0.032, trial_note + " Browser curves use Chromium except the labelled Firefox curve.", fontsize=7)
    provenance_note = "Bergman/CLI curves: earlier same-day runs; fomkyr 0.3 curves: new serial runs on the same host." if 'fomkyrProvenance' in report else "Raw traces are retained; native CLI has no browser overhead. Earlier long Lisp pilots are preserved separately."
    fig.text(0.085, 0.011, provenance_note, fontsize=7)
    for extension in ["pdf", "svg", "png"]:
        fig.savefig(out / ("backend-resources." + extension))
    # Grayscale preview for the line/marker and label audit.
    from PIL import Image
    Image.open(out / "backend-resources.png").convert("L").save(out / "backend-resources-grayscale.png")
    plt.close(fig)
print(out / "backend-resources.png")
