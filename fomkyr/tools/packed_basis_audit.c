/* Independent record/shorter-word audit; no production kernel is included.
 * Aho--Corasick on the complete leader set establishes the precondition for
 * streaming same-degree triangular normalization in Python. NOT a GB proof. */
#define _POSIX_C_SOURCE 200809L
#define _FILE_OFFSET_BITS 64
#include <sys/types.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>
typedef struct {uint32_t go[16],fail,min;} Node;
typedef struct {uint64_t offset,lo,hi;uint32_t bytes,terms,degree;} Row;
static Node*trie;static uint32_t used=1,capacity=1024;static Row*rows;static uint32_t nr,rcap=1024;
static void fail(const char*m){fprintf(stderr,"audit: %s\n",m);exit(2);}
static uint32_t u32(const unsigned char*p){return(uint32_t)p[0]|(uint32_t)p[1]<<8|(uint32_t)p[2]<<16|(uint32_t)p[3]<<24;}
static uint64_t u64(const unsigned char*p){return(uint64_t)u32(p)|(uint64_t)u32(p+4)<<32;} /* replaced below */
static uint32_t letter(uint64_t lo,uint64_t hi,uint32_t d,uint32_t j){uint32_t b=4*(d-j-1);return b<64?(lo>>b)&15:(hi>>(b-64))&15;}
static uint32_t fresh(void){if(used==capacity){uint32_t old=capacity;if(capacity>10000000)fail("trie budget");capacity*=2;Node*p=realloc(trie,(size_t)capacity*sizeof(Node));if(!p)fail("trie allocation");trie=p;memset(trie+old,0,(size_t)(capacity-old)*sizeof(Node));}return used++;}
static void insert(Row r){uint32_t v=0;for(uint32_t j=0;j<r.degree;j++){uint32_t c=letter(r.lo,r.hi,r.degree,j);if(!trie[v].go[c]){uint32_t n=fresh();trie[v].go[c]=n;}v=trie[v].go[c];}if(trie[v].min)fail("duplicate leading word");trie[v].min=r.degree;}
static int proper(uint64_t lo,uint64_t hi,uint32_t d){uint32_t v=0;for(uint32_t j=0;j<d;j++){v=trie[v].go[letter(lo,hi,d,j)];if(trie[v].min&&trie[v].min<d)return 1;}return 0;}
int main(int argc,char**argv){
 if(argc!=5)fail("usage: file degree generators index.tsv");uint32_t D=(uint32_t)strtoul(argv[2],0,10),gen=(uint32_t)strtoul(argv[3],0,10);if(!D||D>31||!gen||gen>16)fail("inline degree/generator scope");
 FILE*f=fopen(argv[1],"rb"),*ix=fopen(argv[4],"w");if(!f||!ix)fail("open");trie=calloc(capacity,sizeof(Node));rows=malloc(rcap*sizeof(Row));if(!trie||!rows)fail("allocation");uint64_t offset=0,total=0;
 for(;;){unsigned char h[32],t[24];size_t got=fread(h,1,32,f);if(!got)break;if(got!=32)fail("truncated header");uint32_t size=u32(h+4),n=u32(h+8),d=u32(h+12);if(d>D)break;
  if(u32(h)!=0x31424e47||size<56||size>536870912||n<1||(uint64_t)n*24+32>size||!d||d>31||u64(h+24))fail("invalid header");if(fread(t,1,24,f)!=24)fail("truncated leading word");Row r={offset,u64(t),u64(t+8),size,n,d};if(r.hi>>63)fail("not inline");
  for(uint32_t j=0;j<d;j++)if(letter(r.lo,r.hi,d,j)>=gen)fail("generator out of range");
  if(nr==rcap){rcap*=2;Row*p=realloc(rows,(size_t)rcap*sizeof(Row));if(!p)fail("index allocation");rows=p;}rows[nr++]=r;insert(r);if(fseeko(f,size-56,SEEK_CUR))fail("seek");offset+=size;total+=n;
 }
 uint32_t*q=malloc((size_t)used*4);if(!q)fail("queue allocation");uint32_t a=0,b=0;for(uint32_t c=0;c<gen;c++)if(trie[0].go[c])q[b++]=trie[0].go[c];
 while(a<b){uint32_t v=q[a++],in=trie[trie[v].fail].min;if(in&&(!trie[v].min||in<trie[v].min))trie[v].min=in;for(uint32_t c=0;c<gen;c++){uint32_t n=trie[v].go[c];if(n){trie[n].fail=trie[trie[v].fail].go[c];q[b++]=n;}else trie[v].go[c]=trie[trie[v].fail].go[c];}}
 for(uint32_t i=0;i<nr;i++){
  Row r=rows[i];if(proper(r.lo,r.hi,r.degree))fail("nonminimal leading antichain");unsigned char*data=malloc(r.bytes);if(!data)fail("record allocation");if(fseeko(f,(off_t)r.offset,SEEK_SET)||fread(data,1,r.bytes,f)!=r.bytes)fail("short record");uint64_t h=1469598103934665603ULL;for(uint32_t j=32;j<r.bytes;j++){h^=data[j];h*=1099511628211ULL;}if(h!=u64(data+16))fail("checksum");uint64_t plo=UINT64_MAX,phi=UINT64_MAX;
  for(uint32_t j=0;j<r.terms;j++){
   const unsigned char*t=data+32+(uint64_t)j*24;uint64_t lo=u64(t),hi=u64(t+8),c=u64(t+16);uint32_t bits=4*r.degree;
   if(hi>>63||(bits<64?(hi||lo>>bits):(bits==64?hi:hi>>(bits-64))))fail("noncanonical word");if(j&&(hi>phi||(hi==phi&&lo>=plo)))fail("duplicate/unsorted word");plo=lo;phi=hi;
   for(uint32_t k=0;k<r.degree;k++)if(letter(lo,hi,r.degree,k)>=gen)fail("invalid generator");if(proper(lo,hi,r.degree))fail("tail needs shorter-degree reduction");
   if(c&1){uint64_t pos=c&~7ULL;if(pos<32+(uint64_t)r.terms*24||pos+8>r.bytes)fail("coefficient offset");uint32_t limbs=u32(data+pos);if(!limbs||pos+8+(uint64_t)limbs*4>r.bytes||!u32(data+pos+8+(uint64_t)(limbs-1)*4))fail("coefficient limbs");}else if(!c)fail("zero coefficient");
  }
  fprintf(ix,"%u\t%u\t%" PRIu64 "\t%u\t%u\t%016" PRIx64 "%016" PRIx64 "\n",i,r.degree,r.offset,r.bytes,r.terms,r.hi,r.lo);free(data);
 }
 fclose(ix);fclose(f);printf("{\"passed\":true,\"recordChecksumsValid\":true,\"minimalLeaders\":true,\"properSubwordChecks\":%" PRIu64 ",\"rows\":%u,\"matcherStates\":%u,\"throughDegree\":%u,\"independentGroebnerCertificate\":false}\n",total,nr,used,D);free(q);free(rows);free(trie);return 0;
}
