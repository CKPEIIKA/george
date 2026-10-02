// SPDX-License-Identifier: MIT
export const MAX_WORKERS=32;
export function automaticWorkers(hardwareConcurrency=globalThis.navigator?.hardwareConcurrency) {
  const available=Number.isInteger(hardwareConcurrency)&&hardwareConcurrency>0?hardwareConcurrency:2;
  return Math.min(MAX_WORKERS,Math.max(1,available-1));
}
export function computeWorkers(requested,{shared=true,execution='auto',hardwareConcurrency}={}) {
  if(!shared||execution==='single')return 1;
  return requested?Math.min(MAX_WORKERS,Math.max(1,Math.floor(requested))):automaticWorkers(hardwareConcurrency);
}
