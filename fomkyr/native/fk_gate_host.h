/* SPDX-License-Identifier: MIT. Explicit imported profile, never silent proof. */
#include "../fk_gate/src/fk_gate.h"
#include "../fk_gate/profiles/runtime-identity.h"
static int fg_requested,fg_sectors=1,fg_enabled,fg_dependency_error;
static u64 fg_budget=128*MIB;
static int fg_host_bind(const char*id){
 if(!fg_enabled)return 0;
 memcpy(native_pointer(gn_import_buffer()),id,64);
 int rc=gn_fg_bind(64);if(rc<0)return -rc;if(!rc){fg_enabled=0;return 0;}
 rc=gn_fg_sector_mode((u32)fg_sectors);return rc<0?-rc:0;
}
static int fg_optional_error(int rc){return rc==GN_MEMORY||rc==GN_LIMIT||rc==GN_SCRATCH;}
static int closure_begin(u64 budget){
 int rc=scalar_closure_begin(budget);if(rc||!fg_enabled)return rc;
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
   if(rc==FKG_CLOSED)log_json(stderr,"{\"event\":\"fk-gate-degree-closure\",\"degree\":%"PRIu64",\"profile\":\"%s\",\"conditionalOnImportedFkDimensions\":true}\n",gn_stat(3),FKG_AUTHORITY_ID);
  }return 0;
 }
 return scalar_closure_try();
}
static void fg_metadata(Buffer*b){
 if(!fg_enabled)return;
 buf_printf(b,",\"fkGateProfileId\":\"%s\",\"fkGateProfileVersion\":\"0.3.0\",\"conditionalOnImportedFkDimensions\":true,\"fkGateProofReplayedHere\":false,\"fkGate\":{\"status\":%d,\"degree\":%"PRIu64",\"sectors\":%s,\"sectorSkips\":%"PRIu64",\"suspendedSkips\":%"PRIu64",\"commitSkips\":%"PRIu64",\"closedDegrees\":%"PRIu64",\"unvisitedSkipped\":%"PRIu64",\"countMicroseconds\":%"PRIu64",\"sectorCountMicroseconds\":%"PRIu64",\"counterWorkspaceBytes\":%"PRIu64",\"closedSectors\":%"PRIu64",\"upper\":%"PRIu64",\"lower\":%"PRIu64",\"counterError\":%"PRIu64"}",FKG_AUTHORITY_ID,gn_fg_status(),gn_fg_stat(0),fg_sectors?"true":"false",gn_fg_stat(8),gn_fg_stat(17),gn_fg_stat(18),gn_fg_stat(1),gn_fg_stat(4),gn_fg_stat(5),gn_fg_stat(9),gn_fg_stat(10),gn_fg_stat(20),(u64)gn_fg_limb(0,0)|((u64)gn_fg_limb(0,1)<<32),(u64)gn_fg_limb(1,0)|((u64)gn_fg_limb(1,1)<<32),gn_fg_stat(11));
}
static void fg_pulse(void){
 if(!fg_enabled)return;
 log_json(stderr,"{\"event\":\"fk-gate-progress\",\"status\":%d,\"degree\":%"PRIu64",\"deficit\":%u,\"closedSectors\":%"PRIu64",\"sectorSkips\":%"PRIu64",\"suspendedSkips\":%"PRIu64"}\n",gn_fg_status(),gn_fg_stat(0),gn_fg_limb(2,0),gn_fg_stat(20),gn_fg_stat(8),gn_fg_stat(17));
}
