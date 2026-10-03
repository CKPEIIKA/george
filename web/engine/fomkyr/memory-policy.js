// SPDX-License-Identifier: MIT
// The user supplies one CEILING, not an assertion about free physical RAM.
// Pure planner: no allocation, device fingerprinting, or degree-dependent knobs.
const MiB=1048576,PAGE=65536;
const align=n=>Math.floor(n/PAGE)*PAGE;
export function chooseMemoryPolicy(options={}) {
  const mode=options.memoryPolicy??(options.scratchBytes!=null||options.rowReserveBytes!=null?'manual':'auto');
  if(mode!=='auto'&&mode!=='manual')throw new Error('memoryPolicy must be auto or manual');
  return mode;
}
export function planMemory(budget,workers,options={}) {
  if(!Number.isSafeInteger(budget)||budget<16*MiB||!Number.isInteger(workers)||workers<1||workers>32)throw new Error('Invalid workspace budget/worker count');
  const policy=chooseMemoryPolicy(options);
  const automatic=policy==='auto';
  // 4/7 ordinary + 1/7 exceptional, leaving 2/7 for indexes, reducer caches,
  // stacks, basis metadata and output. No former 512-MiB scratch ceiling.
  const scratch=align(automatic?budget*4/7:Number(options.scratchBytes??Math.min(budget/3,512*MiB)));
  const reserve=align(automatic?(budget>=128*MiB?budget/7:0):Number(options.rowReserveBytes??(budget>=512*MiB?Math.min(budget/4,512*MiB):0)));
  if(!Number.isFinite(scratch)||scratch<workers*MiB||scratch>=budget)throw new Error('scratchBytes must provide >=1 MiB per lane and fit in the kernel budget');
  if(!Number.isFinite(reserve)||reserve<0)throw new Error('Invalid reserve budget');
  return {policy,budgetBytes:budget,ordinaryScratchBytes:scratch,rowReserveBytes:reserve,
    initialWorkers:workers,initialBytesPerLane:Math.floor(scratch/workers/65536)*65536,
    unreservedBytes:budget-scratch-reserve,capacityFallback:automatic?'reduce concurrent lanes and replay only the pending batch suffix':'legacy low-memory fallback',
    ignoredManualWorkspaceSettings:automatic&&(options.scratchBytes!=null||options.rowReserveBytes!=null),
    physicalMemoryDetection:false};
}
