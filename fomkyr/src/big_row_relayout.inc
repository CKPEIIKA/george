/* SPDX-License-Identifier: MIT
 * Reuse a retained row's own arena before asking for a second whole arena.
 * This code runs only between joined worker waves. It never changes a word,
 * coefficient value, pivot, queue order, or unfinished reduction cursor.
 */
static u64 brow_live_bytes(BRow*r){
 u64 bytes=bbytes(r->pivot);
 for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX)bytes+=bbytes(r->nodes[i].c);
 return bytes;
}
static u32 brow_target_capacity(BRow*r,Lane*l){
 (void)l;u32 max=S.big_row_max_terms?S.big_row_max_terms:(1u<<30);
 u32 cap=r->capacity<max?r->capacity*2:r->capacity;
 return MIN(max,MAX(cap,1024u));
}
static u64 brow_pool_room(BRow*r,u64 live){
 (void)r;return MAX(UINT64_C(65536),MIN(live/8,UINT64_C(16)*1048576));
}
static u64 brow_operation_room(BRow*r,Lane*l){
 u64 bytes=MAX(UINT64_C(65536),r->temp.peak);
 if(l->memory_detail==3)bytes=MAX(bytes*2,(r->temp.end-r->temp.base)+65536);
 return bytes;
}
static u64 brow_required_workspace(BRow*r,Lane*l){
 u64 live=brow_live_bytes(r);l->memory_live_bytes=live;
 u64 pool=live+brow_pool_room(r,live),temporary=brow_operation_room(r,l);
 u64 structure=(u64)brow_target_capacity(r,l)*(sizeof(BNode)+16+(r->radix_enabled?4:0));
 u64 bytes=structure+MAX((pool*8+2)/3+64,temporary*4+64);
 return MAX(UINT64_C(1048576),(bytes+65535)&~UINT64_C(65535));
}
static u64 brow_first_root(BRow*r){
 u64 first=UINT64_MAX;BCoef c=r->pivot;
 if(c.n&1)first=MIN(first,c_bigoff(c.n));if(c.d&1)first=MIN(first,c_bigoff(c.d));
 for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX){
  c=r->nodes[i].c;if(c.n&1)first=MIN(first,c_bigoff(c.n));if(c.d&1)first=MIN(first,c_bigoff(c.d));
 }
 return first;
}
static int brow_inplace_layout_to(BRow*r,Lane*l,u32 cap,u64 workspace_bytes){
 /* Packed words need no separately owned word buffers in operation scratch. */
 if(r->degree>31||cap<r->capacity||cap<r->used||workspace_bytes>r->workspace_bytes)return 0;
 u64 base=(u64)(uintptr_t)r->nodes-(u64)(uintptr_t)PTR(u8,0),live=brow_live_bytes(r);
 l->memory_live_bytes=live;
 Arena arena={base,base,base+workspace_bytes,0,0};BRow next;
 if(brow_layout(&next,l,&arena,cap,r->capacity,r->degree))return 0;
 if(next.pool[0].end-next.pool[0].base<live+brow_pool_room(r,live)||
    next.temp.end-next.temp.base<brow_operation_room(r,l))return 0;
 u64 heapbytes=(u64)(r->radix_enabled?r->used:r->heap_n)*4;
 u64 normalbytes=(u64)r->normal_n*4,previousbytes=r->radix_enabled?(u64)r->used*4:0;
 u64 scratchbytes=heapbytes+normalbytes+previousbytes;
 if(scratchbytes>r->temp.end-r->temp.base||next.pool[0].base>r->temp.base||
    next.pool[0].base+live>r->temp.base)return 0;
 /* Coefficient copies must finish below every source root. If necessary,
  * move roots to the existing higher semispace first. No third copy is needed. */
 if(next.pool[0].base+live>brow_first_root(r)){
  u32 high=r->pool[1].base>r->pool[0].base?1:0;
  if(r->pool_active==high||r->pool[high].end-r->pool[high].base<live||
     next.pool[0].base+live>r->pool[high].base)return 0;
  int rc=brow_collect(r);if(rc)return rc==HEAP_MISS?0:-rc;
  if(next.pool[0].base+live>brow_first_root(r))return 0;
 }
 /* The old auxiliary arrays can be overwritten by the enlarged coefficient
  * pool. Save just their initialized indices in dead operation scratch. */
 brow_pressure(r);Arena scratch=r->temp;reset_a(&scratch);
 u64 heap=alloc_a(&scratch,heapbytes),normal=alloc_a(&scratch,normalbytes),previous=alloc_a(&scratch,previousbytes);
 if(scratch.error)return 0;
 memcpy(PTR(u8,heap),r->heap,(size_t)heapbytes);memcpy(PTR(u8,normal),r->normal,(size_t)normalbytes);
 if(previousbytes)memcpy(PTR(u8,previous),r->radix.previous,(size_t)previousbytes);
 /* Byte-count/disjointness preflight makes the following phase non-failing.
  * Do not interrupt halfway through publishing a new arena description. */
 for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX)r->nodes[i].c=bcoef_copy(&next.pool[0],r->nodes[i].c);
 BCoef pivot=bcoef_copy(&next.pool[0],r->pivot);if(next.pool[0].error)return -GN_CORRUPT;
 memcpy(next.heap,PTR(u8,heap),(size_t)heapbytes);memcpy(next.normal,PTR(u8,normal),(size_t)normalbytes);
 if(previousbytes)memcpy(next.radix.previous,PTR(u8,previous),(size_t)previousbytes);
 r->heads=next.heads;r->heap=next.heap;r->normal=next.normal;r->reserved=cap;
 if(r->radix_enabled){r->radix.next=r->heap;r->radix.previous=next.radix.previous;}
 r->pool[0]=next.pool[0];r->pool[1]=next.pool[1];r->pool_active=0;r->temp=next.temp;r->pivot=pivot;r->workspace_bytes=workspace_bytes;
 memset(r->heads,0,(size_t)r->capacity*8);
 for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX){u32 h=rrow_hash(r->nodes[i].w,r->mask);r->nodes[i].next=r->heads[h];r->heads[h]=i+1;}
 return 1;
}
static int brow_inplace_layout(BRow*r,Lane*l){
 u32 cap=brow_target_capacity(r,l);if(l->memory_detail==2&&cap<=r->capacity)return 0;
 return brow_inplace_layout_to(r,l,cap,r->workspace_bytes);
}
/* Enlarge the owning lease into an adjacent free suffix. Stage only initialized
 * queue indices and live coefficient roots, rather than a second node table.
 * Allocation and layout checks finish before changing any row data. After the
 * preflight, copying is deliberately non-interruptible so every root and cursor
 * belongs to one complete layout when the next worker wave starts. */
