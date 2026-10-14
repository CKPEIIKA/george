// SPDX-License-Identifier: MIT
// No fixed degree-20 restriction; pruning is deliberately NOT fixed off.
export const FOMKYR_CAPABILITIES=Object.freeze({
  choices:{task:['gb'],ring:['noncomm'],order:['degleftlex'],strategy:['default'],nonhomog:['auto','degreewise'],lowterms:['quick','safe'],outmode:['ALG']},
  fixedSettings:{legacy:false,rabbit:'',matrix:'',augmentation:'graded',nmodgen:'1',nlmodgen:'1',nrmodgen:'1'},
  numericRanges:{maxdeg:{min:1,max:0xfffffffe,required:false},maxserdeg:{min:1,max:0xfffffffe,required:false}},
  homogeneous:true,maximumGenerators:16,console:false,
});
