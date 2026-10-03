/* SPDX-License-Identifier: MIT. Optional, explicit lower-bound authority. */
static struct {char*text;Json json;char key[65];int entries,assumed,enabled;u64 total_skipped,closures;Buffer events;} hc;
static int closure_dependency_error;
static int closure_adaptive=1;
/* Requested batch size remains a ceiling. Bound speculative work when only a
 * few new leading words are missing; this does not skip any pair by itself. */
static u32 closure_batch_limit(u32 limit,u32 workers){
 if(!hc.enabled||!closure_adaptive||!gn_hilbert_gate_stat(0))return limit;
 u64 u=gn_hilbert_gate_stat(1),l=gn_hilbert_gate_stat(2);if(u<l||u-l>limit)return limit;
 u64 window=2*(u-l);if(window<workers)window=workers;return window<limit?(u32)window:limit;
}
static int tok_next(Json*j,int i){return i>=0&&i<j->n?j->t[i].next:j->n;}
static i64 closure_i64(Json*j,int tok){char*s=json_string(j,tok);if(!s)die("invalid integer in Hilbert witness");errno=0;char*e;i64 v=strtoll(s,&e,10);int bad=errno||!*s||*e;free(s);if(bad)die("Hilbert witness integer outside signed 64-bit replay format");return v;}
static u64 closure_u64(Json*j,int tok){int ok=1;u64 v=json_u64(j,tok,&ok);if(!ok)die("invalid unsigned integer in Hilbert policy");return v;}
static int closure_entry(u32 degree){if(!hc.enabled)return -1;Json*j=&hc.json;for(int e=hc.entries+1;e<j->t[hc.entries].next;e=tok_next(j,e)){u32 d=(u32)closure_u64(j,json_key(j,e,"degree"));if(d==degree)return e;if(d>degree)break;}return -1;}
static void closure_load(const char*path,int assumed,Fixture*f,u32 modulus){
 if(!path)return;hc.text=read_file(path,64*1024*1024,NULL);if(!hc.text||json_parse(&hc.json,hc.text))die("cannot parse Hilbert policy (maximum 64 MiB)");Json*j=&hc.json;
 if(closure_u64(j,json_key(j,0,"schema"))!=1)die("unsupported Hilbert policy schema");
 char*id=json_string(j,json_key(j,0,"identity")),*kind=json_string(j,json_key(j,0,"kind"));
 char current[65];fixture_identity(f,modulus,current);
 if(!id||strcmp(id,current)||closure_u64(j,json_key(j,0,"modulus"))!=modulus)die("Hilbert policy is for another input/order/field");free(id);
 if(!kind||strcmp(kind,assumed?"external-dimensions":"integer-duals"))die("use --hilbert-certificate for integer-duals, or explicitly --assume-hilbert for external dimensions");free(kind);
 hc.entries=json_key(j,0,"entries");if(hc.entries<0||j->t[hc.entries].type!='['||j->t[hc.entries].count>1024)die("invalid Hilbert entries");
 u32 previous=0;for(int e=hc.entries+1;e<j->t[hc.entries].next;e=tok_next(j,e)){u64 d=closure_u64(j,json_key(j,e,"degree"));if(!d||d>GN_INDEX_MAX||d<=previous)die("Hilbert degrees must be strictly increasing positive indices");previous=(u32)d;(void)closure_u64(j,json_key(j,e,"dimension"));}
 char*compact=json_compact(hc.text,strlen(hc.text));if(!compact)die("Hilbert policy serialization failed");sha256_hex(compact,strlen(compact),hc.key);free(compact);
 hc.assumed=assumed;hc.enabled=1;
}
static int closure_verify(Fixture*f,u64 budget){
 if(!hc.enabled||hc.assumed)return 0;Json*j=&hc.json;
 for(int e=hc.entries+1;e<j->t[hc.entries].next;e=tok_next(j,e)){
  u32 d=(u32)closure_u64(j,json_key(j,e,"degree"));u64 dim=closure_u64(j,json_key(j,e,"dimension"));if(dim>UINT32_MAX)return GN_LIMIT;
  int piv=json_key(j,e,"pivots"),vec=json_key(j,e,"vectors");if(piv<0||vec<0||j->t[piv].type!='['||j->t[vec].type!='['||j->t[piv].count!=dim||j->t[vec].count!=dim)return GN_INPUT;
  u32 nr=0,nt=0;for(u32 r=0;r<f->nr;r++)if(f->r[r].degree<=d){nr++;if(UINT32_MAX-nt<f->r[r].n)return GN_LIMIT;nt+=f->r[r].n;}
  u64 available=budget-gn_stat(4);int rc=gn_lb_begin(d,(u32)dim,nr,nt,available<64*MIB?available:64*MIB);if(rc)return rc;
#define LB_CHECK(call) do{rc=(call);if(rc){gn_lb_release();return rc;}}while(0)
  u32 k=0;for(int t=piv+1;t<j->t[piv].next;t=tok_next(j,t)){u64 col=closure_u64(j,t);if(col>UINT32_MAX){gn_lb_release();return GN_INPUT;}LB_CHECK(gn_lb_pivot(k++,(u32)col));}
  for(u32 r=0;r<f->nr;r++){InputRelation*rel=&f->r[r];if(rel->degree>d)continue;LB_CHECK(gn_lb_relation(rel->degree,rel->n));for(u32 t=0;t<rel->n;t++){u64 col=0;for(u32 b=0;b<rel->degree;b++){col=col*f->nv+rel->t[t].w[b];if(col>UINT32_MAX){gn_lb_release();return GN_LIMIT;}}LB_CHECK(gn_lb_term((u32)col,rel->t[t].c));}}
  k=0;for(int v=vec+1;v<j->t[vec].next;v=tok_next(j,v)){if(j->t[v].type!='['){gn_lb_release();return GN_INPUT;}LB_CHECK(gn_lb_vector(k++));for(int pair=v+1;pair<j->t[v].next;pair=tok_next(j,pair)){if(j->t[pair].type!='['||j->t[pair].count!=2){gn_lb_release();return GN_INPUT;}int c=pair+1,n=tok_next(j,c);u64 col=closure_u64(j,c);if(col>UINT32_MAX){gn_lb_release();return GN_INPUT;}LB_CHECK(gn_lb_entry((u32)col,closure_i64(j,n)));}LB_CHECK(gn_lb_check());}
  LB_CHECK(gn_lb_finish());
#undef LB_CHECK
 }
 return 0;
}
static void closure_metadata(Buffer*b){
 if(!hc.enabled)return;buf_printf(b,",\"hilbertEvidenceId\":\"%s\",\"hilbertEvidenceMode\":\"%s\",\"conditionalOnExternalDimensions\":%s,\"hilbertClosureEvents\":[",hc.key,hc.assumed?"external-assumption":"replayed-integer-duals",hc.assumed?"true":"false");
 if(hc.events.s)buf_n(b,hc.events.s,hc.events.n);buf_add(b,"]");
}
static int closure_begin(u64 budget){
 int e=closure_entry((u32)gn_stat(3));if(e<0)return 0;
 u64 available=budget-gn_stat(4);int rc=gn_hilbert_gate_begin(closure_u64(&hc.json,json_key(&hc.json,e,"dimension")),available<256*MIB?available:256*MIB);
 if(rc==GN_MEMORY||rc==GN_LIMIT){fprintf(stderr,"Hilbert closure unavailable at degree %" PRIu64 ": %s; ordinary exact completion continues.\n",gn_stat(3),ename(rc));return 0;}return rc;
}
static int closure_try(void){
 if(!hc.enabled||!gn_hilbert_gate_stat(0)||gn_hilbert_gate_stat(3))return 0;
 int rc=gn_hilbert_gate_try();if(rc<0)return -rc;if(!rc)return 0;
 Buffer b={0};buf_printf(&b,"{\"degree\":%" PRIu64 ",\"dimension\":\"%" PRIu64 "\",\"basisSize\":%" PRIu64 ",\"individuallyCommittedPairs\":%" PRIu64 ",\"overlapsBypassed\":%" PRIu64 ",\"notYetEnumerated\":%" PRIu64 ",\"scheduledNotCommitted\":%" PRIu64 "}",gn_stat(3),gn_hilbert_gate_stat(2),gn_stat(0),gn_progress_stat(2),gn_hilbert_gate_stat(5),gn_hilbert_gate_stat(8),gn_hilbert_gate_stat(9));
 if(hc.events.n)buf_add(&hc.events,",");buf_n(&hc.events,b.s,b.n);hc.closures++;hc.total_skipped+=gn_hilbert_gate_stat(5);
 fprintf(stderr,"{\"event\":\"hilbert-degree-closure\",\"evidence\":\"%s\",\"details\":%s}\n",hc.assumed?"external-assumption":"replayed-integer-duals",b.s);buf_free(&b);return 0;
}