static int brow_extend_workspace(BRow*r,Lane*l){
 if(GN_LOAD(&S.batch_running)||!l->reserve_slot||r->degree>31)return 0;
 u64 base=reserve_lease_base(l),oldbytes=reserve_lease_bytes(l),bytes=l->memory_need;
 if(r->nodes!=PTR(BNode,base)||r->workspace_bytes!=oldbytes||bytes<=oldbytes)return 0;
 u32 cap=brow_target_capacity(r,l);if(cap<r->capacity||cap<r->used)return 0;
 if(!workspace_extend(base,oldbytes,&bytes))return 0;
 Arena arena={base,base,base+bytes,0,0};BRow next;
 u64 live=brow_live_bytes(r),heapbytes=(u64)(r->radix_enabled?r->used:r->heap_n)*4;
 u64 normalbytes=(u64)r->normal_n*4,previousbytes=r->radix_enabled?(u64)r->used*4:0;
 if(brow_layout(&next,l,&arena,cap,r->capacity,r->degree)||
    next.pool[0].end-next.pool[0].base<live+brow_pool_room(r,live)||
    next.temp.end-next.temp.base<brow_operation_room(r,l)){
  workspace_return(base+oldbytes,bytes-oldbytes);return 0;
 }
 u64 stagebytes=MAX(UINT64_C(65536),A8(heapbytes)+A8(normalbytes)+A8(previousbytes)+live),stage=workspace_take(&stagebytes);
 if(!stage){workspace_return(base+oldbytes,bytes-oldbytes);return 0;}
 Arena scratch={stage,stage,stage+stagebytes,0,0};
 u64 heap=alloc_a(&scratch,heapbytes),normal=alloc_a(&scratch,normalbytes),previous=alloc_a(&scratch,previousbytes);
 if(scratch.error||live>scratch.end-scratch.pos){workspace_return(stage,stagebytes);workspace_return(base+oldbytes,bytes-oldbytes);return 0;}
 brow_pressure(r);
 memcpy(PTR(u8,heap),r->heap,(size_t)heapbytes);memcpy(PTR(u8,normal),r->normal,(size_t)normalbytes);
 if(previousbytes)memcpy(PTR(u8,previous),r->radix.previous,(size_t)previousbytes);
 for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX)r->nodes[i].c=bcoef_copy(&scratch,r->nodes[i].c);
 BCoef pivot=bcoef_copy(&scratch,r->pivot);
 if(scratch.error)return -GN_CORRUPT;
 for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX)r->nodes[i].c=bcoef_copy(&next.pool[0],r->nodes[i].c);
 pivot=bcoef_copy(&next.pool[0],pivot);if(next.pool[0].error)return -GN_CORRUPT;
 memcpy(next.heap,PTR(u8,heap),(size_t)heapbytes);memcpy(next.normal,PTR(u8,normal),(size_t)normalbytes);
 if(previousbytes)memcpy(next.radix.previous,PTR(u8,previous),(size_t)previousbytes);
 r->heads=next.heads;r->heap=next.heap;r->normal=next.normal;r->reserved=cap;
 if(r->radix_enabled){r->radix.next=r->heap;r->radix.previous=next.radix.previous;}
 r->pool[0]=next.pool[0];r->pool[1]=next.pool[1];r->pool_active=0;r->temp=next.temp;r->pivot=pivot;r->workspace_bytes=bytes;
 memset(r->heads,0,(size_t)r->capacity*8);
 for(u32 i=0;i<r->used;i++)if(r->nodes[i].pos!=UINT32_MAX){u32 h=rrow_hash(r->nodes[i].w,r->mask);r->nodes[i].next=r->heads[h];r->heads[h]=i+1;}
 reserve_slot_set(l->reserve_slot,base,bytes);
 if(l->reserve_retry)l->a[l->active^1]=(Arena){base,base,base+bytes,0,0};
 workspace_return(stage,stagebytes);return 1;
}
/* A large live lease can contain structural reserve and dead coefficient space
 * that another parked row needs. Repack its exact state before returning the
 * unused suffix; the allocator never exposes any still-referenced byte. */
