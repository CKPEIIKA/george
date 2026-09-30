import { resolutionJob } from '../src/bergman-syntax.js';
import { augmentedHomology } from '../src/homology.js';
export function putFile(runtime, path, text) {
  const absolute = path.startsWith('/') ? path : `/work/${path}`;
  runtime.FS.mkdirTree(absolute.slice(0, absolute.lastIndexOf('/')));
  runtime.FS.writeFile(absolute, text);
}
export function runJob(runtime, job) {
  function execute(part, skipAnick=false) {
    for (const [path,text] of Object.entries(part.files)) putFile(runtime,path,text);
    for (const path of Object.values(part.outputs)) if (runtime.FS.analyzePath(path).exists) runtime.FS.unlink(path);
    if (runtime.ccall('george_eval','number',['string','number'],[part.script,0])) throw new Error('Bergman evaluation failed.');
    const files={};
    for (const [kind,path] of Object.entries(part.outputs)) if (!skipAnick || kind!=='anick') files[path]=runtime.FS.readFile(path,{encoding:'utf8'});
    return files;
  }
  const files=execute(job,!!job.resolution);
  let homology;
  if (job.resolution) {
    const next=resolutionJob(job,files[job.outputs.gb]);
    Object.assign(files,execute(next),next.files);
    files['resolution-session.lsp']=next.script;
    const f=job.resolution.form;
    homology=augmentedHomology(files[next.outputs.anick],f.vars,f.field==='2'?2:f.field==='p'?Number(f.modulus):0,{completeBasis:true,basis:files[next.outputs.gb],degreeBound:next.degreeBound,weights:f.weights});
    homology.shifted=f.augmentation==='monoid';
    files['homology.json']=JSON.stringify(homology,null,2);
  }
  return {files,homology};
}
