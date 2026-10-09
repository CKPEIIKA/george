// The site branch contains web/ at its root plus its deployment workflow.
// Symbolic links in web/ are replaced by the files they name, and the George
// and fomkyr source archives are built from the same commit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {SOURCE_ARCHIVES} from './source-archives.mjs';

export function pagesTree(sourceCommit){
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'george-pages-index-'));
  const env={...process.env,GIT_INDEX_FILE:path.join(temporary,'index')};
  const git=(args,input)=>execFileSync('git',args,{env,input,encoding:'utf8',maxBuffer:1<<26}).trim();
  try{
    git(['read-tree',`${sourceCommit}:web`]);
    for(const line of git(['ls-files','-s','-z']).split('\0').filter(Boolean)){
      const [info,file]=line.split('\t'),[mode,link]=info.split(' ');
      if(mode!=='120000')continue;
      const target=path.posix.normalize(path.posix.join('web',path.posix.dirname(file),git(['cat-file','blob',link])));
      const [targetMode,,blob]=git(['ls-tree',sourceCommit,'--',target]).split(/\s+/);
      if(!/^100(?:644|755)$/.test(targetMode??''))throw Error(`Site link ${file} does not name a file in the commit.`);
      git(['update-index','--cacheinfo',`100644,${blob},${file}`]);
    }
    for(const [name,build] of Object.entries(SOURCE_ARCHIVES)){
      const file=path.join(temporary,name);fs.writeFileSync(file,build(sourceCommit));
      git(['update-index','--add','--cacheinfo','100644',git(['hash-object','-w',file]),'sources/'+name]);
    }
    const workflow=git(['rev-parse',`${sourceCommit}:.github/workflows/pages.yml`]);
    git(['update-index','--add','--cacheinfo','100644',workflow,'.github/workflows/pages.yml']);
    return git(['write-tree']);
  }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
