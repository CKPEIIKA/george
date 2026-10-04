/* SPDX-License-Identifier: MIT
 * Exact normal-word counts by product-permutation class. Coordinator-only.
 * A current lex basis need NOT be invariant under vertex permutations.
 * This counts actual normal words, not orbits of normal words.
 * Optional temporary workspace is bounded; failure never means zero.
 */
static int fg_sector_count(u32 degree,u64 budget,u64 out[360]){
 if(!fg_quiet()||!degree||degree>FKG_PROFILE_DEGREE||S.generators!=15)return GN_STATE;
 u64 saved=S.bump;u32 error=S.error;int rc=0;u64 cap=1;
 for(u32 id=1;id<=S.nrules;id++)if(rule(id)->degree<=degree)cap+=rule(id)->degree;
 if(cap>UINT32_MAX||S.bump>S.budget)return GN_MEMORY;
 u64 limit=MIN(budget,S.budget-S.bump),basebytes=cap*(15*4+4*4);
 if(basebytes>limit)return GN_MEMORY;
 u64 off=alloc_p(basebytes);if(!off){S.bump=saved;S.error=error;return GN_MEMORY;}
 memset(PTR(u8,off),0,(size_t)basebytes);
 u32 *tr=PTR(u32,off),*fail=tr+cap*15,*bad=fail+cap,*queue=bad+cap,*index=queue+cap;
 u32 used=1;
 for(u32 id=1;id<=S.nrules;id++){
  if(!(id&511)&&cancelled()){rc=GN_CANCELLED;goto done;}
  Rule*r=rule(id);if(r->degree>degree)continue;u32 q=0;
  for(u32 j=0;j<r->degree;j++){u32 c=letter(r->lm,r->degree,j);if(c>=15){rc=GN_CORRUPT;goto done;}u32*v=&tr[(u64)q*15+c];if(!*v)*v=used++;q=*v;}
  bad[q]=1;
 }
 u32 head=0,tail=0;
 for(u32 c=0;c<15;c++)if(tr[c])queue[tail++]=tr[c];
 while(head<tail){u32 v=queue[head++];bad[v]|=bad[fail[v]];
  for(u32 c=0;c<15;c++){u32 *w=&tr[(u64)v*15+c],f=tr[(u64)fail[v]*15+c];if(*w){fail[*w]=f;queue[tail++]=*w;}else *w=f;}}
 u32 good=0;for(u32 q=0;q<used;q++)index[q]=bad[q]?UINT32_MAX:good++;
 u64 need=(u64)good*(15*4+2*360*4);
 if(need>limit-basebytes){rc=GN_MEMORY;goto done;}
 u64 more=alloc_p(need);if(!more){rc=GN_MEMORY;goto done;}
 u32 *gt=PTR(u32,more),*dp=gt+(u64)good*15,*nx=dp+(u64)good*360;
 for(u32 q=0;q<used;q++)if(!bad[q])for(u32 c=0;c<15;c++)gt[(u64)index[q]*15+c]=index[tr[(u64)q*15+c]];
 memset(dp,0,(size_t)good*360*4);dp[0]=1;
 for(u32 d=1;d<=degree;d++){
  memset(nx,0,(size_t)good*360*4);u32 parity=(d-1)&1;
  for(u32 q=0;q<good;q++){
   if(!(q&127)&&cancelled()){rc=GN_CANCELLED;goto done;}
   u32 *values=dp+(u64)q*360,*to=gt+(u64)q*15;
   for(u32 g=0;g<360;g++){u32 value=values[g];if(!value)continue;const uint16_t*step=fkg_group_step[parity][g];
    for(u32 c=0;c<15;c++)if(to[c]!=UINT32_MAX){u32 *v=nx+(u64)to[c]*360+step[c];if(UINT32_MAX-*v<value){rc=GN_LIMIT;goto done;}*v+=value;}
   }
  }
  u32 *swap=dp;dp=nx;nx=swap;
 }
 for(u32 k=0;k<360;k++)out[k]=0;
 for(u32 q=0;q<good;q++)for(u32 g=0;g<360;g++)out[g]+=dp[(u64)q*360+g];
 S.fg_sector_peak=MAX(S.fg_sector_peak,basebytes+need);S.fg_sector_nodes=good;
 done:S.bump=saved;S.error=error;return rc;
}
static u32 fg_word_group(Word w,u32 degree){u32 g=0;for(u32 j=0;j<degree;j++)g=fkg_group_step[j&1][g][letter(w,degree,j)];return g;}
/* Read-only worker shortcut. Counts are immutable within each joined wave. */
static int fg_sector_pair(Lane*l){
 if(!fg_sector_ids(l->f,l->g,l->k))return 0;
 GN_FETCH_ADD(&S.fg_sector_skipped,1);return 1;
}
