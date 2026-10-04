// A killed timeout wrapper may report its own rusage without its child's.
// Preserve GNU time only for normal successful exits; otherwise use the
// process-tree samples, which are lower bounds at the sampling interval.
export function processMetrics(time, resource, exitCode, wallSeconds) {
 const valid=time.length===3&&time.every(Number.isFinite);
 const useTime=valid&&exitCode===0;
 const cpuSeconds=useTime?time[0]+time[1]:resource.cpuSeconds;
 return {
  cpuSeconds,
  averageCpuPercent:100*cpuSeconds/wallSeconds,
  peakRssMiB:useTime?time[2]/1024:resource.peakRssMiB,
  peakPssMiB:resource.peakPssMiB,
  cpuSource:useTime?'gnu-time':'sampled-process-tree',
  rssSource:useTime?'gnu-time':'sampled-process-tree',
  sampledPeaksAreLowerBounds:!useTime,
  gnuTimePeakRssMiB:valid?time[2]/1024:null,
 };
}
