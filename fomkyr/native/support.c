/* SPDX-License-Identifier: MIT. Small native-only JSON/SHA256 utilities, no dependencies. */
#define _POSIX_C_SOURCE 200809L
#include "support.h"
#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <string.h>
#include <ctype.h>
#include <errno.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/stat.h>
static void need(Buffer*b,size_t add){if(add>SIZE_MAX-b->n-1){fprintf(stderr,"buffer size overflow\n");exit(70);}size_t n=b->n+add+1;if(n<=b->cap)return;size_t cap=b->cap?b->cap:256;while(cap<n){if(cap>SIZE_MAX/2){cap=n;break;}cap*=2;}char*s=realloc(b->s,cap);if(!s){perror("realloc");exit(71);}b->s=s;b->cap=cap;}
void buf_n(Buffer*b,const char*s,size_t n){need(b,n);memcpy(b->s+b->n,s,n);b->n+=n;b->s[b->n]=0;}
void buf_add(Buffer*b,const char*s){buf_n(b,s,strlen(s));}
void buf_printf(Buffer*b,const char*f,...){va_list ap,cp;va_start(ap,f);va_copy(cp,ap);int n=vsnprintf(NULL,0,f,cp);va_end(cp);if(n<0){va_end(ap);exit(70);}need(b,(size_t)n);vsnprintf(b->s+b->n,(size_t)n+1,f,ap);b->n+=(size_t)n;va_end(ap);}
void buf_string(Buffer*b,const char*s){buf_add(b,"\"");for(;*s;s++){unsigned char c=(unsigned char)*s;if(c=='"'||c=='\\'){buf_n(b,"\\",1);buf_n(b,s,1);}else if(c<32)buf_printf(b,"\\u%04x",c);else buf_n(b,s,1);}buf_add(b,"\"");}
void buf_free(Buffer*b){free(b->s);memset(b,0,sizeof(*b));}
static uint32_t rr(uint32_t x,unsigned n){return(x>>n)|(x<<(32-n));}
void sha256_hex(const void*data,size_t len,char out[65]){
 static const uint32_t k[64]={0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2};
 uint32_t h[8]={0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19};
 size_t blocks=len/64+1+((len%64)>=56);const unsigned char*p=data;
 for(size_t bi=0;bi<blocks;bi++){unsigned char b[64]={0};size_t start=bi*64;
  for(unsigned i=0;i<64;i++){size_t at=start+i;if(at<len)b[i]=p[at];else if(at==len)b[i]=128;}
  if(bi+1==blocks){uint64_t bits=(uint64_t)len*8;for(unsigned i=0;i<8;i++)b[63-i]=(unsigned char)(bits>>(8*i));}
  uint32_t w[64];for(unsigned i=0;i<16;i++)w[i]=((uint32_t)b[4*i]<<24)|((uint32_t)b[4*i+1]<<16)|((uint32_t)b[4*i+2]<<8)|b[4*i+3];
  for(unsigned i=16;i<64;i++)w[i]=w[i-16]+(rr(w[i-15],7)^rr(w[i-15],18)^(w[i-15]>>3))+w[i-7]+(rr(w[i-2],17)^rr(w[i-2],19)^(w[i-2]>>10));
  uint32_t a=h[0],bb=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
  for(unsigned i=0;i<64;i++){uint32_t t=hh+(rr(e,6)^rr(e,11)^rr(e,25))+((e&f)^(~e&g))+k[i]+w[i],u=(rr(a,2)^rr(a,13)^rr(a,22))+((a&bb)^(a&c)^(bb&c));hh=g;g=f;f=e;e=d+t;d=c;c=bb;bb=a;a=t+u;}
  h[0]+=a;h[1]+=bb;h[2]+=c;h[3]+=d;h[4]+=e;h[5]+=f;h[6]+=g;h[7]+=hh;
 }for(unsigned i=0;i<8;i++)snprintf(out+8*i,9,"%08x",h[i]);out[64]=0;
}
static void ws(Json*j){while((size_t)j->pos<j->len&&isspace((unsigned char)j->text[j->pos]))j->pos++;}
static int value(Json*j,unsigned depth){
 if(depth>128)return -1;ws(j);if((size_t)j->pos>=j->len)return -1;
 if(j->n==j->cap){int cap=j->cap?j->cap*2:128;if(cap<j->cap||cap>16000000)return -1;Token*t=realloc(j->t,(size_t)cap*sizeof(Token));if(!t)return -1;j->t=t;j->cap=cap;}
 int id=j->n++;j->t[id]=(Token){.start=j->pos,.type=j->text[j->pos]};char c=j->text[j->pos++];
 if(c=='{'||c=='['){ws(j);char end=c=='{'?'}':']';if(j->text[j->pos]!=end){for(;;){
   if(c=='{'&&j->text[j->pos]!='"')return -1;
   if(value(j,depth+1)<0)return -1;j->t[id].count++;
   if(c=='{'){ws(j);if(j->text[j->pos++]!=':')return -1;if(value(j,depth+1)<0)return -1;j->t[id].count++;}
   ws(j);if(j->text[j->pos]==end)break;if(j->text[j->pos++]!=',')return -1;ws(j);
  }}if(j->text[j->pos++]!=end)return -1;
 }else if(c=='"'){
  int closed=0;while((size_t)j->pos<j->len){unsigned char x=j->text[j->pos++];if(x=='"'){closed=1;break;}if(x<32)return -1;if(x=='\\'){if((size_t)j->pos>=j->len)return -1;char e=j->text[j->pos++];if(e=='u'){for(int k=0;k<4;k++)if((size_t)j->pos>=j->len||!isxdigit((unsigned char)j->text[j->pos++]))return -1;}else if(!strchr("\"\\/bfnrt",e))return -1;}}
  if(!closed)return -1;
 }else {while((size_t)j->pos<j->len&&!isspace((unsigned char)j->text[j->pos])&&!strchr(",}]",j->text[j->pos]))j->pos++;}
 j->t[id].end=j->pos;j->t[id].next=j->n;return id;
}
int json_parse(Json*j,char*s){memset(j,0,sizeof(*j));j->text=s;j->len=strlen(s);int n=value(j,0);ws(j);return n>=0&&(size_t)j->pos==j->len?0:-1;}
void json_free(Json*j){free(j->t);memset(j,0,sizeof(*j));}
int json_key(Json*j,int obj,const char*key){if(obj<0||j->t[obj].type!='{')return -1;for(int i=obj+1;i<j->t[obj].next;){Token*k=&j->t[i];int v=i+1;if(k->type!='"'||v>=j->t[obj].next)return -1;if((size_t)(k->end-k->start-2)==strlen(key)&&!memcmp(j->text+k->start+1,key,strlen(key)))return v;i=j->t[v].next;}return -1;}
char*json_string(Json*j,int t){if(t<0||t>=j->n)return NULL;Token*v=&j->t[t];const char*p=j->text+v->start;size_t n=(size_t)(v->end-v->start);if(v->type=='"'){p++;n-=2;/* Native schema values are plain ASCII, no escaped variable/path interpretation. */for(size_t i=0;i<n;i++)if(p[i]=='\\')return NULL;}char*s=malloc(n+1);if(s){memcpy(s,p,n);s[n]=0;}return s;}
uint64_t json_u64(Json*j,int t,int*ok){char*s=json_string(j,t);if(!s||!*s){free(s);*ok=0;return 0;}for(char*p=s;*p;p++)if(!isdigit((unsigned char)*p)){free(s);*ok=0;return 0;}errno=0;char*e;unsigned long long n=strtoull(s,&e,10);if(errno||*e)*ok=0;free(s);return(uint64_t)n;}
char*json_compact(const char*s,size_t n){char*r=malloc(n+1);if(!r)return NULL;size_t k=0;int string=0,escape=0;for(size_t i=0;i<n;i++){char c=s[i];if(string||!isspace((unsigned char)c))r[k++]=c;if(string){if(escape)escape=0;else if(c=='\\')escape=1;else if(c=='"')string=0;}else if(c=='"')string=1;}r[k]=0;return r;}
char*read_file(const char*path,size_t cap,size_t*length){FILE*f=!strcmp(path,"-")?stdin:fopen(path,"rb");if(!f)return NULL;Buffer b={0};char buf[65536];size_t n;while((n=fread(buf,1,sizeof(buf),f))){if(n>cap-b.n){errno=EFBIG;buf_free(&b);if(f!=stdin)fclose(f);return NULL;}buf_n(&b,buf,n);}int err=ferror(f);if(f!=stdin)fclose(f);if(err){buf_free(&b);return NULL;}if(!b.s)buf_add(&b,"");if(length)*length=b.n;return b.s;}
char*path_join(const char*a,const char*b){Buffer r={0};buf_printf(&r,"%s/%s",a,b);return r.s;}
int mkdir_tree(const char*path){char*p=strdup(path);if(!p)return -1;for(char*q=p+1;*q;q++)if(*q=='/'){*q=0;if(mkdir(p,0700)&&errno!=EEXIST){free(p);return -1;}*q='/';}int rc=mkdir(p,0700);if(rc&&errno==EEXIST)rc=0;free(p);return rc;}
int write_atomic(const char*dir,const char*name,const void*data,size_t size){
 Buffer tmp={0};buf_printf(&tmp,"%s/.%s.tmp.%ld",dir,name,(long)getpid());char*dest=path_join(dir,name);int fd=open(tmp.s,O_WRONLY|O_CREAT|O_TRUNC,0600),rc=-1;if(fd<0)goto end;
 size_t at=0;while(at<size){ssize_t n=write(fd,(const char*)data+at,size-at);if(n<0&&errno==EINTR)continue;if(n<=0)goto close_file;at+=(size_t)n;}
 if(fsync(fd))goto close_file;if(close(fd)){fd=-1;goto end;}fd=-1;if(rename(tmp.s,dest))goto end;
 {int dfd=open(dir,O_RDONLY);if(dfd<0)goto end;rc=fsync(dfd);int saved=errno;close(dfd);errno=saved;}
close_file:if(fd>=0)close(fd);
end:if(rc)unlink(tmp.s);free(dest);buf_free(&tmp);return rc;
}
