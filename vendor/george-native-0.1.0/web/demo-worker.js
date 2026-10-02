import {NativeEngine} from './engine.js';
let engine;
self.onmessage=async ({data:m})=>{
  if(m.command==='cancel'){engine?.cancel();return;}
  engine=new NativeEngine({...m.options,onEvent:event=>postMessage({event})});
  try {const fixture=await (await fetch(m.fixture??'../fixtures/fk6.json')).json();const result=await engine.compute(fixture,m.degree??7,m.modulus??0);postMessage({result});}
  catch(error){postMessage({error:String(error.message||error),partial:error.native});}
  finally{await engine.close();}
};
