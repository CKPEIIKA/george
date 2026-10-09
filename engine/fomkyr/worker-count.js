// SPDX-License-Identifier: MIT
export const MAX_WORKERS=32;
export function automaticWorkers(hardwareConcurrency=globalThis.navigator?.hardwareConcurrency) {
  const available=Number.isInteger(hardwareConcurrency)&&hardwareConcurrency>0?hardwareConcurrency:2;
  return Math.min(MAX_WORKERS,Math.max(1,available-1));
}
export function computeWorkers(requested,{shared=true,execution='auto',hardwareConcurrency,ordinaryScratchBytes,minWorkerMiB=0,coordinator=false}={}) {
  if(!shared||execution==='single')return 1;
  if(requested)return Math.min(MAX_WORKERS,Math.max(1,Math.floor(requested)));
  const available=automaticWorkers(hardwareConcurrency);
  return minWorkerMiB?Math.min(available,Math.max(1,Math.floor(ordinaryScratchBytes/(minWorkerMiB*1048576))-(coordinator?1:0))):available;
}
