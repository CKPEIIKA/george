/* Exact bounded short-context rewrite compilation. Table entries express
 * w = sum c_i v_i with v_i < w. Identities are built only from actual monic
 * reducers, in ascending word order. Declining an entry retains the old reducer.
 */
typedef struct {u32 off,n;} LocalEntry;
typedef struct {u32 word,pad;i64 c;} LocalTerm;
static int local_sum(LocalTerm*t,u32*n,u32 w,i64 c){
 if(!c)return 1;
 for(u32 i=0;i<*n;i++)if(t[i].word==w){
  i64 v;if(S.modulus){v=(t[i].c+c)%(i64)S.modulus;if(v<0)v+=S.modulus;}
  else{if((c>0&&t[i].c>SMALL_MAX-c)||(c<0&&t[i].c< -SMALL_MAX-c))return 0;v=t[i].c+c;}
  if(v)t[i].c=v;else t[i]=t[--*n];return 1;
 }
 if(*n>=S.local_limit)return 0;t[(*n)++]=(LocalTerm){w,0,c};return 1;
}
static int local_build(void){
 if(!S.heap_enabled||!S.local_base||S.local_built||S.completed<S.local_degree)return 0;
 u32 d=S.local_degree,count=1u<<(4*d);u64 used=(u64)count*sizeof(LocalEntry);
 if(used>S.local_capacity){S.local_built=2;return 0;}
 LocalEntry*table=PTR(LocalEntry,S.local_base);memset(table,0,(size_t)used);Lane*l=&S.lanes[0];
 u32 snapshot=0;for(u32 id=1;id<=S.nrules&&rule(id)->degree<=d;id++)snapshot=id;
 S.local_snapshot=snapshot;
 for(u32 w=0;w<count;w++){
  if(!(w&255)&&cancelled())return GN_CANCELLED;
  int valid=1;for(u32 x=w,j=0;j<d;j++,x>>=4)if((x&15)>=S.generators){valid=0;break;}if(!valid)continue;
  u32 pos=0,id=divisor((Word){w,0},d,snapshot,&pos,l);if(!id)continue;
  Poly g=load_rule(id,l);if(l->error)return l->error;if(pc(g,0)!=2){S.local_declined++;continue;}
  LocalTerm terms[64];u32 n=0;int ok=1;u32 nr=d-pos-g.degree;
  u32 prefix=w>>(4*(d-pos)),suffix=nr?(w&((1u<<(4*nr))-1)):0;
  for(u32 j=1;j<g.n&&ok;j++){
   Coef cc=pc(g,j);if(cc&1){ok=0;break;}
   i64 c=-cvalue(cc);if(S.modulus){c%=(i64)S.modulus;if(c<0)c+=S.modulus;}
   u32 v=((prefix<<(4*g.degree))|(u32)pw(g,j).lo)<<(4*nr)|suffix;
   if(v>=w){ok=0;break;}LocalEntry*prior=&table[v];
   if(!prior->off){ok=local_sum(terms,&n,v,c);continue;}
   LocalTerm*pt=PTR(LocalTerm,S.local_base+prior->off);
   for(u32 k=0;k<prior->n&&ok;k++){
    i64 z;if(S.modulus)z=(i64)((u64)c*(u64)pt[k].c%S.modulus);
    else{u64 a=c<0?(u64)-c:(u64)c,b=pt[k].c<0?(u64)-pt[k].c:(u64)pt[k].c;if(b&&a>(u64)SMALL_MAX/b){ok=0;break;}z=c*pt[k].c;}
    ok=local_sum(terms,&n,pt[k].word,z);
   }
  }
  if(!ok){S.local_declined++;continue;}
  u64 bytes=(u64)n*sizeof(LocalTerm);if(bytes>S.local_capacity-used){S.local_declined++;continue;}
  for(u32 j=1;j<n;j++){LocalTerm t=terms[j];u32 k=j;while(k&&terms[k-1].word<t.word){terms[k]=terms[k-1];k--;}terms[k]=t;}
  S.local_entries++;table[w]=(LocalEntry){(u32)used,n};memcpy(PTR(u8,S.local_base+used),terms,(size_t)bytes);used+=bytes;
 }
 S.local_used=used;S.local_built=1;return 0;
}
static LocalEntry*local_find(Word w,u32 degree,u32 snapshot,u32*pos){
 if(S.local_built!=1||!S.local_entries||degree<S.local_degree||snapshot<S.local_snapshot||wlong(w))return NULL;
 LocalEntry*table=PTR(LocalEntry,S.local_base);u32 d=S.local_degree,mask=(1u<<(4*d))-1;
 for(u32 p=0;p<=degree-d;p++){
  u32 key=(u32)shr(w,4*(degree-p-d)).lo&mask;
  if(table[key].off&&(S.pruning||table[key].n)){*pos=p;return &table[key];}
 }return NULL;
}
