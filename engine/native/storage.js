// SPDX-License-Identifier: MIT
// Some browsers ignore the mode dictionary and always lock files exclusively.
// Test actual simultaneous access instead of assuming that OPFS implies it.
export async function openBasisHandle(file) {
  let handle, probe;
  try {
    try {handle = await file.createSyncAccessHandle({mode: 'readwrite-unsafe'});}
    catch (error) {
      if (!['TypeError', 'NotSupportedError'].includes(error.name)) throw error;
      handle = await file.createSyncAccessHandle();
    }
    try {
      probe = await file.createSyncAccessHandle({mode: 'readwrite-unsafe'});
      return {handle, shared: true};
    } catch (error) {
      if (!['NoModificationAllowedError', 'TypeError', 'NotSupportedError'].includes(error.name)) throw error;
      return {handle, shared: false};
    } finally {probe?.close();}
  } catch (error) {handle?.close(); throw error;}
}

export async function acquireRunLock(directory) {
  try {return await (await directory.getFileHandle('coordinator.lock', {create: true})).createSyncAccessHandle();}
  catch (error) {
    if (error.name !== 'NoModificationAllowedError') throw error;
    throw Object.assign(new Error('This input is already open in another George computation. Stop or close that run, then retry.'), {code: 'RUN_LOCKED'});
  }
}
