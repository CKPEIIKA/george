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
 if(!S.current||S.input_expected||S.certifying||GN_LOAD(&S.batch_running)||(reserve_pool_busy()&&!S.coop_ms))return 0;
 u32 pending=gn_frontier_pending();
 if(pending>BATCH_MAX||S.degree_scheduled-S.degree_committed!=pending)return 0;
 u32 header=S.gm_mask?41:FH;u32 bitmap=P.active?P.excluded_bytes:0;u32 anchors=P.active&&!bitmap?P.anchor_n:0;u64 size=(u64)header*8+(anchors+pending)*16+bitmap;if(size>GN_FRONTIER_MAX_BYTES)return 0;u32 bytes=(u32)size;Lane*l=&S.lanes[0];if(bytes>l->io_size)return 0;
 u8*p=PTR(u8,l->io_base);memset(p,0,bytes);
 u64 v[41]={FRONTIER_MAGIC,S.gm_mask?6:P.active?(bitmap?5:P.mode>=3?P.mode:2):FRONTIER_VERSION,bytes,0,S.completed,S.current,
   S.nrules,S.nprefix,S.disk_end,S.terms,S.generators,S.modulus,gn_frontier_hash_bits(),
   S.degree_snapshot,S.iter_f,S.iter_k,S.iter_node,S.iter_ready,S.iter_done,
   S.degree_total,S.degree_seen,S.degree_scheduled,S.degree_committed,S.degree_monomial,
   S.degree_chain,S.degree_total_known,S.degree_replays,S.pair_count,S.zero_pairs,
   S.commit_zero,S.chain_skipped,pending,S.pruning|(S.gm_mask&&bitmap?2u:0),S.chain_enabled,S.batch_epochs,
   S.batch_spills,0,0,0,0,S.gm_mask};
 if(P.active){v[36]=P.mode;v[37]=P.cursor;v[38]=bitmap?bitmap:P.anchor_n;v[39]=P.anchor_seen;}
 for(u32 i=0;i<header;i++)fw64(p+i*8,v[i]);
 for(u32 i=0;i<anchors;i++){BatchTask*t=&P.anchor[i];u8*q=p+header*8+i*16;fw32(q,t->f);fw32(q+4,t->g);fw32(q+8,t->k);fw32(q+12,t->snapshot);}
 for(u32 i=0;i<pending;i++){BatchTask*t=&S.tasks[S.batch_committed+i];u8*q=p+header*8+(anchors+i)*16;
  fw32(q,t->f);fw32(q+4,t->g);fw32(q+8,t->k);fw32(q+12,t->snapshot);
 }
 if(bitmap)memcpy(p+header*8+pending*16,PTR(u8,P.excluded_base),bitmap);
 fw64(p+24,frontier_hash(p,bytes));frontier_bytes=bytes;return l->io_base;
}
API int gn_frontier_restore(u32 bytes){
 if(S.current||S.input_expected||S.certifying||GN_LOAD(&S.batch_running)||(reserve_pool_busy()&&!S.coop_ms))return GN_STATE;
 Lane*l=&S.lanes[0];if(bytes<FH*8||bytes>GN_FRONTIER_MAX_BYTES||bytes>l->io_size)return GN_CORRUPT;
 const u8*p=PTR(u8,l->io_base);u64 version=fr64(p+8);u32 header=version==6?41:FH;
 if(bytes<header*8)return GN_CORRUPT;u64 v[41]={0};for(u32 i=0;i<header;i++)v[i]=fr64(p+i*8);
 if(v[0]!=FRONTIER_MAGIC||(v[1]!=FRONTIER_VERSION&&v[1]!=2&&v[1]!=3&&v[1]!=4&&v[1]!=5&&v[1]!=6)||v[2]!=bytes||v[3]!=frontier_hash(p,bytes))return GN_CORRUPT;
 if(v[1]==6&&(!v[40]||v[40]>7))return GN_CORRUPT;
 int planned=v[1]>=2&&(v[1]!=6||v[36]);
 int bitmap=(v[1]==6&&(v[32]&2))||v[1]==5||(v[1]==4&&v[36]<=3);
 if(bitmap&&!planned)return GN_CORRUPT;
 if((!bitmap&&v[38]>BATCH_MAX)||v[31]>BATCH_MAX||bytes!=(u64)header*8+(v[31]+(planned&&!bitmap?v[38]:0))*16+(bitmap?v[38]:0)||v[4]>=GN_INDEX_MAX||v[5]!=v[4]+1||v[5]>S.target)return GN_CORRUPT;
 if(v[6]!=S.nrules||v[7]!=S.nprefix||(S.spill&&v[8]!=S.disk_end)||v[9]!=S.terms||v[10]!=S.generators||v[11]!=S.modulus||v[12]!=gn_frontier_hash_bits())return GN_CORRUPT;
 if(v[13]>S.nrules||v[14]<1||v[14]>v[13]+1||v[15]<1||v[15]>GN_INDEX_MAX||v[16]>S.nprefix||v[17]>1||v[18]>1||v[25]>1||v[32]>(v[1]==6?3u:1u)||v[33]>1)return GN_CORRUPT;
 if(v[20]!=v[21]+v[23]+v[24]||v[21]!=v[22]+v[31]||(v[25]&&v[20]>v[19]))return GN_CORRUPT;
 if(!planned){for(u32 i=36;i<FH;i++)if(v[i])return GN_CORRUPT;}
 else if(bitmap){
  if(v[36]<1||v[36]>4||v[19]>UINT32_MAX||v[38]!=(v[19]+7)/8||!v[38]||v[39]>v[19]||v[37]>v[19]-v[39]||v[20]!=v[39]+v[37])return GN_CORRUPT;
  const u8*bits=p+header*8+v[31]*16;u64 count=0;
  for(u64 i=0;i<v[38];i++){u8 b=bits[i];for(;b;b&=(u8)(b-1))count++;}
  if(count!=v[39]||((v[19]&7)&&(bits[v[38]-1]>>(v[19]&7))))return GN_CORRUPT;
 }
 else if(v[36]<1||v[36]>(v[1]>=3&&v[1]<=6?4u:2u)||v[39]>v[19]||v[38]>v[39]||v[37]>v[19]-v[39]+v[38]||v[20]!=v[39]-v[38]+v[37])return GN_CORRUPT;
 if(S.nrules&&rule(S.nrules)->degree>v[5])return GN_CORRUPT;
 /* Each original snapshot exists in the restored immutable prefix. */
 BatchTask saved[BATCH_MAX],anchors[BATCH_MAX];u32 pending=(u32)v[31],anchor_n=planned&&!bitmap?(u32)v[38]:0;
 for(u32 i=0;i<pending+anchor_n;i++){
  const u8*q=p+header*8+i*16;u32 f=fr32(q),g=fr32(q+4),k=fr32(q+8),sn=fr32(q+12);
  if(!f||!g||f>v[13]||g>v[13]||sn>v[6]||sn<f||sn<g||sn<v[13])return GN_CORRUPT;
  Rule*a=rule(f),*b=rule(g);
  if(!k||k>=a->degree||k>=b->degree||(u64)a->degree+b->degree-k!=v[5]||!weq(part(a->lm,a->degree,a->degree-k,k),part(b->lm,b->degree,0,k)))return GN_CORRUPT;
  if(i<anchor_n)anchors[i]=(BatchTask){f,g,k,sn,GN_STATE,0,0};else saved[i-anchor_n]=(BatchTask){f,g,k,sn,GN_STATE,0,0};
 }
 /* The same hash table layout is required only for the saved enumeration cursor,
  * never for mathematical identity. The host restores its recorded hashBits. */
 u32 old_current=S.current,old_completed=S.completed;S.current=(u32)v[5];S.completed=(u32)v[4];if(v[1]==6)S.gm_mask=(u32)v[40];
 u32 restored_rules=S.nrules;S.degree_snapshot=(u32)v[13];S.nrules=S.degree_snapshot;
 int rc=matcher_build();S.nrules=restored_rules;if(!rc)rc=local_build();if(rc){S.current=old_current;S.completed=old_completed;return rc;}
 S.completed=(u32)v[4];S.degree_snapshot=(u32)v[13];
 S.iter_f=(u32)v[14];S.iter_k=(u32)v[15];S.iter_node=(u32)v[16];S.iter_ready=(u32)v[17];S.iter_done=(u32)v[18];
 S.degree_total=v[19];S.degree_seen=v[20];S.degree_scheduled=v[21];S.degree_committed=v[22];S.degree_monomial=v[23];S.degree_chain=v[24];
 S.degree_total_known=(u32)v[25];S.degree_replays=(u32)v[26];S.pair_count=v[27];S.zero_pairs=v[28];S.commit_zero=v[29];S.chain_skipped=v[30];
 S.batch_epochs=v[34];S.batch_spills=v[35];
 /* Preserve skip semantics until this degree completes. Both criteria are exact. */
 S.pruning=(u32)v[32]&1u;S.chain_enabled=(u32)v[33];
 P.active=0;P.excluded_bytes=0;P.excluded_count=0;
 if(bitmap){
  if(v[38]>P.budget)return GN_MEMORY;
  u64 dst=alloc_p(v[38]);if(!dst)return GN_MEMORY;
  /* Allocation may move host memory; recover the input pointer. */
  p=PTR(u8,l->io_base);memcpy(PTR(u8,dst),p+header*8+pending*16,v[38]);
  P.excluded_base=dst;P.excluded_bytes=(u32)v[38];P.excluded_count=v[39];P.allocated+=v[38];
 }
 if(planned){int prc=plan_build((u32)v[36],v[39],anchors,anchor_n);if(prc<=0)return prc<0?-prc:GN_MEMORY;
  if(P.total!=v[19]||v[37]>P.count)return GN_CORRUPT;P.cursor=(u32)v[37];
  int vr=plan_check_pending(saved,pending);if(vr)return vr;
 }
 S.batch_n=pending;S.batch_first=0;S.batch_committed=0;
 if(pending&&!S.batch_enabled){S.batch_enabled=1;rc=layout_workers(S.workers,1);if(rc)return rc;}
 for(u32 i=0;i<pending;i++)S.tasks[i]=saved[i];
 for(u32 i=0;i<S.workers;i++)S.lanes[i].out_used=0;
 GN_STORE(&S.batch_next,0);order_batch();return 0;
}
