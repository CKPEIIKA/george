// SPDX-License-Identifier: MIT
// Registry-based George versions can load this without initializing ECL.
import {dispatchFomkyr} from './george-entry.js';
self.onmessage=async({data})=>{
  try{await dispatchFomkyr({...data,backend:'fomkyr'},m=>postMessage(m));}
  catch(error){postMessage({id:data.id,error:error.message||String(error)});}
};
