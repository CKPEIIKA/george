import { resolutionJob, DEFAULT_MEMORY_MIB } from '../src/bergman-syntax.js';
import { validMemoryMiB, memoryLimitMessage } from '../src/backends.js';
import { augmentedHomology } from '../src/homology.js';
export function setMemoryLimit(runtime, memoryMiB = DEFAULT_MEMORY_MIB, backend = 'standard') {
  if (!validMemoryMiB(memoryMiB, backend)) throw new Error(memoryLimitMessage(backend));
  const source = `(EXT:SET-LIMIT 'EXT:HEAP-SIZE ${memoryMiB * 1048576})`;
  if (runtime.ccall('george_eval', 'number', ['string', 'number'], [source, 0])) throw new Error('Cannot set the engine memory limit.');
}
export function putFile(runtime, path, text) {
  const absolute = path.startsWith('/') ? path : `/work/${path}`;
  runtime.FS.mkdirTree(absolute.slice(0, absolute.lastIndexOf('/')));
  runtime.FS.writeFile(absolute, text);
}
export function runJob(runtime, job) {
  setMemoryLimit(runtime, job.memoryMiB, job.backend);
  function execute(part, skipAnick=false) {
    for (const [path,text] of Object.entries(part.files)) putFile(runtime,path,text);
    for (const path of Object.values(part.outputs)) if (runtime.FS.analyzePath(path).exists) runtime.FS.unlink(path);
    const status = runtime.ccall('george_eval','number',['string','number'],[part.script,0]);
    if (status) {
      const error = new Error(status === 2 ? 'The computation exhausted its memory limit. Increase Memory limit under More settings or set a maximal degree.' : 'Bergman evaluation failed.');
      if (status === 2) {
        error.code = 'memory-limit';
        const files = {};
        // Keep saved basis output; interrupted series/resolutions are not results.
        const path = part.outputs.gb;
        if (path && runtime.FS.analyzePath(path).exists) files[path] = runtime.FS.readFile(path, {encoding:'utf8'});
        error.partialResult = {files, interrupted: true};
      }
      throw error;
    }
    const files={};
    for (const [kind,path] of Object.entries(part.outputs)) if (!skipAnick || kind!=='anick') files[path]=runtime.FS.readFile(path,{encoding:'utf8'});
    return files;
  }
  const files=execute(job,!!job.resolution);
  let homology;
  if (job.resolution) {
    const next=resolutionJob(job,files[job.outputs.gb]);
    let resolutionFiles;
    try { resolutionFiles=execute(next); }
    catch (error) {
      if (error.partialResult) Object.assign(error.partialResult.files,files,next.files,{'resolution-session.lsp':next.script});
      throw error;
    }
    Object.assign(files,resolutionFiles,next.files);
    files['resolution-session.lsp']=next.script;
    const f=job.resolution.form;
    homology=augmentedHomology(files[next.outputs.resolution],f.vars,f.field==='2'?2:f.field==='p'?Number(f.modulus):0,{completeBasis:true,basis:files[next.outputs.gb],degreeBound:next.degreeBound,weights:f.weights});
    homology.shifted=f.augmentation==='monoid';
    files['homology.json']=JSON.stringify(homology,null,2);
  }
  return {files,homology};
}
