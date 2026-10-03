// Standalone source bundle; host profiles, executables and raw reports are excluded.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {copyFomkyrSource} from './fomkyr-source.mjs';
const version=JSON.parse(fs.readFileSync('fomkyr/package.json')).version;
const target=path.resolve(process.argv[2]??`build/fomkyr-${version}-source.tar.gz`);
fs.mkdirSync('build',{recursive:true});
const stage=fs.mkdtempSync(path.resolve('build/fomkyr-package-'));
try{
 copyFomkyrSource(path.join(stage,'fomkyr'));
 fs.mkdirSync(path.dirname(target),{recursive:true});
 execFileSync('tar',['--mtime=@0','--owner=0','--group=0','--numeric-owner',
   '-czf',target,'-C',stage,'fomkyr'],{stdio:'inherit'});
 console.log(target);
}finally{fs.rmSync(stage,{recursive:true,force:true});}
