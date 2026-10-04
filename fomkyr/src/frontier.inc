/* SPDX-License-Identifier: MIT
 * Durable, endian-neutral mid-degree cursor; NO working-memory addresses.
 * Export only after all readers joined. Uncommitted tasks are replayed from their
 * immutable snapshots. Committed tasks, including zero remainders, are not replayed.
 * Host binds this blob and its append-only record prefix to the input SHA256.
 */
#define FRONTIER_MAGIC UINT64_C(0x3152544e52464b46)
#define FRONTIER_VERSION 1u
#define FH 40u
static u32 frontier_bytes;
static void fw64(u8*p,u64 x){for(u32 i=0;i<8;i++)p[i]=(u8)(x>>(8*i));}
static u64 fr64(const u8*p){u64 x=0;for(u32 i=0;i<8;i++)x|=(u64)p[i]<<(8*i);return x;}
static void fw32(u8*p,u32 x){for(u32 i=0;i<4;i++)p[i]=(u8)(x>>(8*i));}
static u32 fr32(const u8*p){u32 x=0;for(u32 i=0;i<4;i++)x|=(u32)p[i]<<(8*i);return x;}
static u64 frontier_hash(const u8*p,u32 bytes){u64 h=UINT64_C(1469598103934665603);for(u32 i=0;i<bytes;i++){u8 v=(i>=24&&i<32)?0:p[i];h^=v;h*=UINT64_C(1099511628211);}return h;}
API u32 gn_frontier_size(void){return frontier_bytes;}
API u32 gn_frontier_hash_bits(void){u32 b=0;for(u32 m=S.hash_mask;m;m>>=1)b++;return b;}
API u32 gn_frontier_pending(void){return S.batch_enabled?S.batch_n-S.batch_committed:0;}
API u64 gn_frontier_export(void){
 frontier_bytes=0;
 if(!S.current||S.input_expected||S.certifying||GN_LOAD(&S.batch_running)||(GN_LOAD(&S.reserve_lock)&&!S.coop_ms))return 0;
 u32 pending=gn_frontier_pending();
 if(pending>BATCH_MAX||S.degree_scheduled-S.degree_committed!=pending)return 0;
 u32 bytes=FH*8+pending*16;Lane*l=&S.lanes[0];if(bytes>l->io_size)return 0;
 u8*p=PTR(u8,l->io_base);memset(p,0,bytes);
 u64 v[FH]={FRONTIER_MAGIC,FRONTIER_VERSION,bytes,0,S.completed,S.current,
   S.nrules,S.nprefix,S.disk_end,S.terms,S.generators,S.modulus,gn_frontier_hash_bits(),
   S.degree_snapshot,S.iter_f,S.iter_k,S.iter_node,S.iter_ready,S.iter_done,
   S.degree_total,S.degree_seen,S.degree_scheduled,S.degree_committed,S.degree_monomial,
   S.degree_chain,S.degree_total_known,S.degree_replays,S.pair_count,S.zero_pairs,
   S.commit_zero,S.chain_skipped,pending,S.pruning,S.chain_enabled,S.batch_epochs,
   S.batch_spills,0,0,0,0};
 for(u32 i=0;i<FH;i++)fw64(p+i*8,v[i]);
 for(u32 i=0;i<pending;i++){BatchTask*t=&S.tasks[S.batch_committed+i];u8*q=p+FH*8+i*16;
  fw32(q,t->f);fw32(q+4,t->g);fw32(q+8,t->k);fw32(q+12,t->snapshot);
 }
 fw64(p+24,frontier_hash(p,bytes));frontier_bytes=bytes;return l->io_base;
}
API int gn_frontier_restore(u32 bytes){
 if(S.current||S.input_expected||S.certifying||GN_LOAD(&S.batch_running)||(GN_LOAD(&S.reserve_lock)&&!S.coop_ms))return GN_STATE;
 Lane*l=&S.lanes[0];if(bytes<FH*8||bytes>l->io_size)return GN_CORRUPT;
 const u8*p=PTR(u8,l->io_base);u64 v[FH];for(u32 i=0;i<FH;i++)v[i]=fr64(p+i*8);
 if(v[0]!=FRONTIER_MAGIC||v[1]!=FRONTIER_VERSION||v[2]!=bytes||v[3]!=frontier_hash(p,bytes))return GN_CORRUPT;
 if(v[31]>BATCH_MAX||bytes!=FH*8+v[31]*16||v[4]>=GN_INDEX_MAX||v[5]!=v[4]+1||v[5]>S.target)return GN_CORRUPT;
 if(v[6]!=S.nrules||v[7]!=S.nprefix||(S.spill&&v[8]!=S.disk_end)||v[9]!=S.terms||v[10]!=S.generators||v[11]!=S.modulus||v[12]!=gn_frontier_hash_bits())return GN_CORRUPT;
 if(v[13]>S.nrules||v[14]<1||v[14]>v[13]+1||v[15]<1||v[15]>GN_INDEX_MAX||v[16]>S.nprefix||v[17]>1||v[18]>1||v[25]>1||v[32]>1||v[33]>1)return GN_CORRUPT;
 if(v[20]!=v[21]+v[23]+v[24]||v[21]!=v[22]+v[31]||(v[25]&&v[20]>v[19]))return GN_CORRUPT;
 for(u32 i=36;i<FH;i++)if(v[i])return GN_CORRUPT;
 if(S.nrules&&rule(S.nrules)->degree>v[5])return GN_CORRUPT;
 /* Each original snapshot exists in the restored immutable prefix. */
 BatchTask saved[BATCH_MAX];u32 pending=(u32)v[31];
 for(u32 i=0;i<pending;i++){
  const u8*q=p+FH*8+i*16;u32 f=fr32(q),g=fr32(q+4),k=fr32(q+8),sn=fr32(q+12);
  if(!f||!g||f>v[13]||g>v[13]||sn>v[6]||sn<f||sn<g||sn<v[13])return GN_CORRUPT;
  Rule*a=rule(f),*b=rule(g);
  if(!k||k>=a->degree||k>=b->degree||(u64)a->degree+b->degree-k!=v[5]||!weq(part(a->lm,a->degree,a->degree-k,k),part(b->lm,b->degree,0,k)))return GN_CORRUPT;
  saved[i]=(BatchTask){f,g,k,sn,GN_STATE,0,0};
 }
 /* The same hash table layout is required only for the saved enumeration cursor,
  * never for mathematical identity. The host restores its recorded hashBits. */
 u32 old_current=S.current,old_completed=S.completed;S.current=(u32)v[5];S.completed=(u32)v[4];
 int rc=matcher_build();if(!rc)rc=local_build();if(rc){S.current=old_current;S.completed=old_completed;return rc;}
 S.completed=(u32)v[4];S.degree_snapshot=(u32)v[13];
 S.iter_f=(u32)v[14];S.iter_k=(u32)v[15];S.iter_node=(u32)v[16];S.iter_ready=(u32)v[17];S.iter_done=(u32)v[18];
 S.degree_total=v[19];S.degree_seen=v[20];S.degree_scheduled=v[21];S.degree_committed=v[22];S.degree_monomial=v[23];S.degree_chain=v[24];
 S.degree_total_known=(u32)v[25];S.degree_replays=(u32)v[26];S.pair_count=v[27];S.zero_pairs=v[28];S.commit_zero=v[29];S.chain_skipped=v[30];
 S.batch_epochs=v[34];S.batch_spills=v[35];
 /* Preserve skip semantics until this degree completes. Both criteria are exact. */
 S.pruning=(u32)v[32];S.chain_enabled=(u32)v[33];
 S.batch_n=pending;S.batch_first=0;S.batch_committed=0;
 if(pending&&!S.batch_enabled){S.batch_enabled=1;rc=layout_workers(S.workers,1);if(rc)return rc;}
 for(u32 i=0;i<pending;i++)S.tasks[i]=saved[i];
 for(u32 i=0;i<S.workers;i++)S.lanes[i].out_used=0;
 GN_STORE(&S.batch_next,0);order_batch();return 0;
}
