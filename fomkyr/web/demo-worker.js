// SPDX-License-Identifier: MIT
import {FomkyrEngine} from './engine.js';
let engine;
self.onmessage=async({data:m})=>{
  if(m.command==='cancel'){engine?.cancel();return;}
  let outcome;
  engine=new FomkyrEngine({...m.options,onEvent:event=>postMessage({event})});
  try{const fixture=m.data??await(await fetch(m.fixture??'../fixtures/fk6.json')).json();outcome={result:await engine.compute(fixture,(Object.hasOwn(m,'degree')?m.degree:7),m.modulus??0)};}
  catch(error){outcome={error:String(error.message||error),code:error.code,partial:error.native};}
  finally{await engine.close();postMessage(outcome);}
};
