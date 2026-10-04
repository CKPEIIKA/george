/* SPDX-License-Identifier: MIT. Reference POSIX coordinator glue. */
static int fg_host_enabled;
static u64 fg_host_budget(u64 total){u64 used=gn_stat(4),freebytes=total>used?total-used:0;return freebytes<64*MIB?freebytes:64*MIB;}
static void fg_host_bind(void){
 const char*v=getenv("FOMKYR_HILBERT_GATE");fg_host_enabled=v&&!strcmp(v,"1");
 if(!fg_host_enabled)return;
 memcpy(native_pointer(gn_import_buffer()),identity,64);
 int rc=gn_fg_bind(64);if(rc<0)die("FK Gate bound at unsafe initialization state");
 const char*sectors=getenv("FOMKYR_HILBERT_SECTORS");if(rc>0&&gn_fg_sector_mode(sectors&&!strcmp(sectors,"1"))<0)die("Unsafe sector initialization");
 if(!rc){fg_host_enabled=0;if(!quiet)fprintf(stderr,"FK Gate unavailable for this exact input/field; ordinary completion retained.\n");}
}
static int fg_host_begin(u64 budget){
 if(!fg_host_enabled)return 0;int rc=gn_fg_begin(fg_host_budget(budget));
 if(rc>=0)return 0;
 if(rc==-GN_MEMORY||rc==-GN_SCRATCH||rc==-GN_LIMIT)return 0;
 return -rc;
}
static int fg_host_poll(u64 budget){
 if(!fg_host_enabled||gn_fg_status()==0)return 0;
 int rc=gn_fg_poll();if(rc<0)return rc;if(rc!=2)return 0;
 rc=gn_fg_close(fg_host_budget(budget));
 if(rc==-GN_MEMORY||rc==-GN_SCRATCH||rc==-GN_LIMIT)return 0;
 if(rc==3){if(!quiet)fprintf(stderr,"{\"event\":\"certified-degree-closure\",\"degree\":%llu,\"unvisitedOverlapsProvedRedundant\":%llu,\"actualPairsReduced\":%llu,\"proofDigest\":\"973681645854498141e517a38952f030567a3ac2b8edfaaa73668720a5b2d42c\"}\n",(unsigned long long)gn_stat(3),(unsigned long long)gn_fg_stat(4),(unsigned long long)gn_stat(7));return 1;}
 return rc<0?rc:-GN_STATE;
}
