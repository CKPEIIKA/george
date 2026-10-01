// Called only by the main-branch workflow. Deployment runs on gh-pages.
import {execFileSync} from 'node:child_process';
import {pagesTree} from './pages-tree.mjs';

if(process.env.GITHUB_REF!=='refs/heads/main')throw Error('Only main may publish the site branch.');
const token=process.env.GITHUB_TOKEN,repository=process.env.GITHUB_REPOSITORY;
if(!token||!repository||!/^[-\w.]+\/[-\w.]+$/.test(repository))throw Error('Missing GitHub Actions context.');
const git=(args,options={})=>execFileSync('git',args,{encoding:'utf8',...options}).trim();
const source=git(['rev-parse','HEAD']),tree=pagesTree(source);
let published;
for(let attempt=0;attempt<3;attempt++){
  git(['fetch','origin','gh-pages']);
  const parent=git(['rev-parse','FETCH_HEAD']);
  if(git(['rev-parse',`${parent}^{tree}`])===tree){
    console.log('The exact site tree is already on gh-pages.');
    if(process.env.GITHUB_EVENT_NAME!=='workflow_dispatch')process.exit(0);
    published=parent;break;
  }
  const env={...process.env,GIT_AUTHOR_NAME:'github-actions[bot]',GIT_AUTHOR_EMAIL:'41898282+github-actions[bot]@users.noreply.github.com',GIT_COMMITTER_NAME:'github-actions[bot]',GIT_COMMITTER_EMAIL:'41898282+github-actions[bot]@users.noreply.github.com'};
  const commit=git(['commit-tree',tree,'-p',parent],{env,input:`Publish George site from ${source}\n`});
  try{git(['push','origin',`${commit}:refs/heads/gh-pages`]);published=commit;break;}
  catch(error){if(attempt===2)throw error;}
}
console.log(`Published site commit ${published} on gh-pages.`);
// GITHUB_TOKEN pushes do not trigger another push workflow. Dispatch the
// workflow explicitly with a gh-pages ref so its environment policy matches.
const response=await fetch(`https://api.github.com/repos/${repository}/actions/workflows/pages.yml/dispatches`,{
  method:'POST',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:JSON.stringify({ref:'gh-pages'}),signal:AbortSignal.timeout(30000),
});
if(!response.ok)throw Error(`Could not start gh-pages deployment: HTTP ${response.status}.`);
console.log('Started the deployment workflow on gh-pages.');
