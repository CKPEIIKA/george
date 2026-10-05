/* SPDX-License-Identifier: MIT. Bounded, deterministic reduced-basis export.
 * At most one output row per active lane is retained; the exact packed basis
 * is immutable. Replace an earlier text export only after a successful write. */
static char*coefficient_text(u64 c,u64 origin,int*negative){
 if(c&1){const unsigned char*p=native_pointer(origin+(c&~UINT64_C(7)));*negative=!!(c&2);return decimal_magnitude(p+8,rd32(p));}
 i64 v=((i64)c)>>1;*negative=v<0;Buffer s={0};buf_printf(&s,"%"PRIu64,*negative?(u64)-v:(u64)v);return s.s;
}
static u32 export_letter(const unsigned char*p,u64 lo,u64 hi,u32 degree,u32 at){
 if(hi&(UINT64_C(1)<<63))return p[lo+at];
 u32 shift=4*(degree-1-at);return shift>=64?(u32)((hi>>(shift-64))&15):(u32)((lo>>shift)&15);
}
static int export_order(const void*aa,const void*bb){
 u32 a=*(const u32*)aa,b=*(const u32*)bb,da=(u32)gn_rule_stat(a,2),db=(u32)gn_rule_stat(b,2);
 if(da!=db)return da<db?-1:1;
 u64 ah=gn_rule_stat(a,1),bh=gn_rule_stat(b,1),al=gn_rule_stat(a,0),bl=gn_rule_stat(b,0);
 if(da<=GN_INLINE_DEGREE){if(ah!=bh)return ah>bh?-1:1;return al>bl?-1:al<bl?1:0;}
 int c=memcmp(native_pointer(al),native_pointer(bl),da);return c>0?-1:c<0?1:0;
}
static int export_row(FILE*out,Fixture*f,u64 off,u32 lane){
 const unsigned char*p=native_pointer(off);u32 n=rd32(p+8),d=rd32(p+12);exported_terms+=n;
 for(u32 j=0;j<n;j++){
  const unsigned char*t=p+32+(size_t)j*24;u64 lo=rd64(t),hi=rd64(t+8),num=rd64(t+16),den=2,origin=off;
  if(!raw_export){u64 ratio=gn_monic_coefficient(lane,j);if(!ratio)return (int)gn_normalize_status(lane);const unsigned char*q=native_pointer(ratio);num=rd64(q);den=rd64(q+8);origin=0;}
  int negative=0,unused=0;char*a=coefficient_text(num,origin,&negative),*b=coefficient_text(den,origin,&unused);
  if(!a||!b){free(a);free(b);return GN_MEMORY;}
  if(negative)fputc('-',out);else if(j)fputc('+',out);
  if(strcmp(b,"1"))fprintf(out,"%s/%s*",a,b);else if(strcmp(a,"1"))fprintf(out,"%s*",a);
  free(a);free(b);
  for(u32 k=0;k<d;){u32 letter=export_letter(p,lo,hi,d,k),next=k+1;while(next<d&&export_letter(p,lo,hi,d,next)==letter)next++;if(k)fputc('*',out);fputs(f->vars[letter],out);if(next-k>1)fprintf(out,"^%u",next-k);k=next;}
 }
 fputs(",\n",out);return ferror(out)?GN_IO:0;
}
static int export_basis(Fixture*f){
 char*path=path_join(run_dir,"result.gb"),*tmp=path_join(run_dir,"result.gb.partial");
 FILE*out=fopen(tmp,"w");if(!out){free(path);free(tmp);return GN_IO;}
 int rc=0;double begin=gn_host_clock(),last=begin;u32 rules=(u32)gn_stat(0),workers=(u32)gn_stat(10),degree=0;
 // Thread rendezvous costs more than these short reductions. Larger exports
 // retain multicore processing; scratch/cache allocations remain unchanged.
 if(gn_stat(1)<65536)workers=1;normalization_workers=workers;
 u32*ids=malloc((size_t)(rules?rules:1)*sizeof(u32));if(!ids)rc=GN_MEMORY;
 if(ids){for(u32 i=0;i<rules;i++)ids[i]=i+1;if(!raw_export)qsort(ids,rules,sizeof(u32),export_order);}
 if(!rc&&!raw_export)rc=gn_normalize_prepare();
 fprintf(out,"%% fomkyr %s; completed through degree %"PRIu64"; reduced:%s; normalization:%s\n",VERSION,gn_stat(2),raw_export?"false":"true",raw_export?"primitive-integer":"monic-tail-reduced");
 if(hc.enabled)fprintf(out,"%%%% Hilbert closure evidence %s; mode:%s; conditionalOnExternalDimensions:%s\n",hc.key,hc.assumed?"external-assumption":"replayed-integer-duals",hc.assumed?"true":"false");
 if(fg_enabled)fprintf(out,"%%%% FK Gate 0.3 profile %s; conditionalOnImportedFkDimensions:true; proofReplayedHere:false\n",FKG_AUTHORITY_ID);
 for(u32 first=1;!rc&&first<=rules;){
  u32 active=raw_export?1:workers;if(active>rules-first+1)active=rules-first+1;
  if(!raw_export)pool_normalize(ids+first-1,active);
  for(u32 i=0;i<active&&!rc;i++){
   u32 id=ids[first+i-1],lane=raw_export?0:i;u64 off=raw_export?gn_export_rule(id):pool.output[i];
   if(!off&&!raw_export&&gn_normalize_status(lane)==GN_DEFERRED){lane=0;off=gn_normalize_rule(0,id);}
   if(!off){rc=raw_export?GN_SCRATCH:(int)gn_normalize_status(lane);if(!rc)rc=GN_STATE;break;}
   u32 next=(u32)gn_rule_stat(id,2);if(next!=degree){fprintf(out,"\n%% %u\n",next);degree=next;}
   rc=export_row(out,f,off,lane);
  }
  first+=active;double now=gn_host_clock();
  if(!quiet&&now-last>=progress_ms){log_json(stderr,"{\"event\":\"normalization\",\"completedRows\":%u,\"totalRows\":%u,\"elapsedSeconds\":%.3f}\n",first-1,rules,(now-begin)/1000);last=now;}
 }
 if(!rc){fputs("Done\n",out);if(fflush(out)||fsync(fileno(out))||ferror(out))rc=GN_IO;}
 if(fclose(out)&&!rc)rc=GN_IO;
 if(!rc&&rename(tmp,path))rc=GN_IO;if(rc)unlink(tmp);
 normalization_seconds=(gn_host_clock()-begin)/1000;free(ids);free(path);free(tmp);return rc;
}
