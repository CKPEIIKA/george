// SPDX-License-Identifier: MIT
// External coefficients are monitoring data, NEVER production reduction rules.
const profile={"identity": "17c5a3b13bbae1fd6e03ece75139f297d437bda2ae062b093d77a92f091b88bf", "field": "Q", "coefficients": {"14": "346652740", "15": "850296030"}, "source": "https://www.kurims.kyoto-u.ac.jp/preprint/file/RIMS1817.pdf", "page": 122, "provenance": "Kirillov, Appendix IV, Examples 6.2; footnote 35 credits Backelin, Lundqvist and Roos using aalg for degrees 12-15.", "use": "Diagnostic only. Never skips pairs or asserts completion."};
export function beginReference(e,identity,enabled=true,budget=256*1048576){
 const degree=Number(e.gn_stat(3));const target=profile.coefficients[degree];
 if(!enabled||identity!==profile.identity||e.gn_stat(16)!==0n||!target)return null;
 const rc=e.gn_hilbert_upper(degree,BigInt(Math.max(0,Math.floor(budget))));
 if(rc){e.gn_hilbert_release();return {available:false,degree,errorCode:rc};}
 let upper=0n;for(let i=e.gn_hilbert_limbs()-1;i>=0;i--)upper=upper<<32n|BigInt(e.gn_hilbert_limb(degree,i)>>>0);
 e.gn_hilbert_release();return {available:true,degree,upper,rules:e.gn_stat(0),target:BigInt(target)};
}
export function referenceSnapshot(e,monitor){
 if(!monitor)return null;if(!monitor.available)return monitor;
 // With all lower degrees complete, a new monic-in-Q leading word of this
 // degree removes exactly one normal word of that same degree. Distinct new
 // leaders are guaranteed by exact ordered commit reduction, not the reference.
 const upper=monitor.upper-(e.gn_stat(0)-monitor.rules),gap=upper-monitor.target;
 return {available:true,degree:monitor.degree,normalWordsUpperBound:upper.toString(),
  externalDimension:monitor.target.toString(),dimensionGap:gap.toString(),
  referenceConsistent:gap>=0n,source:profile.source,page:profile.page,
  conditionalOnLowerDegreeBasis:true,stoppingCriterionUsed:false,
  runtimePercentage:null,meaning:'Remaining dimension gap, NOT remaining overlaps or time.'};
}
