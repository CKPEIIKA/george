/* SPDX-License-Identifier: MIT. Explicit imported profile, never silent proof. */
#include "../fk_gate/src/fk_gate.h"
#include "../fk_gate/profiles/runtime-identity.h"
#include "../fk_gate/profiles/generator-edges.h"
static int fg_requested,fg_sectors=1,fg_enabled,fg_dependency_error,fg_external_requested;
static u64 fg_budget=128*MIB;
static const char*fg_host_profile_id(void){return fg_external_requested?hc.key:FKG_AUTHORITY_ID;}
static void fg_host_prepare(Fixture*f){
 if(!fg_external_requested)return;
 if(!hc.enabled||!hc.assumed)die("--assume-sectors requires an external-dimensions policy");
 Json*j=&hc.json;char*order=json_string(j,json_key(j,0,"groupOrder"));
 if(!order||strcmp(order,"S6-lex-parity-v1"))die("sector policy requires groupOrder S6-lex-parity-v1");free(order);
 int edges=json_key(j,0,"generatorEdges");if(edges<0||j->t[edges].type!='['||j->t[edges].count!=(int)f->nv||f->nv>15)die("sector policy must label every generator by a distinct S6 edge");
 u32 previous=0;
 for(int e=hc.entries+1;e<j->t[hc.entries].next;e=tok_next(j,e)){
  u64 d=closure_u64(j,json_key(j,e,"degree"));if(d!=++previous||d>30)die("sector policy requires consecutive degrees 1..through, at most 30");
  int sectors=json_key(j,e,"sectorDimensions");if(sectors<0||j->t[sectors].type!='['||j->t[sectors].count!=360)die("each sector entry needs 360 individual permutation dimensions");
  u64 sum=0;for(int t=sectors+1;t<j->t[sectors].next;t=tok_next(j,t)){u64 v=closure_u64(j,t);if(UINT64_MAX-sum<v)die("sector total exceeds uint64");sum+=v;}
  if(sum!=closure_u64(j,json_key(j,e,"dimension")))die("sector dimensions do not sum to the whole-degree dimension");
 }
 if(!previous)die("empty sector policy");fg_enabled=1;fg_sectors=1;
}
static int fg_host_bind(const char*id){
 if(!fg_enabled)return 0;
 if(fg_external_requested){
  Json*j=&hc.json;u32 through=(u32)j->t[hc.entries].count;
  int rc=gn_fg_external_bind(through);if(rc)return rc;
  int edges=json_key(j,0,"generatorEdges");u32 generator=0;
  for(int e=edges+1;e<j->t[edges].next;e=tok_next(j,e)){
   if(j->t[e].type!='['||j->t[e].count!=2)die("generatorEdges must contain oriented-independent pairs [a,b], 1<=a<b<=6");
   u64 a=closure_u64(j,e+1),b=closure_u64(j,tok_next(j,e+1));u32 edge=15;
   if(a<1||a>=b||b>6)die("invalid S6 generator edge");
   for(u32 k=0;k<15;k++)if(fkg_generator_edges[k][0]==a&&fkg_generator_edges[k][1]==b){edge=k;break;}
   if(edge==15)return GN_INPUT;rc=gn_fg_external_edge(generator++,edge);if(rc)return rc;
  }
  for(int e=hc.entries+1;e<j->t[hc.entries].next;e=tok_next(j,e)){
   u32 d=(u32)closure_u64(j,json_key(j,e,"degree")),g=0;int sectors=json_key(j,e,"sectorDimensions");
   for(int t=sectors+1;t<j->t[sectors].next;t=tok_next(j,t)){rc=gn_fg_external_lower(d,g++,closure_u64(j,t));if(rc)return rc;}
  }
  rc=gn_fg_external_seal();if(rc)return rc;return gn_fg_sector_mode(1)<0?GN_STATE:0;
 }
 memcpy(native_pointer(gn_import_buffer()),id,64);
 int rc=gn_fg_bind(64);if(rc<0)return -rc;if(!rc){fg_enabled=0;return 0;}
 rc=gn_fg_sector_mode((u32)fg_sectors);return rc<0?-rc:0;
}
static int fg_optional_error(int rc){return rc==GN_MEMORY||rc==GN_LIMIT||rc==GN_SCRATCH;}
static int closure_begin(u64 budget){
 int rc=fg_external_requested?0:scalar_closure_begin(budget);if(rc||!fg_enabled)return rc;
 u64 used=gn_stat(4),available=budget>used?budget-used:0;
 rc=gn_fg_begin(fg_budget<available?fg_budget:available);
 if(rc<0){if(fg_optional_error(-rc)){fprintf(stderr,"FK Gate counter unavailable (%s); ordinary completion retained.\n",ename(rc));return 0;}return -rc;}
 return 0;
}
static int closure_try(void){
 if(fg_enabled&&gn_fg_status()>0){
  if(gn_fg_status()==FKG_CLOSED)return 0;
  int rc=gn_fg_poll();if(rc<0)return -rc;
  if(rc==FKG_READY){rc=gn_fg_close(fg_budget);if(rc<0)return fg_optional_error(-rc)?0:-rc;
   if(rc==FKG_CLOSED)log_json(stderr,"{\"event\":\"fk-gate-degree-closure\",\"degree\":%"PRIu64",\"profile\":\"%s\",\"conditionalOnImportedFkDimensions\":true}\n",gn_stat(3),fg_host_profile_id());
  }return 0;
 }
 return scalar_closure_try();
}
static void fg_metadata(Buffer*b){
 if(!fg_enabled)return;
 buf_printf(b,",\"fkGateProfileId\":\"%s\",\"fkGateProfileVersion\":\"0.7.5\",\"conditionalOnImportedFkDimensions\":true,\"fkGateProofReplayedHere\":false,\"fkGate\":{\"status\":%d,\"degree\":%"PRIu64",\"sectors\":%s,\"sectorSkips\":%"PRIu64",\"suspendedSkips\":%"PRIu64",\"commitSkips\":%"PRIu64",\"closedDegrees\":%"PRIu64",\"unvisitedSkipped\":%"PRIu64",\"countMicroseconds\":%"PRIu64",\"sectorCountMicroseconds\":%"PRIu64",\"counterWorkspaceBytes\":%"PRIu64",\"closedSectors\":%"PRIu64",\"upper\":%"PRIu64",\"lower\":%"PRIu64",\"counterError\":%"PRIu64"}",fg_host_profile_id(),gn_fg_status(),gn_fg_stat(0),fg_sectors?"true":"false",gn_fg_stat(8),gn_fg_stat(17),gn_fg_stat(18),gn_fg_stat(1),gn_fg_stat(4),gn_fg_stat(5),gn_fg_stat(9),gn_fg_stat(10),gn_fg_stat(20),(u64)gn_fg_limb(0,0)|((u64)gn_fg_limb(0,1)<<32),(u64)gn_fg_limb(1,0)|((u64)gn_fg_limb(1,1)<<32),gn_fg_stat(11));
 buf_printf(b,",\"certifiedProfileThroughDegree\":%"PRIu64",\"completeDimensionThroughDegree\":%"PRIu64,gn_fg_stat(14),gn_fg_stat(15));
}
static void fg_pulse(void){
 if(!fg_enabled)return;
 u64 deficit=(u64)gn_fg_limb(2,0)|((u64)gn_fg_limb(2,1)<<32);
 log_json(stderr,"{\"event\":\"fk-gate-progress\",\"status\":%d,\"degree\":%"PRIu64",\"deficit\":%"PRIu64",\"closedSectors\":%"PRIu64",\"sectorSkips\":%"PRIu64",\"suspendedSkips\":%"PRIu64"}\n",gn_fg_status(),gn_fg_stat(0),deficit,gn_fg_stat(20),gn_fg_stat(8),gn_fg_stat(17));
}
