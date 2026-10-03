/* Indexed monotone maximum radix queue for packed homogeneous words.
 * Every rewrite inserts words <= the last extracted word. Equal words share
 * one hash node, and cancellation can erase any queued key in O(1).
 * This changes only the queue, not the leading-word order or reduction rules. */
typedef struct {u32 heads[129];u64 occupied[3];Word last;u32 *next,*previous;} RadixQueue;
static u32 radix_bucket(Word a,Word b){
 u64 h=a.hi^b.hi,x=a.lo^b.lo;
 return h?128u-(u32)__builtin_clzll(h):x?64u-(u32)__builtin_clzll(x):0;
}
static Word radix_word(void*nodes,u32 stride,u32 id){return *(Word*)((u8*)nodes+(u64)(id-1)*stride);}
static void radix_link(RadixQueue*q,u32 id,u32 b){
 u32 other=q->heads[b];q->previous[id-1]=0;q->next[id-1]=other;
 if(other)q->previous[other-1]=id;q->heads[b]=id;q->occupied[b>>6]|=UINT64_C(1)<<(b&63);
}
static int radix_insert(RadixQueue*q,void*nodes,u32 stride,u32 id){
 Word w=radix_word(nodes,stride,id);if(wcmp(w,q->last)>0)return -1;
 radix_link(q,id,radix_bucket(w,q->last));return 0;
}
static void radix_erase(RadixQueue*q,void*nodes,u32 stride,u32 id){
 u32 b=radix_bucket(radix_word(nodes,stride,id),q->last),p=q->previous[id-1],n=q->next[id-1];
 if(p)q->next[p-1]=n;else q->heads[b]=n;
 if(n)q->previous[n-1]=p;
 if(!q->heads[b])q->occupied[b>>6]&=~(UINT64_C(1)<<(b&63));
}
static u32 radix_top(RadixQueue*q,void*nodes,u32 stride){
 if(q->heads[0])return q->heads[0];
 u32 group=0;while(group<3&&!q->occupied[group])group++;
 if(group==3)return 0;
 u32 b=group*64+(u32)__builtin_ctzll(q->occupied[group]);
 u32 id=q->heads[b];Word maximum=radix_word(nodes,stride,id);
 for(u32 p=q->next[id-1];p;p=q->next[p-1]){Word w=radix_word(nodes,stride,p);if(wcmp(w,maximum)>0)maximum=w;}
 q->last=maximum;q->heads[b]=0;q->occupied[group]&=~(UINT64_C(1)<<(b&63));
 while(id){u32 next=q->next[id-1];radix_link(q,id,radix_bucket(radix_word(nodes,stride,id),maximum));id=next;}
 return q->heads[0];
}
