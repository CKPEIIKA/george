// Prepare reviewable local publication branches; never push or replace old refs.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const git=(args,input)=>execFileSync('git',args,{input,encoding:'utf8',maxBuffer:16e6}).trimEnd();
const original=git(['rev-parse','HEAD']);
const oldPages=git(['rev-parse','refs/heads/gh-pages']);
const tree=git(['rev-parse',original+':web']);
const refs=['refs/heads/publish/main','refs/heads/publish/gh-pages'];
for(const ref of refs){
  let existing;try{existing=git(['rev-parse','--verify',ref]);}catch{}
  assert.ok(!existing,ref+' already exists; preserve it and choose new branch names.');
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
const main=clean(original),pagesParent=clean(oldPages);
const out='build/publication';fs.mkdirSync(out,{recursive:true});
const body=path.resolve(out,'pages-message.txt');
fs.writeFileSync(body,'Publish validated bergman-1.001-fix interface and engine\n');
const pages=git(['commit-tree',tree,'-p',pagesParent,'-F',body]);
const zero='0'.repeat(40);
git(['update-ref','--stdin'],`start\nupdate ${refs[0]} ${main} ${zero}\nupdate ${refs[1]} ${pages} ${zero}\nprepare\ncommit\n`);
for(const ref of refs){
  const history=git(['log',ref,'--format=%an <%ae>%n%B']);
  assert.doesNotMatch(history,/^Co-Authored-By:.*(?:Claude|anthropic)/im);
  assert.doesNotMatch(history,/^.*Claude.*<.*>$/im);
}
assert.equal(git(['rev-parse',refs[0]+'^{tree}']),git(['rev-parse',original+'^{tree}']));
assert.equal(git(['rev-parse',refs[1]+'^{tree}']),tree);
const leases=Object.fromEntries(['main','gh-pages'].map(branch=>[branch,git(['rev-parse','refs/remotes/origin/'+branch])]));
const command=`git push --atomic --force-with-lease=refs/heads/main:${leases.main} --force-with-lease=refs/heads/gh-pages:${leases['gh-pages']} origin publish/main:main publish/gh-pages:gh-pages`;
const plan={date:new Date().toISOString(),original,oldPages,main,pages,pagesParent,webTree:tree,
  rewritten,leases,command,remotePublication:false,originalRefsPreserved:true};
fs.writeFileSync(path.join(out,'plan.json'),JSON.stringify(plan,null,2)+'\n');
fs.writeFileSync(path.join(out,'publish.sh'),'#!/bin/sh\nset -eu\n'+command+'\n');
console.log(JSON.stringify({main,pages,webTree:tree,rewritten:rewritten.length,plan:path.join(out,'plan.json'),remotePublication:false},null,2));