static int brow_trim_workspace(Lane*l,u64 wanted){
 if(GN_LOAD(&S.batch_running)||l->resume_tier!=4||l->memory_wait||!l->reserve_slot||
    l->coefficient_extra_slot||l->coefficient_extra_base)return 0;
 BRow*r=&saved_BRow[l->resume_slot].row;r->lane=l;
 u64 base=reserve_lease_base(l),oldbytes=reserve_lease_bytes(l);
 if(r->nodes!=PTR(BNode,base)||r->workspace_bytes!=oldbytes||r->degree>31)return 0;
 u64 structure=(u64)r->capacity*(sizeof(BNode)+16+(r->radix_enabled?4:0));
 if(oldbytes<=structure||oldbytes-structure<wanted)return 0;
 u64 live=brow_live_bytes(r),pool=live+brow_pool_room(r,live),temporary=brow_operation_room(r,l);
 /* Leave half a live pool's worth of extra coefficient room after packing. */
 u64 bytes=MAX(UINT64_C(1048576),structure+MAX(pool*4+64,temporary*8+64));
 bytes=(bytes+65535)&~UINT64_C(65535);
 if(bytes>=oldbytes||oldbytes-bytes<wanted)return 0;
 int rc=brow_inplace_layout_to(r,l,r->capacity,bytes);if(rc<=0)return rc;
 reserve_slot_set(l->reserve_slot,base,bytes);
 if(l->reserve_retry)l->a[l->active^1]=(Arena){base,base,base+bytes,0,0};
 workspace_return(base+bytes,oldbytes-bytes);
 l->row_growths++;l->row_relayouts++;brow_report(r);publish_lane(l,(u64)r->heap_n+r->normal_n,1);
 return 1;
}
