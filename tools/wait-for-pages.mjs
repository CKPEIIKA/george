// Confirm the pushed commit's workflow and the served release, without gh.
import {execFileSync} from 'node:child_process';
import {publicationAssets} from './publication-assets.mjs';
import {streamSha256, gitBlobSha256} from './stream-hash.mjs';

const commit=process.argv[2];
if(!/^[0-9a-f]{40}$/.test(commit||''))throw Error('Supply the prepared gh-pages commit.');
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
const remote=git(['remote','get-url','origin']);
const match=remote.match(/^(?:git@github\.com:|https:\/\/github\.com\/|ssh:\/\/git@github\.com\/)([^/]+)\/([^/]+?)(?:\.git)?$/);
if(!match)throw Error('Deployment verification requires a github.com origin.');
const [,owner,repo]=match;
const site=`https://${owner.toLowerCase()}.github.io/${repo}/`;
const files=publicationAssets(git(['ls-tree','-r','--name-only',commit]).split('\n'));
const expected={};
for(const file of files)expected[file]=await gitBlobSha256(commit,file);
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
const headers={Accept:'application/vnd.github+json',...(token?{Authorization:`Bearer ${token}`}:{})};
const runs=`https://api.github.com/repos/${owner}/${repo}/actions/workflows/pages.yml/runs?branch=gh-pages&head_sha=${commit}&per_page=5`;
const deadline=Date.now()+15*60*1000;
let previous='',deployed=false,runUrl;
const progress=message=>{if(message!==previous){console.log(message);previous=message;}};
console.log(`Waiting for ${commit.slice(0,7)} to deploy to ${site}`);
while(Date.now()<deadline){
  try{
    if(!deployed){
      const response=await fetch(runs,{headers,signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error(`GitHub workflow status returned HTTP ${response.status}.`);
      const data=await response.json();
      const run=data.workflow_runs.find(run=>run.head_sha===commit);
      if(!run)progress('Waiting for the Pages workflow to start.');
      else{
        runUrl=run.html_url;
        if(run.status==='completed'){
          if(run.conclusion!=='success')throw Object.assign(Error(`Pages deployment ${run.conclusion}: ${runUrl}`),{fatal:true});
          deployed=true;progress('Pages workflow succeeded; checking the published release.');
        }else progress(`Pages workflow ${run.status}: ${runUrl}`);
      }
    }
    if(deployed){
      let matches=true;
      for(const file of files){
        const url=new URL(file,site);url.searchParams.set('release',commit);
        const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});
        if(!response.ok||await streamSha256(response.body)!==expected[file]){matches=false;break;}
      }
      if(matches){console.log(`Published and verified: ${site}`);process.exit(0);}
      progress('Waiting for GitHub Pages to serve the exact release files.');
    }
  }catch(error){
    if(error.fatal){console.error(error.message);process.exit(1);}
    progress(error.message);
  }
  await new Promise(resolve=>setTimeout(resolve,20000));
}
throw Error(`Timed out waiting for deployment. ${runUrl||`https://github.com/${owner}/${repo}/actions`}`);
