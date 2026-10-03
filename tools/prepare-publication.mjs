// Prepare publication branches; --update advances existing prepared refs with
// compare-and-swap protection. Remote publication is a separate user action.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {pagesTree} from './pages-tree.mjs';

const git=(args,input)=>execFileSync('git',args,{input,encoding:'utf8',maxBuffer:16e6}).trimEnd();
const original=git(['rev-parse','HEAD']);
const oldPages=git(['rev-parse','refs/heads/gh-pages']);
const tree=git(['rev-parse',original+':web']);
const refs=['refs/heads/publish/main','refs/heads/publish/gh-pages'];
const update=process.argv.includes('--update'),fastForward=process.argv.includes('--fast-forward'),previous=new Map();
for(const ref of refs){
  let existing;try{existing=git(['rev-parse','--verify',ref]);}catch{}
  assert.ok(!existing||update,ref+' already exists; use --update to advance the prepared release.');
  previous.set(ref,existing||'0'.repeat(40));
}
const map=new Map(),rewritten=[];
function clean(id){
  if(map.has(id))return map.get(id);
  const raw=execFileSync('git',['cat-file','commit',id],{encoding:'utf8',maxBuffer:16e6});
  const split=raw.indexOf('\n\n'),headers=raw.slice(0,split),body=raw.slice(split+2);
  const parents=[...headers.matchAll(/^parent ([a-f0-9]{40})$/gm)].map(m=>m[1]);
  let nextHeaders=headers;
  for(const parent of parents)nextHeaders=nextHeaders.replace('parent '+parent,'parent '+clean(parent));
  const nextBody=body.replace(/^Co-Authored-By:[^\n]*(?:Claude|anthropic)[^\n]*\n/gim,'');
  if(nextHeaders===headers&&nextBody===body){map.set(id,id);return id;}
  // A rewritten commit cannot retain a signature over the former object.
  nextHeaders=nextHeaders.replace(/^gpgsig(?:-sha256)? [^\n]*(?:\n [^\n]*)*/gm,'').replace(/\n\n+/g,'\n').replace(/\n+$/,'');
  const next=git(['hash-object','-t','commit','-w','--stdin'],nextHeaders+'\n\n'+nextBody);
  assert.equal(git(['rev-parse',id+'^{tree}']),git(['rev-parse',next+'^{tree}']));
  map.set(id,next);rewritten.push({original:id,clean:next});return next;
}
const main=clean(original),pagesParent=clean(previous.get(refs[1])==='0'.repeat(40)?oldPages:previous.get(refs[1]));
const workflow=git(['show',main+':.github/workflows/pages.yml']);
assert.match(workflow,/name: github-pages\b/);
assert.match(workflow,/if: github\.ref == 'refs\/heads\/gh-pages'/,'Deployment must originate on gh-pages.');
const siteTree=pagesTree(main);
const out='build/publication';fs.mkdirSync(out,{recursive:true});
const body=path.resolve(out,'pages-message.txt');
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
fs.writeFileSync(body,`Publish George ${version} with Bergman and fomkyr engines\n`);
const pages=git(['commit-tree',siteTree,'-p',pagesParent,'-F',body]);
const leases=Object.fromEntries(['main','gh-pages'].map(branch=>[branch,git(['rev-parse','refs/remotes/origin/'+branch])]));
if(fastForward){
  git(['merge-base','--is-ancestor',leases.main,main]);
  git(['merge-base','--is-ancestor',leases['gh-pages'],pages]);
}
git(['update-ref','--stdin'],`start\nupdate ${refs[0]} ${main} ${previous.get(refs[0])}\nupdate ${refs[1]} ${pages} ${previous.get(refs[1])}\nprepare\ncommit\n`);
for(const ref of refs){
  const history=git(['log',ref,'--format=%an <%ae>%n%B']);
  assert.doesNotMatch(history,/^Co-Authored-By:.*(?:Claude|anthropic)/im);
  assert.doesNotMatch(history,/^.*Claude.*<.*>$/im);
}
assert.equal(git(['rev-parse',refs[0]+'^{tree}']),git(['rev-parse',original+'^{tree}']));
assert.equal(git(['rev-parse',refs[1]+'^{tree}']),siteTree);
const command=fastForward
  ? 'git push --atomic origin publish/main:main publish/gh-pages:gh-pages'
  : `git push --atomic --force-with-lease=refs/heads/main:${leases.main} --force-with-lease=refs/heads/gh-pages:${leases['gh-pages']} origin publish/main:main publish/gh-pages:gh-pages`;
const plan={date:new Date().toISOString(),original,oldPages,main,pages,pagesParent,webTree:tree,pagesTree:siteTree,
  rewritten,leases,command,deploymentBranch:'gh-pages',deploymentEnvironment:'github-pages',verifyDeployment:true,fastForwardOnly:fastForward,remotePublication:false,originalRefsPreserved:true};
fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(plan,null,2)+'\n');
fs.writeFileSync(path.join(out,'publish.sh'),`#!/bin/sh
set -eu
# Optional key argument: starts an agent in this shell if necessary. A key
# passphrase is entered into ssh-add, never stored in this script or Git.
if [ "$#" -gt 0 ]; then
  key=$1
  if [ -z "\${SSH_AUTH_SOCK:-}" ] || ! ssh-add -l >/dev/null 2>&1; then
    eval "$(ssh-agent -s)" >/dev/null
    trap 'ssh-agent -k >/dev/null 2>&1 || true' EXIT
  fi
  ssh-add "$key"
fi
cd "$(git rev-parse --show-toplevel)"
# Refuse stale prepared refs; publish the exact commits reviewed in the plan.
test "$(git rev-parse publish/main)" = '${main}'
test "$(git rev-parse publish/gh-pages)" = '${pages}'
${command}
node tools/wait-for-pages.mjs '${pages}'
`);
console.log(JSON.stringify({main,pages,webTree:tree,rewritten:rewritten.length,plan:path.join(out,'plan.json'),remotePublication:false},null,2));
