// The site branch contains web/ at its root plus its deployment workflow.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

export function pagesTree(sourceCommit){
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'george-pages-index-'));
  const env={...process.env,GIT_INDEX_FILE:path.join(temporary,'index')};
  const git=args=>execFileSync('git',args,{env,encoding:'utf8'}).trim();
  try{
    git(['read-tree',`${sourceCommit}:web`]);
    const workflow=git(['rev-parse',`${sourceCommit}:.github/workflows/pages.yml`]);
    git(['update-index','--add','--cacheinfo','100644',workflow,'.github/workflows/pages.yml']);
    return git(['write-tree']);
  }finally{fs.rmSync(temporary,{recursive:true,force:true});}
}
