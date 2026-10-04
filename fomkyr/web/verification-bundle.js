// SPDX-License-Identifier: MIT
import {identityOf,sha256} from './storage.js';
import {blobSHA256} from './sha256-stream.js';
import {FK_GATE_PROFILE_ID,FK_GATE_INPUT_ID,sameFkGateProfile} from './fk-gate.js';
export const VERIFICATION_ASSETS=['verify.py','README.txt','LICENSE.txt','fk6-exact-through17.json','fk6_sectors.h','fk6_q.h','proof-provenance.json'];
const jsonBlob=value=>new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'});
export function verificationAvailable(result){return result?.complete===true&&result.storage==='opfs'&&result.completedThroughDegree>0&&!!result.runKey;}
export async function verificationEntries({fixture,result,openFile,fetchAsset=async name=>{
  const response=await fetch(new URL('verification/'+name,import.meta.url));if(!response.ok)throw Error('Verification asset unavailable: '+name);return response.blob();
},onProgress}){
  if(!verificationAvailable(result))throw Error('A completed result in persistent storage is required');
  const identity=await identityOf(fixture,result.modulus);if(identity!==result.identity)throw Error('Presentation does not match the computed result');
  const degree=result.completedThroughDegree,envelope=JSON.parse(await (await openFile(`checkpoint-${degree%2}.json`)).text()),cp=envelope.payload;
  if(envelope.schema!==2||!cp||await sha256(JSON.stringify(cp))!==envelope.sha256||cp.partial||cp.identity!==identity||cp.completedThroughDegree!==degree||cp.basisSize!==result.basisSize||cp.diskBytes!==result.diskBytes)throw Error('The saved computation changed; compute again before exporting it');
  if(cp.fkGateProfileId&&(!result.fkGateProfileId||!sameFkGateProfile(cp.fkGateProfileId,result.fkGateProfileId)))throw Error('Checkpoint gate authority mismatch');
  const basis=await openFile('basis.gnb');if(basis.size<cp.diskBytes)throw Error('Incomplete saved basis');
  const entries=[{name:'presentation.json',blob:jsonBlob({variables:fixture.variables,relations:fixture.relations,modulus:result.modulus,order:result.order})},{name:'basis.gnb',blob:basis.slice(0,cp.diskBytes)},{name:'checkpoint.json',blob:jsonBlob(envelope)},{name:'fomkyr-result.json',blob:jsonBlob({...result,preview:undefined})}];
  if(result.fullBasisPath)entries.push({name:'result.gb',blob:await openFile('result.gb')});
  if(result.hilbert)entries.push({name:'hilbert.json',blob:jsonBlob(result.hilbert)});
  for(const name of VERIFICATION_ASSETS)entries.push({name,blob:await fetchAsset(name)});
  const asset=name=>entries.find(e=>e.name===name).blob;
  // The authority binds exactly the same three files as the compiled consumer.
  if(await blobSHA256(new Blob([asset('fk6_q.h'),asset('fk6_sectors.h'),asset('proof-provenance.json')]))!==FK_GATE_PROFILE_ID)throw Error('Gate profile byte binding failed');
  const profile=JSON.parse(await asset('fk6-exact-through17.json').text()),provenance=JSON.parse(await asset('proof-provenance.json').text());
  const gate=result.fkGate??{},eventClosed=gate.status===3&&gate.degree===degree&&gate.upper===gate.lower&&gate.deficit==='0';
  const coefficients=result.hilbert?.coefficients,expected=identity===FK_GATE_INPUT_ID&&degree<=profile.throughDegree?String(profile.dimensions[degree]):null;
  const recounted=eventClosed?gate.upper:coefficients?.[degree]!=null?String(coefficients[degree]):null;
  if(expected!==null&&recounted!==null&&expected!==recounted)throw Error('Final Hilbert count disagrees with the gate profile');
  const files={};for(const entry of entries){onProgress?.(entry.name);files[entry.name]={bytes:entry.blob.size,sha256:await blobSHA256(entry.blob)};}
  const manifest={schema:1,kind:'fomkyr-computation-verification-bundle',engineVersion:result.version,field:result.modulus===0?'Q':`F_${result.modulus}`,modulus:result.modulus,order:result.order,completedThroughDegree:degree,presentationSHA256:identity,basisSHA256:files['basis.gnb'].sha256,basisSize:result.basisSize,unrestrictedBasisComplete:result.unrestrictedBasisComplete===true,settings:{workers:result.workers,bits:result.bits,executionMode:result.executionMode,memoryPlan:result.memoryPlan,scheduler:result.scheduler},gateProfileId:result.fkGateProfileId??null,gateProfileThroughDegree:result.certifiedProfileThroughDegree??null,gateCertificateSHA256:result.fkGateProfileId?provenance.proofBundleDigestSHA256:null,finalScalarRecount:{degree,value:recounted,expected,passed:recounted!==null&&(expected===null||recounted===expected),source:eventClosed?'gate fresh scalar recount':recounted!==null?'completed-basis Hilbert calculation':'not requested'},verification:{fileIntegrity:'SHA-256 for every payload',independentGroebnerCertificate:false,independentCheckStatus:'not-run',profileProofReplayedHere:false,conditionalOnImportedFkDimensions:result.conditionalOnImportedFkDimensions===true,conditionalOnExternalDimensions:result.conditionalOnExternalDimensions===true},files};
  entries.unshift({name:'manifest.json',blob:jsonBlob(manifest)});return entries;
}
