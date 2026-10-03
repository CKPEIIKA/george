// Local-only benchmark conditions. Keep raw snapshots out of public figures.
import fs from 'node:fs';
import os from 'node:os';

const read = file => {try {return fs.readFileSync(file, 'utf8').trim();} catch {return null;}};
const entries = directory => {try {return fs.readdirSync(directory).sort();} catch {return [];}};
const numeric = file => {const value = read(file); return value === null ? null : Number(value);};

export function benchmarkEnvironment() {
  const policies = entries('/sys/devices/system/cpu/cpufreq').filter(name => /^policy\d+$/.test(name)).map(name => {
    const root = '/sys/devices/system/cpu/cpufreq/' + name + '/';
    return {name, governor:read(root+'scaling_governor'), minKHz:numeric(root+'scaling_min_freq'),
      maxKHz:numeric(root+'scaling_max_freq'), currentKHz:numeric(root+'scaling_cur_freq'),
      preference:read(root+'energy_performance_preference')};
  });
  const power = entries('/sys/class/power_supply').map(name => {
    const root = '/sys/class/power_supply/' + name + '/';
    return {name, type:read(root+'type'), online:numeric(root+'online'), status:read(root+'status')};
  });
  const memory = read('/proc/meminfo') ?? '';
  const vm = read('/proc/vmstat') ?? '';
  const value = (text, name) => Number(text.match(new RegExp('^'+name+':?\\s+(\\d+)', 'm'))?.[1] ?? 0);
  return {at:new Date().toISOString(), policies, cpuLimitsKnown:policies.length>0&&policies.every(policy=>
    policy.governor&&Number.isFinite(policy.maxKHz)&&policy.maxKHz>0), power, load:os.loadavg(),
    availableMiB:value(memory,'MemAvailable')/1024, swapUsedMiB:(value(memory,'SwapTotal')-value(memory,'SwapFree'))/1024,
    swapInPages:value(vm,'pswpin'), swapOutPages:value(vm,'pswpout'), majorFaults:value(vm,'pgmajfault')};
}

export function powerSignature(snapshot) {
  return JSON.stringify({policies:snapshot.policies.map(({currentKHz,...policy}) => policy), power:snapshot.power});
}

export function summarizeEnvironment(samples) {
  const first=samples[0], last=samples.at(-1);
  if (!first) return null;
  return {first, last, samples:samples.length,
    powerConfigurations:[...new Set(samples.map(powerSignature))].map(text => JSON.parse(text)),
    stablePower:samples.every(sample => powerSignature(sample) === powerSignature(first)),
    minAvailableMiB:Math.min(...samples.map(sample => sample.availableMiB)),
    maxSwapUsedMiB:Math.max(...samples.map(sample => sample.swapUsedMiB)),
    swapInPages:last.swapInPages-first.swapInPages, swapOutPages:last.swapOutPages-first.swapOutPages,
    majorFaults:last.majorFaults-first.majorFaults};
}

export class EnvironmentMonitor {
  start() {
    this.samples=[benchmarkEnvironment()];
    this.timer=setInterval(() => this.samples.push(benchmarkEnvironment()), 1000);
  }
  stop() {
    clearInterval(this.timer); this.samples.push(benchmarkEnvironment());
    return summarizeEnvironment(this.samples);
  }
}
