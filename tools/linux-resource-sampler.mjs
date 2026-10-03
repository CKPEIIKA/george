// Linux process-tree CPU/PSS sampler for native command-line benchmarks.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const clockTicks=Number(execFileSync('getconf',['CLK_TCK'],{encoding:'utf8'}));
function processTree(root) {
  const all = new Map();
  for (const name of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const stat = fs.readFileSync('/proc/' + name + '/stat', 'utf8');
      const f = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
      all.set(Number(name), {pid: Number(name), parent: Number(f[1]),
        ticks: Number(f[11]) + Number(f[12]), identity: name + ':' + f[19]});
    } catch { /* process exited during sampling */ }
  }
  const pids = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of all.values()) if (!pids.has(p.pid) && pids.has(p.parent)) {pids.add(p.pid); changed = true;}
  }
  return [...pids].map(pid => all.get(pid)).filter(Boolean);
}

export class Sampler {
  constructor(root,{intervalMs=20}={}) {this.root = root; this.intervalMs=intervalMs; this.previous = new Map(); this.samples = []; this.cpuTicks = 0;}
  sample(initial = false) {
    let pssKiB = 0, rssKiB = 0;
    const tree = processTree(this.root);
    for (const p of tree) {
      const before = this.previous.get(p.identity);
      if (!initial) this.cpuTicks += before === undefined ? p.ticks : Math.max(0, p.ticks - before);
      this.previous.set(p.identity, p.ticks);
      try {
        const rollup = fs.readFileSync('/proc/' + p.pid + '/smaps_rollup', 'utf8');
        pssKiB += Number(rollup.match(/^Pss:\s+(\d+)/m)?.[1] ?? 0);
        rssKiB += Number(rollup.match(/^Rss:\s+(\d+)/m)?.[1] ?? 0);
      } catch { /* process exited or is a zombie */ }
    }
    const point = {seconds: (performance.now() - this.startAt) / 1000,
      cpuSeconds: this.cpuTicks / clockTicks, pssMiB: pssKiB / 1024, rssMiB: rssKiB / 1024, processes: tree.length};
    this.samples.push(point);
    return point;
  }
  start() {this.startAt = performance.now(); this.baseline = this.sample(true); if(this.intervalMs>0)this.timer = setInterval(() => this.sample(), this.intervalMs);}
  stop() {
    clearInterval(this.timer);
    const end = this.sample();
    return {cpuSeconds: end.cpuSeconds, measuredWallSeconds: end.seconds,
      averageCpuPercent: 100 * end.cpuSeconds / end.seconds,
      peakPssMiB: Math.max(...this.samples.map(s => s.pssMiB)),
      peakRssMiB: Math.max(...this.samples.map(s => s.rssMiB)), baselinePssMiB: this.baseline.pssMiB,
      samples: this.samples};
  }
}
