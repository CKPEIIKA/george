/* SPDX-License-Identifier: MIT. Diagnostic reference; never changes exact completion. */
static struct {u32 degree;u64 rules,upper,target;int active;} href;
static void reference_begin(u64 budget){
 memset(&href,0,sizeof(href));u32 d=(u32)gn_stat(3);
 if(strcmp(identity,"17c5a3b13bbae1fd6e03ece75139f297d437bda2ae062b093d77a92f091b88bf")||gn_stat(16)||(d!=14&&d!=15))return;
 u64 freebytes=budget>gn_stat(4)?budget-gn_stat(4):0;
 int rc=gn_hilbert_upper(d,freebytes<256*MIB?freebytes:256*MIB);
 if(rc){gn_hilbert_release();return;}
 u32 n=gn_hilbert_limbs();int wide=0;for(u32 i=2;i<n;i++)if(gn_hilbert_limb(d,i))wide=1;
 u64 upper=(u64)gn_hilbert_limb(d,0)|((u64)gn_hilbert_limb(d,1)<<32);gn_hilbert_release();
 if(wide)return;href.degree=d;href.rules=gn_stat(0);href.upper=upper;
 href.target=d==14?UINT64_C(346652740):UINT64_C(850296030);href.active=1;
}
static void reference_json(Buffer*b){
 if(!href.active)return;u64 delta=gn_stat(0)-href.rules;if(delta>href.upper)return;
 u64 upper=href.upper-delta;buf_printf(b,",\"hilbertReference\":{\"degree\":%u,\"normalWordsUpperBound\":\"%" PRIu64 "\",\"externalDimension\":\"%" PRIu64 "\",\"dimensionGap\":\"%s%" PRIu64 "\",\"referenceConsistent\":%s,\"stoppingCriterionUsed\":false,\"runtimePercentage\":null,\"source\":\"https://www.kurims.kyoto-u.ac.jp/preprint/file/RIMS1817.pdf\",\"page\":122}",href.degree,upper,href.target,upper<href.target?"-":"",upper>=href.target?upper-href.target:href.target-upper,upper>=href.target?"true":"false");
}
