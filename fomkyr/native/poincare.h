/* SPDX-License-Identifier: MIT -- host formatting; all counts come from C API. */
static int export_poincare(u32 degree,u64 budget,int globally_complete){
 u64 side=(u64)degree+1,digits=((u64)degree*2)+1;
 if(side>UINT64_MAX/side||side*side>32*MIB/(160+3*digits))return GN_MEMORY;
 u64 left=budget-gn_stat(4);int rc=gn_poincare(degree,MIN(left,256*MIB));if(rc)return rc;
 Buffer b={0},csv={0},text={0};u32 limbs=gn_poincare_limbs();unsigned char*buf=malloc((size_t)limbs*4);if(!buf){gn_poincare_release();return GN_MEMORY;}
 buf_printf(&b,"{\"available\":true,\"algebra\":\"associated-monomial\",\"certifiedThroughDegree\":%u,\"basisCompletionProved\":%s,\"homologicalVariable\":\"z\",\"internalVariable\":\"t\",\"monomialBettiNumbers\":true,\"originalAlgebraBettiNumbers\":false,\"indexing\":\"C0=1; C1=surviving generators; C2=minimal leading obstructions\",\"coefficients\":[",degree,globally_complete?"true":"false");
 buf_add(&csv,"homological_degree,internal_degree,monomial_betti\n");u32 first=1;
 for(u32 d=0;d<=degree;d++){
  u32 line=0;
  for(u32 p=0;p<=d;p++){
   u32 nonzero=0;for(u32 i=0;i<limbs;i++){u32 v=gn_poincare_limb(p,d,i);nonzero|=v;for(u32 k=0;k<4;k++)buf[i*4+k]=(unsigned char)(v>>(8*k));}if(!nonzero)continue;
   char*s=decimal_magnitude(buf,limbs);if(!s){rc=GN_MEMORY;goto pb_done;}
   buf_printf(&b,"%s{\"homological\":%u,\"internal\":%u,\"dimension\":\"%s\"}",first?"":",",p,d,s);first=0;
   buf_printf(&csv,"%u,%u,%s\n",p,d,s);if(!line)buf_printf(&text,"+t^%u*(",d);buf_printf(&text,"%s%s*z^%u",line?"+":"",s,p);line=1;free(s);
  }if(line)buf_add(&text,")\n");
 }
 buf_printf(&text,"+O(t^%u)\n",degree+1);
 buf_printf(&b,"],\"tailStates\":%"PRIu64",\"edges\":%"PRIu64",\"minimalObstructions\":%"PRIu64",\"activeGenerators\":%"PRIu64",\"temporaryBytes\":%"PRIu64",\"extrapolated\":false",gn_poincare_stat(0),gn_poincare_stat(1),gn_poincare_stat(2),gn_poincare_stat(3),gn_poincare_stat(4));
 if(hc.enabled)closure_metadata(&b);if(fg_enabled)fg_metadata(&b);buf_add(&b,"}");
 if(write_atomic(run_dir,"poincare.json",b.s,b.n)||write_atomic(run_dir,"poincare.csv",csv.s,csv.n)||write_atomic(run_dir,"result.pb",text.s,text.n))rc=GN_IO;
 pb_done:free(buf);buf_free(&b);buf_free(&csv);buf_free(&text);gn_poincare_release();return rc;
}
