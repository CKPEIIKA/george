// Zero means unlimited. Chunk long deadlines to avoid setTimeout's ~24-day
// overflow, and return a disposer so a stopped job cannot cancel a later one.
export function validateTimeoutMs(value) {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
    throw new Error('Time limit must be a nonnegative number of minutes (0 means unlimited).');
  }
  return value;
}

export function timeoutMilliseconds(minutes = 0) {
  return validateTimeoutMs(Number(minutes) * 60000);
}

export function deadline(timeoutMs, expire) {
  validateTimeoutMs(timeoutMs);
  if (!timeoutMs) return () => {};
  const end = performance.now() + timeoutMs;
  let timer;
  const schedule = () => {
    const remaining = end - performance.now();
    if (remaining <= 0) expire();
    else timer = setTimeout(schedule, Math.min(remaining, 2147483647));
  };
  schedule();
  return () => clearTimeout(timer);
}
