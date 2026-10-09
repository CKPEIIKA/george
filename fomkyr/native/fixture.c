/* SPDX-License-Identifier: MIT */
#include "fixture.h"
#include "host.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <errno.h>
#include <inttypes.h>
static int identifier(const char*s){if(!s||!(*s=='_'||isalpha((unsigned char)*s)))return 0;for(;*s;s++)if(!(*s=='_'||isalnum((unsigned char)*s)))return 0;return 1;}
static int coeff(const char*s,i64*out){if(!s||!*s)return 0;const char*p=s;if(*p=='-')p++;if(!*p)return 0;for(;*p;p++)if(!isdigit((unsigned char)*p))return 0;errno=0;char*e;long long x=strtoll(s,&e,10);if(errno||*e||!x||x>INT64_C(4611686018427387903)||x< -INT64_C(4611686018427387903))return 0;*out=(i64)x;return 1;}
static int variable(Fixture*f,const char*s){for(u32 i=0;i<f->nv;i++)if(!strcmp(f->vars[i],s))return(int)i;return -1;}
static int array_bytes(size_t count,size_t width,size_t*bytes){if(!count||!width||count>SIZE_MAX/width)return 0;*bytes=count*width;return 1;}
static int newrel(Fixture*f,InputRelation r){
 if(!r.n||!r.degree||f->nr==UINT32_MAX)return 0;
 if(f->nr==f->capacity){
  u32 cap=f->capacity?(f->capacity>UINT32_MAX/2?UINT32_MAX:f->capacity*2):8;
  size_t bytes;if(!array_bytes(cap,sizeof(InputRelation),&bytes))return 0;
  InputRelation*p=malloc(bytes);if(!p)return 0;
  if(f->nr)memcpy(p,f->r,(size_t)f->nr*sizeof(*p));free(f->r);f->r=p;f->capacity=cap;
 }
 f->r[f->nr]=r;f->nr++;
 if(r.degree>f->max_degree)f->max_degree=r.degree;return 1;
}
static int newterm(InputRelation*r,InputTerm t){
 if(!t.degree||!t.c||r->n==UINT32_MAX||(r->n&&r->degree!=t.degree))return 0;
 if(r->n==r->capacity){
  u32 cap=r->capacity?(r->capacity>UINT32_MAX/2?UINT32_MAX:r->capacity*2):8;
  size_t bytes;if(!array_bytes(cap,sizeof(InputTerm),&bytes))return 0;
  InputTerm*p=malloc(bytes);if(!p)return 0;
  if(r->n)memcpy(p,r->t,(size_t)r->n*sizeof(*p));free(r->t);r->t=p;r->capacity=cap;
 }
 r->t[r->n]=t;r->n++;r->degree=t.degree;return 1;
}
static void relation_free(InputRelation*r){for(u32 i=0;i<r->n;i++)free(r->t[i].w);free(r->t);memset(r,0,sizeof(*r));}
static void canonical_bg(Fixture*f){Buffer v={0},r={0};buf_add(&v,"[");for(u32 i=0;i<f->nv;i++){if(i)buf_add(&v,",");buf_string(&v,f->vars[i]);}buf_add(&v,"]");buf_add(&r,"[");
 for(u32 i=0;i<f->nr;i++){if(i)buf_add(&r,",");buf_printf(&r,"{\"degree\":%u,\"terms\":[",f->r[i].degree);for(u32 j=0;j<f->r[i].n;j++){if(j)buf_add(&r,",");InputTerm*t=&f->r[i].t[j];buf_add(&r,"{\"word\":[");for(u32 k=0;k<t->degree;k++)buf_printf(&r,"%s%u",k?",":"",t->w[k]);buf_printf(&r,"],\"coefficient\":\"%" PRId64 "\"}",t->c);}buf_add(&r,"]}");}buf_add(&r,"]");f->variables_json=v.s;f->relations_json=r.s;
}
static void skip(const char**p){for(;;){while(isspace((unsigned char)**p))(*p)++;if(**p=='%'){while(**p&&**p!='\n')(*p)++;}else return;}}
static char*name(const char**p){const char*b=*p;if(!(**p=='_'||isalpha((unsigned char)**p)))return NULL;while(**p=='_'||isalnum((unsigned char)**p))(*p)++;size_t n=(size_t)(*p-b);char*s=malloc(n+1);if(s){memcpy(s,b,n);s[n]=0;}return s;}
static int from_bg(Fixture*f,const char*s){InputRelation r={0};InputTerm t={0};const char*p=s;skip(&p);if(strncmp(p,"vars",4)||!(isspace((unsigned char)p[4])))goto error;p+=4;
 for(;;){skip(&p);char*n=name(&p);if(!n||f->nv==16||variable(f,n)>=0){free(n);goto error;}f->vars[f->nv++]=n;skip(&p);if(*p==';'){p++;break;}if(*p++!=',')goto error;}
 for(;;){skip(&p);if(!*p)break;int sign=1;if(*p=='+'||*p=='-'){if(*p++=='-')sign=-1;skip(&p);}t=(InputTerm){0};t.c=sign;
  for(;;){skip(&p);if(isdigit((unsigned char)*p)){errno=0;char*e;unsigned long long v=strtoull(p,&e,10);if(errno||v>UINT64_C(4611686018427387903)||!v)goto error;__int128 prod=(__int128)t.c*v;if(prod>INT64_C(4611686018427387903)||prod< -INT64_C(4611686018427387903))goto error;t.c=(i64)prod;p=e;}else{char*n=name(&p);int id=n?variable(f,n):-1;free(n);if(id<0)goto error;skip(&p);u64 power=1;if(*p=='^'){p++;skip(&p);if(!isdigit((unsigned char)*p))goto error;char*e;errno=0;power=strtoull(p,&e,10);if(errno||!power||power>GN_INDEX_MAX)goto error;p=e;}if(power>GN_INDEX_MAX-t.degree)goto error;u8*w=realloc(t.w,(size_t)(t.degree+power));if(!w)goto error;t.w=w;memset(w+t.degree,id,(size_t)power);t.degree+=(u32)power;}
   skip(&p);if(*p!='*')break;p++;
  }if(!newterm(&r,t))goto error;t=(InputTerm){0};skip(&p);
  if(*p=='+'||*p=='-')continue;if(*p==','||*p==';'){char c=*p++;if(!newrel(f,r))goto error;r=(InputRelation){0};if(c==';'){skip(&p);if(*p)goto error;break;}continue;}goto error;
 }if(r.n)goto error;canonical_bg(f);return f->nv&&f->nr;
error:free(t.w);relation_free(&r);return 0;
}
static int from_json(Fixture*f,char*text){Json j={0};InputRelation r={0};InputTerm t={0};if(json_parse(&j,text)){json_free(&j);return 0;}int ok=0,vs=json_key(&j,0,"variables"),rs=json_key(&j,0,"relations");if(vs<0||rs<0||j.t[vs].type!='['||j.t[rs].type!='[')goto end;
 for(int i=vs+1;i<j.t[vs].next;i=j.t[i].next){char*n=json_string(&j,i);if(!identifier(n)||f->nv==16||variable(f,n)>=0){free(n);goto end;}f->vars[f->nv++]=n;}
 for(int i=rs+1;i<j.t[rs].next;i=j.t[i].next){int valid=1;u64 d=json_u64(&j,json_key(&j,i,"degree"),&valid);int ts=json_key(&j,i,"terms");if(!valid||!d||d>GN_INDEX_MAX||ts<0||j.t[ts].type!='[')goto end;r=(InputRelation){0};
  for(int k=ts+1;k<j.t[ts].next;k=j.t[k].next){int w=json_key(&j,k,"word"),c=json_key(&j,k,"coefficient");t=(InputTerm){0};char*cs=json_string(&j,c);if(w<0||j.t[w].type!='['||j.t[w].count!=(int)d||!coeff(cs,&t.c)){free(cs);goto end;}free(cs);t.degree=(u32)d;t.w=malloc(t.degree);if(!t.w)goto end;u32 q=0;for(int l=w+1;l<j.t[w].next;l=j.t[l].next){u64 x=json_u64(&j,l,&valid);if(!valid||x>=f->nv)goto end;t.w[q++]=(u8)x;}if(!newterm(&r,t))goto end;t=(InputTerm){0};
  }if(!newrel(f,r))goto end;r=(InputRelation){0};
 }
 f->variables_json=json_compact(text+j.t[vs].start,(size_t)(j.t[vs].end-j.t[vs].start));f->relations_json=json_compact(text+j.t[rs].start,(size_t)(j.t[rs].end-j.t[rs].start));ok=f->nv&&f->variables_json&&f->relations_json;
end:free(t.w);relation_free(&r);json_free(&j);return ok;
}
int fixture_read(Fixture*f,const char*path,char*error,size_t cap){memset(f,0,sizeof(*f));size_t n;char*text=read_file(path,64*1024*1024,&n);if(!text){snprintf(error,cap,"Cannot read input: %s",strerror(errno));return -1;}const char*p=text;skip(&p);int ok=*p=='{'?from_json(f,text):from_bg(f,text);free(text);if(!ok){fixture_free(f);snprintf(error,cap,"Invalid input. Use a JSON fixture or 'vars ...; polynomial,...;' with homogeneous expanded integer polynomials, 1..16 generators and nonzero signed-63-bit input coefficients.");return -1;}
 Buffer b={0};buf_printf(&b,"{\"variables\":%s,\"relations\":%s}",f->variables_json,f->relations_json);f->canonical=b.s;return 0;
}
void fixture_free(Fixture*f){for(u32 i=0;i<f->nv;i++)free(f->vars[i]);for(u32 i=0;i<f->nr;i++){for(u32 j=0;j<f->r[i].n;j++)free(f->r[i].t[j].w);free(f->r[i].t);}free(f->r);free(f->canonical);free(f->variables_json);free(f->relations_json);memset(f,0,sizeof(*f));}
void fixture_identity(Fixture*f,u32 modulus,char out[65]){Buffer b={0};buf_printf(&b,"{\"semantics\":\"fomkyr-homogeneous-degleftlex-v1\",\"variables\":%s,\"relations\":%s,\"modulus\":%u}",f->variables_json,f->relations_json,modulus);sha256_hex(b.s,b.n,out);buf_free(&b);}
int fixture_load_degree(Fixture*f,u32 d){for(u32 i=0;i<f->nr;i++){InputRelation*r=&f->r[i];if(r->degree!=d)continue;int rc=gn_input_begin(d,r->n);if(rc)return rc;for(u32 j=0;j<r->n;j++){InputTerm*t=&r->t[j];if(d<=31){u64 lo=0,hi=0;for(u32 k=0;k<d;k++){hi=(hi<<4)|(lo>>60);lo=(lo<<4)|t->w[k];}rc=gn_input_term(lo,hi,t->c);}else{if(d>gn_import_capacity())return GN_SCRATCH;memcpy(native_pointer(gn_import_buffer()),t->w,d);rc=gn_input_bytes(d,t->c);}if(rc)return rc;}rc=gn_input_end();if(rc)return rc;}return 0;}
