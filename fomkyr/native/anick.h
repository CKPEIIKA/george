/* SPDX-License-Identifier: MIT -- text/JSON export; mathematics lives in C kernel. */
static void anick_word(Buffer*b,u32 id,u32 term,int algebra){
 u32 n=algebra?gn_anick_term_stat(id,term,1):gn_anick_chain_stat(id,1);buf_add(b,"[");
 for(u32 j=0;j<n;j++)buf_printf(b,"%s%u",j?",":"",1+(algebra?gn_anick_term_letter(id,term,j):gn_anick_chain_letter(id,j)));buf_add(b,"]");
}
static int anick_coefficient(Buffer*b,u32 id,u32 term,u32 denominator){
 u32 n=gn_anick_term_stat(id,term,denominator?3:2);if(n>32*MIB/16)return GN_MEMORY;
 unsigned char*digits=calloc(n?n:1,4);if(!digits)return GN_MEMORY;
 for(u32 i=0;i<n;i++){u32 x=gn_anick_term_limb(id,term,denominator,i);for(u32 j=0;j<4;j++)digits[i*4+j]=(unsigned char)(x>>(8*j));}
 char*s=decimal_magnitude(digits,n);free(digits);if(!s)return GN_MEMORY;
 buf_add(b,"\"");if(!denominator&&gn_anick_term_stat(id,term,4))buf_add(b,"-");buf_add(b,s);buf_add(b,"\"");free(s);return 0;
}
static int export_anick(Fixture*f,u32 D,u64 budget){
 u64 side=(u64)D+1;if(side>32*MIB/160||side>32*MIB/160/side)return GN_MEMORY;
 int rc=gn_anick(D,MIN(budget-gn_stat(4),256*MIB));if(rc)return rc;
 Buffer b={0},csv={0},resolution={0},text={0};u64 n=gn_anick_stat(0),terms=gn_anick_stat(1),outlimit=32*MIB;
 if(n>(outlimit/(2*(u64)D+128))||terms>outlimit/128){rc=GN_MEMORY;goto an_done;}
 buf_printf(&b,"{\"available\":true,\"kind\":\"graded\",\"algebra\":\"original\",\"modulus\":%u,\"certifiedThroughDegree\":%u,\"augmentation\":\"generators-to-zero\",\"moduleSide\":\"right\",\"originalAlgebraBettiNumbers\":true,\"minimalResolutionConstructed\":false,\"checkedFullSquareZero\":true,\"exactRanks\":true,\"chainCount\":%"PRIu64",\"differentialTerms\":%"PRIu64",\"coefficients\":[",gn_modulus(),D,n,terms);
 buf_add(&csv,"homological_degree,internal_degree,chain_count,differential_rank,incoming_rank,betti,conditional\n");u32 first=1;
 for(u32 p=0;p<=D;p++)for(u32 d=p;d<=D;d++){
  u32 count=gn_anick_count(p,d),rank=gn_anick_rank(p,d),incoming=gn_anick_rank(p+1,d);if(rank>count||incoming>count-rank){rc=GN_CORRUPT;goto an_done;}if(!count)continue;u32 betti=count-rank-incoming;
  buf_printf(&b,"%s{\"homological\":%u,\"internal\":%u,\"chains\":\"%u\",\"differentialRank\":\"%u\",\"incomingRank\":\"%u\",\"dimension\":\"%u\"}",first?"":",",p,d,count,rank,incoming,betti);first=0;
  buf_printf(&csv,"%u,%u,%u,%u,%u,%u,%s\n",p,d,count,rank,incoming,betti,((hc.enabled&&hc.assumed)||fg_enabled)?"true":"false");
 }
 buf_add(&b,"]");if(hc.enabled)closure_metadata(&b);if(fg_enabled)fg_metadata(&b);buf_add(&b,"}\n");
 buf_printf(&resolution,"{\"format\":\"george-resolution\",\"version\":1,\"modulus\":%u,\"engine\":\"fomkyr\",\"internalDegreeBound\":%u,\"emptyResolution\":%s,\"generators\":%s}\n",gn_modulus(),D,n==1?"true":"false",f->variables_json);
 for(u32 id=1;id<n;id++){
  buf_printf(&resolution,"{\"degree\":%u,\"chain\":",gn_anick_chain_stat(id,0)-1);anick_word(&resolution,id,0,0);buf_add(&resolution,",\"terms\":[");
  for(u32 j=0;j<gn_anick_chain_stat(id,2);j++){
   buf_printf(&resolution,"%s{\"target\":",j?",":"");anick_word(&resolution,gn_anick_term_stat(id,j,0),0,0);buf_add(&resolution,",\"word\":");anick_word(&resolution,id,j,1);buf_add(&resolution,",\"coefficient\":[");rc=anick_coefficient(&resolution,id,j,0);if(rc)goto an_done;buf_add(&resolution,",");rc=anick_coefficient(&resolution,id,j,1);if(rc)goto an_done;buf_add(&resolution,"]}");
   if(resolution.n+b.n+csv.n>outlimit){rc=GN_MEMORY;goto an_done;}
  }buf_add(&resolution,"]}\n");
 }
 buf_printf(&text,"%% Fomkyr: actual Betti numbers through internal degree %u.\n%% Full right-module differentials: resolution.jsonl.\n     ",D);
 for(u32 p=0;p<=D;p++)buf_printf(&text," %u",p);buf_add(&text,"\n      +");for(u32 p=0;p<=D;p++)buf_add(&text,"---");buf_add(&text,"\n");
 for(u32 r=0;r<=D;r++){buf_printf(&text,"%u |",r);for(u32 p=0;p+r<=D;p++){u32 d=p+r,beta=gn_anick_count(p,d)-gn_anick_rank(p,d)-gn_anick_rank(p+1,d);if(beta)buf_printf(&text," %u",beta);else buf_add(&text," -");}buf_add(&text,"\n");}
 if(write_atomic(run_dir,"resolution.jsonl",resolution.s,resolution.n)||write_atomic(run_dir,"betti.json",b.s,b.n)||write_atomic(run_dir,"betti.csv",csv.s,csv.n)||write_atomic(run_dir,"result.anick",text.s,text.n))rc=GN_IO;
 an_done:buf_free(&b);buf_free(&csv);buf_free(&resolution);buf_free(&text);gn_anick_release();return rc;
}
