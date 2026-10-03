/* SPDX-License-Identifier: MIT
 * Aho-Corasick normal-word counting, through a certified completed degree.
 * Limb capacity is computed from h_d <= generators^d, not a fixed 128-bit
 * integer. Degree/output/automaton sizes are checked against the byte budget.
 */
static int count_add(u32*out,const u32*in,u32 limbs){
 u64 carry=0;for(u32 i=0;i<limbs;i++){u64 v=(u64)out[i]+in[i]+carry;out[i]=(u32)v;carry=v>>32;}return carry?GN_LIMIT:0;
}
API u32 gn_hilbert_limbs(void){return S.hilbert_limbs;}
API u32 gn_hilbert_limb(u32 degree,u32 limb){
 if(!S.hilbert_offset||degree>S.hilbert_degree||limb>=S.hilbert_limbs)return 0;
 return PTR(u32,S.hilbert_offset)[(u64)degree*S.hilbert_limbs+limb];
}
API u64 gn_hilbert_coefficient(u32 degree,u32 high){
 u32 i=high?2:0;return (u64)gn_hilbert_limb(degree,i)|((u64)gn_hilbert_limb(degree,i+1)<<32);
}
static int hilbert_impl(u32 degree,u64 extra_budget,u32 upper){
 if(S.input_expected||GN_LOAD(&S.batch_running)||GN_LOAD(&S.reserve_lock))return GN_STATE;
 if(!upper && (S.current||(degree>S.completed && (u64)S.completed<gn_completion_bound())))return GN_STATE;
 if(degree>GN_INDEX_MAX)return GN_LIMIT;
 if(S.hilbert_end && S.bump==S.hilbert_end)S.bump=S.hilbert_base;
 S.hilbert_offset=0;S.hilbert_limbs=0;S.hilbert_end=0;S.hilbert_degree=0;
 u64 saved_bump=S.bump;u32 saved_error=S.error;int rc=0;
 u64 maxnodes=1;
 for(u32 i=1;i<=S.nrules;i++)if(rule(i)->degree<=degree)maxnodes+=rule(i)->degree;
 if(maxnodes>UINT32_MAX)return GN_MEMORY;
 u32 bits=0;while((1u<<bits)<S.generators)bits++;
 u32 limbs=(u32)(((u64)degree*bits+1+31)/32);if(!limbs)limbs=1;
 u64 countbytes=((u64)degree+1)*limbs*4;
 u64 limit=MIN(extra_budget,S.budget-S.bump);
 if(countbytes>limit)return GN_MEMORY;
 u64 stride=4*(u64)S.generators+12+8*(u64)limbs;
 if(limit-countbytes<128||maxnodes>(limit-countbytes-128)/stride)return GN_MEMORY;
 u64 need=A8(countbytes)+maxnodes*stride+128;
 u64 start=alloc_p(need);if(!start){S.bump=saved_bump;S.error=saved_error;return GN_MEMORY;}
 u64 p=start;u32*coefficients=PTR(u32,p);p+=A8(countbytes);u64 outputs_end=p;
 u32 n=(u32)maxnodes,ng=S.generators;
 u32*tr=PTR(u32,p);p+=4*maxnodes*ng;
 u32*fail=PTR(u32,p);p+=4*maxnodes;
 u32*bad=PTR(u32,p);p+=4*maxnodes;
 u32*queue=PTR(u32,p);p+=4*maxnodes;
 u32*dp=PTR(u32,p);p+=4*maxnodes*limbs;
 u32*next=PTR(u32,p);
 memset(PTR(u8,start),0,(size_t)need);
 u32 used=1;
 for(u32 i=1;i<=S.nrules;i++){
  if((i&1023)==0&&cancelled()){rc=GN_CANCELLED;goto done;}
  Rule*r=rule(i);if(r->degree>degree)continue;u32 q=0;
  for(u32 j=0;j<r->degree;j++){
   u32 c=letter(r->lm,r->degree,j),*slot=&tr[(u64)q*ng+c];
   if(!*slot){if(used>=n){rc=GN_STATE;goto done;}*slot=used++;}q=*slot;
  }
  bad[q]=1;
 }
 u32 head=0,tail=0;
 for(u32 c=0;c<ng;c++)if(tr[c])queue[tail++]=tr[c];
 while(head<tail){
  if((head&4095)==0&&cancelled()){rc=GN_CANCELLED;goto done;}
  u32 v=queue[head++];bad[v]|=bad[fail[v]];
  for(u32 c=0;c<ng;c++){
   u32*slot=&tr[(u64)v*ng+c],f=tr[(u64)fail[v]*ng+c];
   if(*slot){fail[*slot]=f;queue[tail++]=*slot;}else *slot=f;
  }
 }
 coefficients[0]=1;dp[0]=1;
 for(u32 d=1;d<=degree;d++){
  memset(next,0,(size_t)used*limbs*4);u32*total=coefficients+(u64)d*limbs;
  for(u32 q=0;q<used;q++){
   if((q&4095)==0&&cancelled()){rc=GN_CANCELLED;goto done;}
   u32*value=dp+(u64)q*limbs,nonzero=0;for(u32 i=0;i<limbs;i++)nonzero|=value[i];if(!nonzero)continue;
   for(u32 c=0;c<ng;c++){u32 v=tr[(u64)q*ng+c];if(!bad[v] && (rc=count_add(next+(u64)v*limbs,value,limbs)))goto done;}
  }
  for(u32 q=0;q<used;q++)if((rc=count_add(total,next+(u64)q*limbs,limbs)))goto done;
  u32*tmp=dp;dp=next;next=tmp;
 }
 S.hilbert_degree=degree;S.hilbert_nodes=used;S.hilbert_bytes=need;
 S.hilbert_base=start;S.hilbert_offset=start;S.hilbert_limbs=limbs;S.hilbert_end=outputs_end;
done:
 S.bump=rc?saved_bump:outputs_end;S.error=saved_error;return rc;
}

API int gn_hilbert(u32 degree,u64 extra_budget){return hilbert_impl(degree,extra_budget,0);}
API int gn_hilbert_upper(u32 degree,u64 extra_budget){return hilbert_impl(degree,extra_budget,1);}
API void gn_hilbert_release(void){
 if(S.hilbert_end&&S.bump==S.hilbert_end)S.bump=S.hilbert_base;
 S.hilbert_offset=S.hilbert_end=S.hilbert_base=0;S.hilbert_limbs=S.hilbert_degree=0;
}
