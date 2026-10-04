/* SPDX-License-Identifier: MIT
 * POSIX command-line coordinator for the same exact C kernel used by WASM.
 * Workers share one basis. Checkpoints contain portable records/cursors, not RAM.
 */
#define _POSIX_C_SOURCE 200809L
#include "fixture.h"
#include "host.h"
#include "support.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>
#include <errno.h>
#include <getopt.h>
#include <pthread.h>
#include <signal.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/resource.h>
#include <limits.h>
#include <ctype.h>
#include <math.h>
#include <time.h>
#define VERSION "0.7.0"
static u32 quantum_ms=250,lookahead=128,coop_flags=3,coop_max_window=512,cache_maxima=1,big_row_max_terms=0,cache_percent=12;
static u64 shared_cache_bytes=UINT64_MAX;
static u32 helper_rows=1,large_row_workspaces=0;
static const char *scratch_arg="auto",*reserve_arg="auto",*telemetry_path;
static u64 planned_scratch,planned_reserve;
#define MIB UINT64_C(1048576)
#define PAGE UINT64_C(65536)
#include "human.h"
#ifndef FOMKYR_DATADIR
#define FOMKYR_DATADIR "/usr/local/share/fomkyr"
#endif
static const char*errors[]={"OK","MEMORY_BUDGET","SCRATCH_BUDGET","INVALID_INPUT","IO_ERROR","CANCELLED","CORRUPT_RECORD","STATE_ERROR","BATCH_OUTPUT_FULL","REPRESENTATION_LIMIT","CANDIDATE_REJECTED","DEFERRED_ROW","WORKSPACE_PRESSURE"};
static const char*ename(int rc){if(rc<0)rc=-rc;return(unsigned)rc<sizeof(errors)/sizeof(*errors)?errors[rc]:"UNKNOWN_ERROR";}
static void die(const char*s){fprintf(stderr,"fomkyr: %s\n",s);exit(2);}
static u64 parse_u64(const char*s){if(!s||!*s||*s=='-')die("expected a nonnegative integer");errno=0;char*e;unsigned long long n=strtoull(s,&e,10);if(errno||*e)die("invalid integer");return n;}
static u64 parse_bytes(const char*s){if(!s||!*s||*s=='-')die("invalid memory size");errno=0;char*e;unsigned long long n=strtoull(s,&e,10);if(errno||e==s)die("invalid memory size");u64 m=1;if(*e){switch(toupper((unsigned char)*e++)){case 'K':m=1024;break;case 'M':m=MIB;break;case 'G':m=MIB*1024;break;case 'T':m=MIB*1024*1024;break;default:die("memory suffix must be K, M, G or T (binary units)");}if(*e=='i'||*e=='I')e++;if(*e=='b'||*e=='B')e++;if(*e)die("invalid memory suffix");}if(n>GN_HARD_BYTES/m)die("memory size exceeds host offset representation");return(u64)n*m;}
static double parse_seconds(const char*s){errno=0;char*e;double x=strtod(s,&e);if(errno||e==s||*e||!(x>=0)||x>1e12)die("invalid duration");return x;}
static void signal_handler(int s){if(s==SIGUSR1)native_checkpoint=1;else native_stop=s;}
static int job_lock_fd=-1;
static void unlock_job(void){if(job_lock_fd>=0){close(job_lock_fd);job_lock_fd=-1;}}
static int lock_job(const char*dir){
 char*path=path_join(dir,"cli.lock");int fd=open(path,O_RDWR|O_CREAT,0600);free(path);if(fd<0)return -1;
 struct flock fl;memset(&fl,0,sizeof(fl));fl.l_type=F_WRLCK;fl.l_whence=SEEK_SET;
 if(fcntl(fd,F_SETLK,&fl)){int saved=errno;close(fd);errno=saved;return -1;}
 char b[64];int n=snprintf(b,sizeof(b),"%ld\n",(long)getpid());
 if(ftruncate(fd,0)||write(fd,b,(size_t)n)!=n||fsync(fd)){close(fd);return -1;}
 job_lock_fd=fd;atexit(unlock_job);return 0;
}
typedef struct {pthread_mutex_t m;pthread_cond_t work,done;pthread_t threads[GN_MAX_WORKERS];u32 ids[GN_MAX_WORKERS],created,active,remaining;unsigned epoch;int stop,rc;} Pool;
static Pool pool={.m=PTHREAD_MUTEX_INITIALIZER,.work=PTHREAD_COND_INITIALIZER,.done=PTHREAD_COND_INITIALIZER};
static int pool_waiting;
static u32 commit_task;
static void*worker(void*arg){u32 lane=*(u32*)arg;unsigned seen=0;pthread_mutex_lock(&pool.m);for(;;){while(!pool.stop&&seen==pool.epoch)pthread_cond_wait(&pool.work,&pool.m);if(pool.stop)break;seen=pool.epoch;int active=lane<pool.active;pthread_mutex_unlock(&pool.m);int rc=active?(gn_coop_stat(0)?gn_coop_reduce(lane):gn_batch_reduce(lane)):0;pthread_mutex_lock(&pool.m);if(active){if(rc&&!pool.rc)pool.rc=rc;if(--pool.remaining==0)pthread_cond_signal(&pool.done);}}pthread_mutex_unlock(&pool.m);return NULL;}
static int pool_open(u32 n){for(u32 i=1;i<n;i++){pool.ids[i]=i;int e=pthread_create(&pool.threads[i],NULL,worker,&pool.ids[i]);if(e)return e;pool.created++;}return 0;}
static int pool_reduce(u32 active){
 pthread_mutex_lock(&pool.m);pool.active=active;pool.remaining=active-1;pool.rc=0;pool.epoch++;pthread_cond_broadcast(&pool.work);pthread_mutex_unlock(&pool.m);
 int rc=gn_coop_stat(0)?gn_coop_reduce(0):gn_batch_reduce(0);
 if(!rc&&gn_coop_stat(0))rc=gn_coop_prepare_commit();
 pthread_mutex_lock(&pool.m);pool_waiting=1;
 while(pool.remaining){
  /* A long pair can outlive every task claimed by the coordinator. Continue
   * sampling the atomic lane counters while waiting for those readers. */
  struct timespec wake;clock_gettime(CLOCK_REALTIME,&wake);wake.tv_nsec+=100000000;
  if(wake.tv_nsec>=1000000000){wake.tv_sec++;wake.tv_nsec-=1000000000;}
  pthread_cond_timedwait(&pool.done,&pool.m,&wake);
  pthread_mutex_unlock(&pool.m);(void)gn_host_clock();pthread_mutex_lock(&pool.m);
 }
 pool_waiting=0;if(!rc)rc=pool.rc;pthread_mutex_unlock(&pool.m);return rc;
}
static void pool_close(void){pthread_mutex_lock(&pool.m);pool.stop=1;pthread_cond_broadcast(&pool.work);pthread_mutex_unlock(&pool.m);for(u32 i=1;i<=pool.created;i++)pthread_join(pool.threads[i],NULL);pool.created=0;}
#include "hilbert_closure.h"
#include "fk_gate_host.h"
typedef struct {Buffer payload;char*frontier;u64 sequence,rules,bytes;u32 completed,current,hash_bits;int partial,valid;double elapsed_ms;} Checkpoint;
static void cp_free(Checkpoint*c){buf_free(&c->payload);free(c->frontier);memset(c,0,sizeof(*c));}
static int cp_read(Checkpoint*c,const char*dir,const char*name,const char*identity,u64 filebytes){
 char*p=path_join(dir,name),*text=read_file(p,1048576,NULL);free(p);if(!text)return 0;Json j={0};int success=0;
 if(json_parse(&j,text))goto end;int ok=1;if(json_u64(&j,json_key(&j,0,"schema"),&ok)!=2||!ok)goto end;
 int payload=json_key(&j,0,"payload"),hs=json_key(&j,0,"sha256");if(payload<0||j.t[payload].type!='{')goto end;
 char*compact=json_compact(text+j.t[payload].start,(size_t)(j.t[payload].end-j.t[payload].start));char*want=json_string(&j,hs);char hash[65];if(!compact||!want){free(compact);free(want);goto end;}sha256_hex(compact,strlen(compact),hash);if(strcmp(hash,want)){free(compact);free(want);goto end;}free(want);
 char*id=json_string(&j,json_key(&j,payload,"identity"));if(!id||strcmp(id,identity)){free(id);free(compact);goto end;}free(id);
 u64 abi=json_u64(&j,json_key(&j,payload,"abi"),&ok);c->rules=json_u64(&j,json_key(&j,payload,"basisSize"),&ok);c->bytes=json_u64(&j,json_key(&j,payload,"diskBytes"),&ok);
 u64 completed=json_u64(&j,json_key(&j,payload,"completedThroughDegree"),&ok);if(!ok||(abi!=2&&abi!=3&&abi!=4&&abi!=5)||c->rules>UINT32_MAX||completed>GN_INDEX_MAX||c->bytes>filebytes||c->rules>c->bytes/56){free(compact);goto end;}c->completed=(u32)completed;
 if(abi==5){char*dep=json_string(&j,json_key(&j,payload,"fkGateProfileId"));if(!dep||!fg_enabled||(strcmp(dep,FKG_AUTHORITY_ID)&&strcmp(dep,FKG_UPSTREAM_AUTHORITY_ID)&&strcmp(dep,FKG_LEGACY_AUTHORITY_ID_0)&&strcmp(dep,FKG_LEGACY_AUTHORITY_ID_1))){fg_dependency_error=1;free(dep);free(compact);goto end;}free(dep);}
 if(abi==4||(abi==5&&json_key(&j,payload,"hilbertEvidenceId")>=0)){char*dep=json_string(&j,json_key(&j,payload,"hilbertEvidenceId"));if(!dep||!hc.enabled||strcmp(dep,hc.key)){closure_dependency_error=1;free(dep);free(compact);goto end;}free(dep);}
 char*elapsed=json_string(&j,json_key(&j,payload,"cumulativeElapsedMs"));if(elapsed){char*end;double v=strtod(elapsed,&end);if(!*end&&isfinite(v)&&v>=0)c->elapsed_ms=v;free(elapsed);}
 int seq=json_key(&j,payload,"sequence");c->sequence=seq<0?0:json_u64(&j,seq,&ok);char*partial=json_string(&j,json_key(&j,payload,"partial"));c->partial=partial&&!strcmp(partial,"true");free(partial);
 if(c->partial){u64 current=json_u64(&j,json_key(&j,payload,"currentDegree"),&ok),hb=json_u64(&j,json_key(&j,payload,"hashBits"),&ok);c->frontier=json_string(&j,json_key(&j,payload,"frontier"));if(!ok||current!=completed+1||current>GN_INDEX_MAX||hb<8||hb>26||!c->frontier||strlen(c->frontier)>18000||strlen(c->frontier)%2){free(compact);goto end;}c->current=(u32)current;c->hash_bits=(u32)hb;}
 buf_add(&c->payload,compact);free(compact);c->valid=success=1;
end:json_free(&j);free(text);if(!success)cp_free(c);return success;
}
static int cp_better(const Checkpoint*a,const Checkpoint*b){if(a->completed!=b->completed)return a->completed>b->completed;if(a->partial!=b->partial)return a->partial>b->partial;return a->sequence>b->sequence;}
static int nib(char c){if(c>='0'&&c<='9')return c-'0';if(c>='a'&&c<='f')return c-'a'+10;return -1;}
static u32 rd32(const unsigned char*p){return(u32)p[0]|((u32)p[1]<<8)|((u32)p[2]<<16)|((u32)p[3]<<24);}
static u64 rd64(const unsigned char*p){return(u64)rd32(p)|((u64)rd32(p+4)<<32);}
static int restore_cp(Checkpoint*cp,u32*workers){u64 off=0;
 for(u64 i=0;i<cp->rules;i++){
  if(off+32>cp->bytes||!gn_host_read(off,gn_import_buffer(),32))return GN_CORRUPT;
  u32 size=rd32((unsigned char*)native_pointer(gn_import_buffer())+4);if(size<56||size>cp->bytes-off)return GN_CORRUPT;
  while(size>gn_import_capacity()&&*workers>1){*workers=(*workers)/2;if(!*workers)*workers=1;int rc=gn_workers(*workers);if(rc)return rc;}
  if(size>gn_import_capacity())return GN_SCRATCH;if(!gn_host_read(off,gn_import_buffer(),size))return GN_IO;
  int rc=gn_restore_rule(size,off);if(rc)return rc;off+=size;
 }
 if(off!=cp->bytes)return GN_CORRUPT;
 if(cp->partial){size_t n=strlen(cp->frontier)/2;if(n>gn_import_capacity())return GN_SCRATCH;unsigned char*b=native_pointer(gn_import_buffer());for(size_t i=0;i<n;i++){int a=nib(cp->frontier[2*i]),c=nib(cp->frontier[2*i+1]);if(a<0||c<0)return GN_CORRUPT;b[i]=(unsigned char)((a<<4)|c);}return gn_frontier_restore((u32)n);}
 return gn_restored_through(cp->completed);
}
static char identity[65],runkey[80];static const char*run_dir;static Buffer safe_payload;static int safe_partial,quiet;
static u64 sequence,checkpoints_written;static double checkpoint_ms=30000,last_checkpoint,started,last_log,progress_ms=5000,prior_elapsed_ms=0;
static int telemetry_failed;
static void telemetry_save(const char *state,const char *progress,double now){
 if(!telemetry_path)return;
 Buffer b={0};
 buf_printf(&b,"{\"schema\":1,\"engine\":\"fomkyr-native\",\"version\":\"%s\",\"pid\":%ld,\"state\":\"%s\",\"updatedUnixSeconds\":%lld,\"budgetBytes\":%" PRIu64 ",\"ordinaryScratchBytes\":%" PRIu64 ",\"rowReserveBytes\":%" PRIu64 ",\"allocatedBytes\":%" PRIu64 ",\"sharedCacheBytes\":%" PRIu64 ",\"sharedCacheUsedBytes\":%" PRIu64 ",\"basisSize\":%" PRIu64 ",\"diskBytes\":%" PRIu64 ",\"checkpointSequence\":%" PRIu64 ",\"checkpointAgeSeconds\":%.3f,\"sessionElapsedSeconds\":%.3f,\"cumulativeElapsedSeconds\":%.3f,\"hilbertAssumed\":%s,\"fkGateEnabled\":%s,\"fkSectorsEnabled\":%s,\"progress\":%s",
 VERSION,(long)getpid(),state,(long long)time(NULL),gn_stat(5),planned_scratch,planned_reserve,gn_stat(4),gn_stat(39),gn_stat(40),gn_stat(0),gn_stat(6),sequence,(now-last_checkpoint)/1000,(now-started)/1000,(prior_elapsed_ms+now-started)/1000,hc.enabled&&hc.assumed?"true":"false",fg_enabled?"true":"false",fg_enabled&&fg_sectors?"true":"false",progress?progress:"null");
 buf_printf(&b,",\"currentDegree\":%" PRIu64 ",\"completedThroughDegree\":%" PRIu64 ",\"workers\":%" PRIu64 ",\"largeRowWorkspaces\":%" PRIu64 ",\"activeLargeRowWorkspaces\":%" PRIu64,gn_stat(3),gn_stat(2),gn_stat(10),gn_reserve_pool_stat(0),gn_reserve_pool_stat(4));
 if(fg_enabled){u64 deficit=(u64)gn_fg_limb(2,0)|((u64)gn_fg_limb(2,1)<<32);buf_printf(&b,",\"fkGate\":{\"degree\":%" PRIu64 ",\"closedSectors\":%" PRIu64 ",\"totalSectors\":360,\"deficit\":%" PRIu64 ",\"sectorSkips\":%" PRIu64 "}",gn_fg_stat(0),gn_fg_stat(20),deficit,gn_fg_stat(8));}
 buf_add(&b,"}\n");
 char *directory=strdup(telemetry_path);if(!directory){buf_free(&b);return;}char *slash=strrchr(directory,'/');const char *name=telemetry_path;
 if(slash){name=telemetry_path+(slash-directory)+1;if(slash==directory)slash[1]=0;else *slash=0;}else strcpy(directory,".");
 int failed=write_atomic(directory,name,b.s,b.n);if(failed&&!telemetry_failed)fprintf(stderr,"Dashboard status write failed: %s (computation continues).\n",telemetry_path);telemetry_failed=failed;free(directory);buf_free(&b);
}
#include "hilbert_reference.h"
static void capture_safe(int partial){
 /* A dimension-closed degree must be finished before publishing its frontier. */
 if(partial && (hc.enabled||fg_enabled) && gn_hilbert_gate_stat(3))return;
 Buffer b={0};buf_printf(&b,"{\"abi\":%d,\"version\":\"%s\",\"identity\":\"%s\",\"basisSize\":%" PRIu64 ",\"terms\":%" PRIu64 ",\"diskBytes\":%" PRIu64 ",\"completedThroughDegree\":%" PRIu64 ",\"currentDegree\":%" PRIu64 ",\"partial\":%s,\"hashBits\":%u,\"runKey\":\"%s\"",(fg_enabled?5:hc.enabled?4:3),VERSION,identity,gn_stat(0),gn_stat(1),gn_stat(6),gn_stat(2),gn_stat(3),partial?"true":"false",gn_frontier_hash_bits(),runkey);
 if(partial){u64 p=gn_frontier_export();u32 n=gn_frontier_size();if(!p){buf_free(&b);return;}unsigned char*t=native_pointer(p);buf_add(&b,",\"frontier\":\"");char hex[2*(40*8+512*16)];const char*digits="0123456789abcdef";for(u32 i=0;i<n;i++){hex[2*i]=digits[t[i]>>4];hex[2*i+1]=digits[t[i]&15];}buf_n(&b,hex,2*n);buf_printf(&b,"\",\"retainedCommittedPairs\":%" PRIu64 ",\"resolvedOverlaps\":%" PRIu64 ",\"totalOverlaps\":%" PRIu64 ",\"pendingPairs\":%u",gn_progress_stat(2),gn_progress_stat(2)+gn_progress_stat(4)+gn_progress_stat(5),gn_progress_stat(0),gn_frontier_pending());}
 closure_metadata(&b);fg_metadata(&b);reference_json(&b);buf_free(&safe_payload);safe_payload=b;safe_partial=partial;
}
static int save_safe(int force){if(!safe_payload.s)return 0;double now=gn_host_clock();if(!force&&!native_checkpoint&&now-last_checkpoint<checkpoint_ms)return 0;Buffer p={0},e={0};buf_n(&p,safe_payload.s,safe_payload.n);buf_printf(&p,",\"sequence\":%" PRIu64 ",\"sessionElapsedMs\":%" PRIu64 ",\"cumulativeElapsedMs\":%" PRIu64 "}",++sequence,(u64)(now-started),(u64)(prior_elapsed_ms+now-started));char hash[65];sha256_hex(p.s,p.n,hash);buf_printf(&e,"{\"schema\":2,\"payload\":%s,\"sha256\":\"%s\"}\n",p.s,hash);char name[64];snprintf(name,sizeof(name),"%s-%u.json",safe_partial?"partial":"checkpoint",safe_partial?(unsigned)(sequence%2):(unsigned)(gn_stat(2)%2));int rc=native_sync()||write_atomic(run_dir,name,e.s,e.n)?GN_IO:0;if(!rc){last_checkpoint=gn_host_clock();native_checkpoint=0;checkpoints_written++;if(!quiet)log_json(stderr,"{\"event\":\"checkpoint\",\"partial\":%s,\"sequence\":%" PRIu64 ",\"file\":\"%s\"}\n",safe_partial?"true":"false",sequence,name);}buf_free(&p);buf_free(&e);return rc;}
static void log_pulse(double now){
 if((quiet&&!telemetry_path)||now-last_log<progress_ms)return;last_log=now;
 u64 steps=0,terms=0,reserve_waits=0;u32 parked=0,active=0,committing=0,slots=(u32)gn_memory_stat(1);
 const char*tiers[]={"unknown","compact-integer","compact-rational","fraction-free","big-rational","reserve-rational","reserve-big-rational"};
 Buffer lanes={0};buf_add(&lanes,"[");
 for(u32 i=0;i<slots;i++){
  u64 rewrites=gn_live_stat(i,0);steps+=rewrites;
  u64 busy=gn_live_stat(i,7);reserve_waits+=gn_live_stat(i,24);if(!busy){if(gn_coop_stat(500+i))parked++;continue;}
  u64 row_terms=gn_live_stat(i,4),tier=gn_live_stat(i,9);if(row_terms>terms)terms=row_terms;
  if(busy==2)committing=1;
  if(active++)buf_add(&lanes,",");
  buf_printf(&lanes,"{\"lane\":%u,\"stage\":\"%s\",\"reductionTier\":\"%s\",\"sampledRewrites\":%" PRIu64 ",\"activeTerms\":%" PRIu64 ",\"exactFallbacks\":%" PRIu64,i,busy==2?"committing":"reducing",tiers[tier<7?tier:0],rewrites,row_terms,gn_live_stat(i,10));
  buf_printf(&lanes,",\"bigRow\":{\"capacity\":%" PRIu64 ",\"reservedCapacity\":%" PRIu64 ",\"peakTerms\":%" PRIu64 ",\"coefficientPoolUsedBytes\":%" PRIu64 ",\"coefficientPoolBytes\":%" PRIu64 ",\"growths\":%" PRIu64 ",\"capacityMisses\":%" PRIu64 ",\"coefficientPoolMisses\":%" PRIu64 ",\"arithmeticWorkspaceMisses\":%" PRIu64 ",\"generalFallbacks\":%" PRIu64 ",\"reserveWaits\":%" PRIu64 "}",gn_live_stat(i,14),gn_live_stat(i,15),gn_live_stat(i,16),gn_live_stat(i,17),gn_live_stat(i,18),gn_live_stat(i,19),gn_live_stat(i,20),gn_live_stat(i,21),gn_live_stat(i,22),gn_live_stat(i,23),gn_live_stat(i,24));
  /* A commit can re-reduce a stored row whose last lane descriptor belongs
   * to another pair. Report the ordered task index in that phase. */
  if(busy==1)buf_printf(&lanes,",\"leftRule\":%" PRIu64 ",\"rightRule\":%" PRIu64 ",\"overlap\":%" PRIu64,gn_live_stat(i,11),gn_live_stat(i,12),gn_live_stat(i,13));
  else {u32 task=commit_task?commit_task:(u32)gn_coop_stat(18);if(task)buf_printf(&lanes,",\"batchTask\":%u",task-1);}
  buf_add(&lanes,"}");
 }
 buf_add(&lanes,"]");
 Buffer progress={0};buf_printf(&progress,"{\"event\":\"progress\",\"phase\":\"%s\",\"degree\":%" PRIu64 ",\"completedThroughDegree\":%" PRIu64 ",\"resolvedOverlaps\":%" PRIu64 ",\"totalOverlaps\":%" PRIu64 ",\"scheduledOverlaps\":%" PRIu64 ",\"committedOverlaps\":%" PRIu64 ",\"sampledRewrites\":%" PRIu64 ",\"maxActiveTerms\":%" PRIu64 ",\"activeLanes\":%u,\"parkedReductions\":%u,\"reserveWaits\":%" PRIu64 ",\"helperStarted\":%" PRIu64 ",\"helperFinished\":%" PRIu64 ",\"helperDeferred\":%" PRIu64 ",\"helperWorkspaceBytes\":%" PRIu64 ",\"largeRowWorkspaces\":%" PRIu64 ",\"activeLargeRowWorkspaces\":%" PRIu64 ",\"largeRowWorkspaceBytes\":%" PRIu64 ",\"largeRowAdmissionDeclines\":%" PRIu64 ",\"workers\":%" PRIu64 ",\"workspaceRetries\":%" PRIu64 ",\"activityApproximate\":true,\"lanes\":%s,\"elapsedSeconds\":%.3f}\n",pool_waiting?"waiting-workers":(commit_task||committing)?"committing":active?"reducing":"preparing",gn_stat(3),gn_stat(2),gn_progress_stat(2)+gn_progress_stat(4)+gn_progress_stat(5),gn_progress_stat(0),gn_progress_stat(3),gn_progress_stat(2),steps,terms,active,parked,reserve_waits,gn_coop_stat(22),gn_coop_stat(23),gn_coop_stat(24),gn_coop_stat(25),gn_reserve_pool_stat(0),gn_reserve_pool_stat(4),gn_reserve_pool_stat(2),gn_reserve_pool_stat(6),gn_stat(10),gn_memory_stat(3),lanes.s,(now-started)/1000);
 if(!quiet)emit_json(stderr,progress.s);telemetry_save("running",progress.s,now);buf_free(&progress);
 buf_free(&lanes);if(!quiet)fg_pulse();
}
static int execute_batch(u32 n,u32*workers){u32 first=0;for(;;){u32 active=*workers<n-first?*workers:n-first;if(!active)active=1;int rc=pool_reduce(active);if(rc)return rc;int pressure=0;for(u32 i=first;i<n;i++){int r=(int)gn_batch_status(i);if(r==GN_SCRATCH||r==GN_BATCH_FULL||r==GN_REPACK)pressure=1;else if(r&&r!=GN_DEFERRED)return r;}
 if(pressure){if(*workers==1)return GN_SCRATCH;u32 after=*workers/2;rc=gn_batch_retry(after,first);if(rc)return rc;*workers=after;if(!quiet)log_json(stderr,"{\"event\":\"memory-adaptation\",\"workers\":%u,\"replayFromTask\":%u}\n",after,first);continue;}
 int retry=0;for(u32 i=first;i<n;i++){commit_task=i+1;rc=gn_batch_commit(i);commit_task=0;if((rc==GN_SCRATCH||rc==GN_BATCH_FULL||rc==GN_REPACK)&&*workers>1){u32 after=*workers/2;rc=gn_batch_retry(after,i);if(rc)return rc;*workers=after;first=i;retry=1;break;}if(rc)return rc;if(hc.enabled||fg_enabled){rc=closure_try();if(rc)return rc;if(gn_hilbert_gate_stat(3))return 0;}if(native_checkpoint||gn_host_clock()-last_checkpoint>=checkpoint_ms){capture_safe(1);rc=save_safe(1);if(rc)return rc;}if(native_stop)return GN_CANCELLED;}
 if(!retry)return 0;}}
static int execute_cooperative(u32*workers,u32 limit){
 for(;;){
  if((hc.enabled||fg_enabled)&&gn_hilbert_gate_stat(3)){gn_coop_discard();return 0;}
  if(native_stop)return GN_CANCELLED;
  int n=gn_coop_fill(limit);if(n<0)return -n;if(!n)return 0;
  capture_safe(1);int rc=save_safe(0);if(rc)return rc;
  rc=pool_reduce(*workers);if(rc)return rc;
  rc=gn_coop_commit();
  if((rc==GN_SCRATCH||rc==GN_BATCH_FULL||rc==GN_REPACK)&&*workers>1){
   u32 after=*workers/2;int rr=gn_coop_retry(after);if(rr)return rr;*workers=after;
   if(!quiet)log_json(stderr,"{\"event\":\"memory-adaptation\",\"workers\":%u,\"replay\":\"uncommitted descriptors only\"}\n",after);
   capture_safe(1);rr=save_safe(0);if(rr)return rr;continue;
  }
  if(rc)return rc;
  if(hc.enabled||fg_enabled){rc=closure_try();if(rc)return rc;if(gn_hilbert_gate_stat(3)){gn_coop_discard();return 0;}}
  capture_safe(1);rc=save_safe(0);if(rc)return rc;
 }
}
static int configure(Fixture*f,u32 target,u32 workers,u64 budget,u64 scratch,u64 reserve,u32 hashbits,u32 prime,int radix){int rc=gn_init(f->nv,target,workers,budget,scratch,hashbits,prime,1);if(rc)return rc;
#define SET(call) do{rc=(call);if(rc)return rc;}while(0)
 SET(gn_memory_policy(1));SET(gn_rational_heap(1));SET(gn_big_rational_heap(1));SET(gn_big_row_limit(big_row_max_terms));SET(gn_growing_rational(1));SET(gn_rational_rewrites(1));SET(gn_radix_queue((u32)radix));SET(gn_reserve_growth(1));SET(gn_pin_cache(shared_cache_bytes==UINT64_MAX?budget/16:shared_cache_bytes));SET(gn_local_rewrites(4,budget/16<8*MIB?budget/16:8*MIB,8));SET(gn_optimize(63,budget/16<64*MIB?budget/16:64*MIB));SET(gn_tune(3,cache_percent,16));SET(gn_word_cache(256));SET(gn_row_reserve(reserve));SET(gn_batch_mode(1));SET(gn_radix_cache(cache_maxima));SET(gn_cooperative(quantum_ms,lookahead));SET(gn_coop_policy(coop_flags,coop_max_window));SET(gn_coop_helper_mode(helper_rows));SET(gn_reserve_pool(large_row_workspaces));SET(fg_host_bind(identity));
#undef SET
 if(quantum_ms&&!gn_coop_stat(0)&&!quiet)fprintf(stderr,"Cooperative scheduler disabled: workspace cannot fit a separate commit arena; using the legacy exact scheduler.\n");
 return 0;}
static void help(void){puts(
"fomkyr 0.7.0 - exact homogeneous noncommutative Groebner bases\n"
"Usage: fomkyr -i input.bg -d 14 -j 8 --workdir fk14 [options]\n"
"  -i, --input FILE           JSON fixture or expanded George vars/polynomial form\n"
"  -d, --degree N             Inclusive degree bound; 0 means no user bound\n"
"  -j, --workers N            Shared-memory native threads (1..32)\n"
"      --workdir DIR         Durable job root; matching jobs resume automatically\n"
"      --resume DIR          Continue this job root (input inferred if saved)\n"
"      --fresh               Explicitly discard this matching algebra's cache\n"
"      --memory auto|SIZE    One ceiling; auto uses OS/cgroup headroom; K/M/G/T binary\n"
"      --scratch SIZE      Ordinary scratch; auto uses 4/7 of the budget\n"
"      --row-reserve SIZE  Each large-row arena; auto uses 1/7\n"
"      --progress-seconds N  Progress interval (default 5)\n"
"      --telemetry FILE    Atomic native dashboard status JSON\n"
"      --scheduler MODE      cooperative (default) or barrier (legacy)\n"
"      --quantum-ms N        Soft exact-row timeslice, default 250 ms\n"
"      --big-row-max-terms N  Big-rational term ceiling: auto/0 (default), or power of two\n"
"      --cache-percent N     Worker record cache share, 0..40 (default 12)\n"
"      --shared-cache SIZE   Pinned immutable records: auto (default), 0, or K/M/G/T\n"
"      --lookahead N         Initial pending window, default 128 (max 512)\n"
"      --max-lookahead N     Elastic window ceiling, default 512\n"
"      --no-elastic-window   Keep the pending window fixed\n"
"      --no-sector-priority  Disable FK component-aware dispatch ordering\n"
"      --no-helper-rows      Disable bounded work during shared-reserve waits\n"
"      --large-row-workspaces N  Maximum exceptional arenas (auto, or 1..33)\n"
"      --fk-gate            Explicitly accept imported FK Gate 0.3 profile and sector skips\n"
"      --fk-total-only      Same profile, total-degree closure without sector skips\n"
"      --fk-gate-memory SIZE  Optional counter budget (default 128M)\n"
"      --no-radix-cache      Disable exact bucket-maximum cache\n"
"      --wasm                Execute the packaged WASM engine via Node (same CLI)\n"
"      --wasm-limit          Keep native execution but impose the 15e9-byte ceiling\n"
"      --checkpoint-seconds N  Save at quiescent frontiers (default 30; 0 every one)\n"
"      --time-limit N        Seconds after initialization; unfinished degree is retained\n"
"      --batch-pairs N       Optional batch size, 1..512 (default 128)\n"
"      --field N             0 = Q; otherwise prime characteristic\n"
"      --hilbert             Export completed-degree Hilbert coefficients\n"
"      --hilbert-certificate FILE  Replay exact integer-dual lower bounds\n"
"      --assume-hilbert FILE  Explicitly trust external dimensions (conditional output)\n"
"      --hilbert-fixed-batch Do not bound speculation near Hilbert equality\n"
"      --export              Stream result.gb after completion\n"
"      --no-radix            Retain the binary-queue ablation\n"
"      --status              Print newest matching durable checkpoint; do not compute\n"
"      --dry-run             Show native memory plan without allocation\n"
"      --human               Readable terminal reports (JSON remains the default)\n"
"      --dump-fixture        Parse input and print canonical fixture JSON\n"
"  -q, --quiet               No progress/checkpoint messages on stderr\n"
"      --version             Print version\n"
"Signals: SIGINT/SIGTERM save a safe frontier; SIGUSR1 requests a checkpoint.\n"
"Active rows are replayed; committed results are not. SIGKILL cannot trigger a save.\n"
"Native execution has no WASM memory cap. OS, cgroup, address-space and per-record\n"
"representation limits still apply; the allocation budget is not process RSS.\n");}
static void wasm_exec(int argc,char**argv){
 char exe[PATH_MAX],actual[PATH_MAX];const char*root=NULL,*workdir="fomkyr-job";char*runner=NULL;
 ssize_t n=readlink("/proc/self/exe",exe,sizeof(exe)-1);
 if(n>0){exe[n]=0;snprintf(actual,sizeof(actual),"%s",exe);setenv("FOMKYR_NATIVE_EXECUTABLE",actual,1);char*p=strrchr(exe,'/');if(p)*p=0;p=strrchr(exe,'/');if(p)*p=0;root=exe;}
 const char*home=getenv("FOMKYR_HOME");if(home)root=home;
 if(root)runner=path_join(root,"native/wasm-cli.mjs");
 if(root&&(!runner||access(runner,R_OK))){free(runner);runner=path_join(root,"share/fomkyr/native/wasm-cli.mjs");}
 if(!home&&root&&(!runner||access(runner,R_OK))){char*p=strrchr(exe,'/');if(p){*p=0;free(runner);runner=path_join(exe,"native/wasm-cli.mjs");}}
 if(!runner||access(runner,R_OK)){free(runner);runner=path_join(FOMKYR_DATADIR,"native/wasm-cli.mjs");}
 if(access(runner,R_OK))die("WASM runner not found; set FOMKYR_HOME to the unpacked fomkyr directory");
 int readonly=0;for(int i=1;i<argc;i++){
  if((!strcmp(argv[i],"--workdir")||!strcmp(argv[i],"--resume"))&&i+1<argc)workdir=argv[++i];
  else if(!strncmp(argv[i],"--workdir=",10))workdir=argv[i]+10;else if(!strncmp(argv[i],"--resume=",9))workdir=argv[i]+9;
  else if(!strcmp(argv[i],"--help")||!strcmp(argv[i],"-h")||!strcmp(argv[i],"--version")||!strcmp(argv[i],"--status")||!strcmp(argv[i],"--dry-run")||!strcmp(argv[i],"--dump-fixture"))readonly=1;
 }
 if(!readonly){if(mkdir_tree(workdir)||lock_job(workdir))die("job is locked or inaccessible");char b[32];snprintf(b,sizeof(b),"%d",job_lock_fd);setenv("FOMKYR_LOCK_FD",b,1);}
 /* Older Node requires this flag; current Node enables memory64 and rejects it. */
 int needs_flag=0;FILE*probe=popen("node --v8-options 2>/dev/null","r");
 if(probe){char line[1024];while(fgets(line,sizeof(line),probe))if(strstr(line,"--experimental-wasm-memory64"))needs_flag=1;pclose(probe);}
 char**args=calloc((size_t)argc+4,sizeof(*args));if(!args)die("allocation failed");int k=0;args[k++]="node";if(needs_flag)args[k++]="--experimental-wasm-memory64";args[k++]=runner;
 for(int i=1;i<argc;i++)if(strcmp(argv[i],"--wasm"))args[k++]=argv[i];args[k]=NULL;
 execvp(args[0],args);perror("node");exit(69);
}
static char*decimal_magnitude(const unsigned char*data,u32 limbs){u32*a=malloc((size_t)limbs*4);if(!a)return NULL;for(u32 i=0;i<limbs;i++)a[i]=rd32(data+4*i);u32*nine=NULL,count=0;while(limbs){u64 rem=0;for(u32 i=limbs;i;i--){u64 v=(rem<<32)|a[i-1];a[i-1]=(u32)(v/1000000000);rem=v%1000000000;}u32*p=realloc(nine,((size_t)count+1)*4);if(!p){free(a);free(nine);return NULL;}nine=p;nine[count++]=(u32)rem;while(limbs&&!a[limbs-1])limbs--;}
 Buffer s={0};if(!count)buf_add(&s,"0");else{buf_printf(&s,"%u",nine[count-1]);for(u32 i=count-1;i;i--)buf_printf(&s,"%09u",nine[i-1]);}free(a);free(nine);return s.s;}
static int export_basis(Fixture*f){char*path=path_join(run_dir,"result.gb");FILE*out=fopen(path,"w");free(path);if(!out)return GN_IO;fprintf(out,"%% fomkyr %s; completed through degree %" PRIu64 "; reduced:false\n",VERSION,gn_stat(2));
 if(hc.enabled)fprintf(out,"%%%% Hilbert closure evidence %s; mode:%s; conditionalOnExternalDimensions:%s\n",hc.key,hc.assumed?"external-assumption":"replayed-integer-duals",hc.assumed?"true":"false");
 if(fg_enabled)fprintf(out,"%%%% FK Gate 0.3 profile %s; conditionalOnImportedFkDimensions:true; proofReplayedHere:false\n",FKG_AUTHORITY_ID);
 for(u32 id=1;id<=gn_stat(0);id++){u64 off=gn_export_rule(id);if(!off){fclose(out);return GN_SCRATCH;}const unsigned char*p=native_pointer(off);u32 n=rd32(p+8),d=rd32(p+12);for(u32 j=0;j<n;j++){const unsigned char*t=p+32+(size_t)j*24;u64 lo=rd64(t),hi=rd64(t+8),c=rd64(t+16);int negative;char*str;char small[64];
  if(c&1){u64 a=c&~UINT64_C(7);u32 limbs=rd32(p+a);negative=!!(c&2);str=decimal_magnitude(p+a+8,limbs);if(!str){fclose(out);return GN_MEMORY;}}
  else{i64 v=((i64)c)>>1;negative=v<0;snprintf(small,sizeof(small),"%" PRIu64,negative?(u64)-v:(u64)v);str=small;}
  if(negative)fputc('-',out);else if(j)fputc('+',out);if(strcmp(str,"1"))fprintf(out,"%s*",str);if(c&1)free(str);
  for(u32 k=0;k<d;k++){u32 letter;if(hi&(UINT64_C(1)<<63))letter=p[lo+k];else{u32 shift=4*(d-1-k);letter=shift>=64?(u32)((hi>>(shift-64))&15):(u32)((lo>>shift)&15);}if(k)fputc('*',out);fputs(f->vars[letter],out);}
 }fputs(",\n",out);}fputs("Done\n",out);int rc=fflush(out)||fsync(fileno(out))||ferror(out)?GN_IO:0;if(fclose(out))rc=GN_IO;return rc;}
static int export_hilbert(u32 degree,u64 budget){u64 left=budget-gn_stat(4);int rc=gn_hilbert(degree,left<256*MIB?left:256*MIB);if(rc)return rc;Buffer b={0};buf_add(&b,"{\"available\":true,\"coefficients\":[");u32 limbs=gn_hilbert_limbs();unsigned char*p=malloc((size_t)limbs*4);if(!p)return GN_MEMORY;for(u32 d=0;d<=degree;d++){for(u32 i=0;i<limbs;i++){u32 v=gn_hilbert_limb(d,i);for(u32 k=0;k<4;k++)p[4*i+k]=(unsigned char)(v>>(8*k));}char*s=decimal_magnitude(p,limbs);if(!s){free(p);buf_free(&b);return GN_MEMORY;}if(d)buf_add(&b,",");buf_string(&b,s);free(s);}free(p);buf_printf(&b,"],\"certifiedThroughDegree\":%u,\"modulus\":%u}",degree,gn_modulus());if(hc.enabled){b.n--;b.s[b.n]=0;closure_metadata(&b);buf_add(&b,"}");}if(fg_enabled){b.n--;b.s[b.n]=0;fg_metadata(&b);buf_add(&b,"}");}rc=write_atomic(run_dir,"hilbert.json",b.s,b.n)?GN_IO:0;buf_free(&b);return rc;}
int main(int argc,char**argv){
 {const u32 endian=1;if(*(const unsigned char*)&endian!=1)die("This release requires a little-endian native host for ABI-3 records");}
 for(int i=1;i<argc;i++)if(!strcmp(argv[i],"--wasm"))wasm_exec(argc,argv);
 const char*input=NULL,*workdir="fomkyr-job",*mem="auto",*hilbert_file=NULL;int hilbert_assumed=0;u32 target=20,workers=native_cpus(),prime=0,batch=128,hashbits=18;int fresh=0,status=0,dry=0,dump=0,wasmlimit=0,hilbert=0,export=0,radix=1,prime_set=0,resume_requested=0;double time_limit=0;
 static const struct option opts[]={{"input",1,0,'i'},{"degree",1,0,'d'},{"workers",1,0,'j'},{"workdir",1,0,1000},{"resume",1,0,1001},{"fresh",0,0,1002},{"memory",1,0,1003},{"wasm-limit",0,0,1004},{"checkpoint-seconds",1,0,1005},{"time-limit",1,0,1006},{"batch-pairs",1,0,1007},{"field",1,0,1008},{"hilbert",0,0,1009},{"export",0,0,1010},{"no-radix",0,0,1011},{"status",0,0,1012},{"dry-run",0,0,1013},{"dump-fixture",0,0,1014},{"version",0,0,1015},{"hilbert-certificate",1,0,1016},{"assume-hilbert",1,0,1017},{"hilbert-fixed-batch",0,0,1018},{"scheduler",1,0,1019},{"quantum-ms",1,0,1020},{"lookahead",1,0,1021},{"no-radix-cache",0,0,1022},{"fk-gate",0,0,1023},{"fk-total-only",0,0,1024},{"fk-gate-memory",1,0,1025},{"human",0,0,1026},{"big-row-max-terms",1,0,1027},{"cache-percent",1,0,1028},{"shared-cache",1,0,1029},{"max-lookahead",1,0,1030},{"no-elastic-window",0,0,1031},{"no-sector-priority",0,0,1032},{"no-helper-rows",0,0,1033},{"large-row-workspaces",1,0,1034},{"scratch",1,0,1035},{"row-reserve",1,0,1036},{"progress-seconds",1,0,1037},{"telemetry",1,0,1038},{"quiet",0,0,'q'},{"help",0,0,'h'},{0,0,0,0}};
 int ch;while((ch=getopt_long(argc,argv,"i:d:j:qh",opts,NULL))!=-1){u64 n;switch(ch){case'i':input=optarg;break;case'd':n=parse_u64(optarg);if(n>GN_INDEX_MAX)die("degree index exceeds uint32 representation");target=(u32)n;break;case'j':n=parse_u64(optarg);if(!n||n>32)die("workers must be 1..32");workers=(u32)n;break;case'q':quiet=1;break;case'h':help();return 0;case 1000:workdir=optarg;break;case 1001:workdir=optarg;resume_requested=1;break;case 1002:fresh=1;break;case 1003:mem=optarg;break;case 1004:wasmlimit=1;break;case 1005:checkpoint_ms=parse_seconds(optarg)*1000;break;case 1006:time_limit=parse_seconds(optarg);break;case 1007:n=parse_u64(optarg);if(!n||n>512)die("batch-pairs must be 1..512");batch=(u32)n;break;case 1008:n=parse_u64(optarg);if(n>2147483647)die("characteristic too large");prime=(u32)n;prime_set=1;break;case 1009:hilbert=1;break;case 1010:export=1;break;case 1011:radix=0;break;case 1012:status=1;break;case 1013:dry=1;break;case 1014:dump=1;break;case 1015:puts(VERSION);return 0;case 1016:case 1017:if(hilbert_file)die("choose only one Hilbert authority");hilbert_file=optarg;hilbert_assumed=ch==1017;break;case 1018:closure_adaptive=0;break;
 case 1019:if(!strcmp(optarg,"barrier"))quantum_ms=0;else if(!strcmp(optarg,"cooperative")){if(!quantum_ms)quantum_ms=250;}else die("scheduler must be cooperative or barrier");break;
 case 1020:n=parse_u64(optarg);if(n<1||n>10000)die("quantum-ms must be 1..10000");quantum_ms=(u32)n;break;
 case 1021:n=parse_u64(optarg);if(!n||n>512)die("lookahead must be 1..512");lookahead=(u32)n;break;
 case 1022:cache_maxima=0;break;case 1023:fg_requested=1;fg_sectors=1;break;case 1024:fg_requested=1;fg_sectors=0;break;case 1025:fg_budget=parse_bytes(optarg);break;case 1026:human_output=1;break;case 1027:n=!strcmp(optarg,"auto")?0:parse_u64(optarg);if(n&&(n<128||n>(1u<<30)||(n&(n-1))))die("big-row-max-terms must be auto, 0, or a power of two from 128 to 1073741824");big_row_max_terms=(u32)n;break;case 1028:n=parse_u64(optarg);if(n>40)die("cache-percent must be 0..40");cache_percent=(u32)n;break;case 1029:shared_cache_bytes=!strcmp(optarg,"auto")?UINT64_MAX:parse_bytes(optarg);break;case 1030:n=parse_u64(optarg);if(!n||n>512)die("max-lookahead must be 1..512");coop_max_window=(u32)n;break;case 1031:coop_flags&=~1u;break;case 1032:coop_flags&=~2u;break;case 1033:helper_rows=0;break;case 1034:n=!strcmp(optarg,"auto")?0:parse_u64(optarg);if(n>33)die("large-row-workspaces must be auto, 0, or 1..33");large_row_workspaces=(u32)n;break;case 1035:scratch_arg=optarg;break;case 1036:reserve_arg=optarg;break;case 1037:progress_ms=parse_seconds(optarg)*1000;if(progress_ms<100)die("progress-seconds must be at least 0.1");break;case 1038:telemetry_path=optarg;if(!*telemetry_path||telemetry_path[strlen(telemetry_path)-1]=='/')die("telemetry must name a file");break;default:help();return 2;}}
 if((coop_flags&1)&&coop_max_window<lookahead)die("max-lookahead must be at least lookahead");
 if(optind<argc){if(input||optind+1!=argc)die("unexpected arguments");input=argv[optind];}
 char*saved_identity=NULL;char*jobpath=path_join(workdir,"job.json");char*jobtext=read_file(jobpath,65536,NULL);free(jobpath);
 if(jobtext&&(resume_requested||!input)){Json j={0};if(!json_parse(&j,jobtext)){int ok=1;u64 v=json_u64(&j,json_key(&j,0,"modulus"),&ok);if(!ok||v>2147483647)die("invalid saved job characteristic");if(!prime_set)prime=(u32)v;saved_identity=json_string(&j,json_key(&j,0,"identity"));}else die("invalid saved job metadata");json_free(&j);}free(jobtext);
 char*inferred=NULL;if(!input){inferred=path_join(workdir,"fixture.json");input=inferred;}
 Fixture fixture;char error[512];if(fixture_read(&fixture,input,error,sizeof(error)))die(error);free(inferred);
 if(dump){puts(fixture.canonical);fixture_free(&fixture);return 0;}fixture_identity(&fixture,prime,identity);if(resume_requested&&saved_identity&&strcmp(saved_identity,identity))die("resume input/field differs from the saved job; use a separate workdir for a different algebra");free(saved_identity);snprintf(runkey,sizeof(runkey),"alg-%s",identity);closure_load(hilbert_file,hilbert_assumed,&fixture,prime);fg_enabled=fg_requested&&!prime&&fixture.nv==15&&!strcmp(identity,"17c5a3b13bbae1fd6e03ece75139f297d437bda2ae062b093d77a92f091b88bf");if(fg_requested&&!fg_enabled&&!quiet)fprintf(stderr,"FK Gate unavailable for this identity/field; ordinary exact completion retained.\n");
 u64 available=native_available(),budget=!strcmp(mem,"auto")?(available/5*4)&~(PAGE-1):parse_bytes(mem)&~(PAGE-1);
 if(wasmlimit&&budget>GN_WASM_HARD_BYTES)budget=GN_WASM_HARD_BYTES&~(PAGE-1);
 if(budget<16*MIB||budget>GN_HARD_BYTES)die("memory ceiling must be >=16 MiB and fit native address representation");
 if(shared_cache_bytes!=UINT64_MAX&&shared_cache_bytes>budget)die("shared-cache must fit inside the memory ceiling");
 u64 scratch=(!strcmp(scratch_arg,"auto")?budget/7*4:parse_bytes(scratch_arg))&~(PAGE-1);
 u64 reserve=(!strcmp(reserve_arg,"auto")?(budget>=128*MIB?budget/7:0):parse_bytes(reserve_arg))&~(PAGE-1);
 if(scratch<MIB||scratch>=budget||reserve>budget-scratch||budget-scratch-reserve<MIB)die("scratch and row-reserve must fit within memory with metadata headroom");
 planned_scratch=scratch;planned_reserve=reserve;
 while(workers>1&&scratch/workers<MIB)workers/=2;
 if(dry){log_json(stdout,"{\"engine\":\"native\",\"wasmLimit\":%s,\"budgetBytes\":%" PRIu64 ",\"ordinaryScratchBytes\":%" PRIu64 ",\"rowReserveBytes\":%" PRIu64 ",\"availableHintBytes\":%" PRIu64 ",\"workers\":%u,\"identity\":\"%s\"}\n",wasmlimit?"true":"false",budget,scratch,reserve,available,workers,identity);fixture_free(&fixture);return 0;}
 if(!status){if(mkdir_tree(workdir))die("cannot create job directory");if(lock_job(workdir))die("job is locked by another process (or lock is unreadable)");}
 char*store=path_join(workdir,"fomkyr"),*dir=path_join(store,runkey);free(store);run_dir=dir;u64 filebytes=0;char*basis=path_join(dir,"basis.gnb");
 if(status){struct stat st;if(!stat(basis,&st))filebytes=(u64)st.st_size;}else{if(mkdir_tree(dir))die("cannot create algebra directory");if(!native_open(budget,basis)){perror("native mmap/open");return 71;}filebytes=native_size();}free(basis);
 const char*names[]={"checkpoint-0.json","checkpoint-1.json","partial-0.json","partial-1.json"};Checkpoint cps[4]={{0}};u32 count=0;int preserve_newer_partial=0;
 if(!fresh)for(u32 i=0;i<4;i++){Checkpoint c={0};if(cp_read(&c,dir,names[i],identity,filebytes)){if(!status&&target&&c.partial&&target<=c.completed){preserve_newer_partial=1;cp_free(&c);continue;}cps[count++]=c;}}
 if(fg_dependency_error&&!fresh)die("checkpoint depends on FK Gate profile; explicitly supply --fk-gate or --fk-total-only (data retained)");
 if(closure_dependency_error&&!fresh)die("checkpoint depends on Hilbert evidence; explicitly supply the SAME policy file/mode (data retained)");
 for(u32 i=0;i<count;i++)for(u32 j=i+1;j<count;j++)if(cp_better(&cps[j],&cps[i])){Checkpoint t=cps[i];cps[i]=cps[j];cps[j]=t;}
 if(status){if(count)emit_json(stdout,cps[0].payload.s);else emit_json(stdout,"{\"checkpoint\":null}");for(u32 i=0;i<count;i++)cp_free(&cps[i]);native_close();fixture_free(&fixture);free(dir);return count?0:66;}
 if(fresh){if(native_truncate(0))die("cannot truncate explicitly reset job");for(u32 i=0;i<4;i++){char*p=path_join(dir,names[i]);unlink(p);free(p);}}
 else if(!count&&native_size())die("no valid matching checkpoint; data retained. Use --fresh only to discard it");
 if(write_atomic(workdir,"fixture.json",fixture.canonical,strlen(fixture.canonical)))die("cannot save input fixture");
 Buffer job={0};buf_printf(&job,"{\"schema\":1,\"version\":\"%s\",\"identity\":\"%s\",\"modulus\":%u,\"input\":\"fixture.json\"}",VERSION,identity,prime);if(write_atomic(workdir,"job.json",job.s,job.n))die("cannot save job metadata");buf_free(&job);
 struct sigaction sa;memset(&sa,0,sizeof(sa));sa.sa_handler=signal_handler;sigemptyset(&sa.sa_mask);sigaction(SIGINT,&sa,NULL);sigaction(SIGTERM,&sa,NULL);sigaction(SIGUSR1,&sa,NULL);
 started=gn_host_clock();last_checkpoint=last_log=started;u32 initial_workers=workers;int rc=0;u32 restored=0,resumed_pending=0;int restored_partial=0;
 if(count){rc=GN_CORRUPT;for(u32 i=0;i<count;i++){workers=initial_workers;u32 kt=target;if(kt&&kt<cps[i].completed)kt=cps[i].completed;if(kt&&kt<cps[i].current)kt=cps[i].current;
   rc=configure(&fixture,kt,workers,budget,scratch,reserve,cps[i].partial?cps[i].hash_bits:hashbits,prime,radix);if(!rc)rc=restore_cp(&cps[i],&workers);
   if(!rc){if(hc.enabled){Json q={0};if(!json_parse(&q,cps[i].payload.s)){int ev=json_key(&q,0,"hilbertClosureEvents");if(ev>=0&&q.t[ev].type=='['&&q.t[ev].end-q.t[ev].start>2)buf_n(&hc.events,q.text+q.t[ev].start+1,(size_t)(q.t[ev].end-q.t[ev].start-2));}json_free(&q);}restored=cps[i].completed;restored_partial=cps[i].partial;resumed_pending=gn_frontier_pending();sequence=cps[i].sequence;prior_elapsed_ms=cps[i].elapsed_ms;if(!preserve_newer_partial)if(native_truncate(cps[i].bytes))rc=GN_IO;break;}
   fprintf(stderr,"Rejected checkpoint: %s\n",ename(rc));
  }}else rc=configure(&fixture,target,workers,budget,scratch,reserve,hashbits,prime,radix);
 for(u32 i=0;i<count;i++)cp_free(&cps[i]);if(rc){fprintf(stderr,"Initialization: %s\n",ename(rc));native_close();return 70;}
 if(!quiet)log_json(stderr,"{\"event\":\"start\",\"engine\":\"native\",\"version\":\"%s\",\"budgetBytes\":%" PRIu64 ",\"ordinaryScratchBytes\":%" PRIu64 ",\"rowReserveBytes\":%" PRIu64 ",\"workers\":%u,\"resumedFromDegree\":%u,\"resumedPartial\":%s,\"pendingPairs\":%u}\n",VERSION,budget,scratch,reserve,workers,restored,restored_partial?"true":"false",resumed_pending);
 rc=closure_verify(&fixture,budget);if(rc){fprintf(stderr,"Hilbert certificate rejected: %s\n",ename(rc));native_close();return 65;}if(hc.enabled&&write_atomic(run_dir,"hilbert-evidence.json",hc.text,strlen(hc.text)))die("could not persist Hilbert evidence");
 telemetry_save("starting",NULL,gn_host_clock());native_set_pulse(log_pulse);int pe=pool_open(workers);if(pe){fprintf(stderr,"pthread_create: %s\n",strerror(pe));pool_close();native_close();return 71;}
 if(time_limit)gn_deadline(gn_host_clock()+time_limit*1000);
 u32 bound=target?target:GN_INDEX_MAX;
 for(u32 d=(u32)gn_stat(2)+1;d<=bound;d++){
  if(!target&&gn_stat(2)>=fixture.max_degree&&gn_stat(2)>=gn_completion_bound())break;
  if(native_stop){rc=GN_CANCELLED;break;}
  if(!gn_stat(3)){rc=fixture_load_degree(&fixture,d);if(!rc)rc=gn_start_degree(d);if(rc)break;}
  reference_begin(budget);rc=closure_begin(budget);if(!rc)rc=closure_try();if(rc)break;capture_safe(1);rc=save_safe(0);if(rc)break;
  if((hc.enabled||fg_enabled)&&gn_hilbert_gate_stat(3))resumed_pending=0;
  if(resumed_pending&&!gn_hilbert_gate_stat(3)&&!gn_coop_stat(0)){rc=execute_batch(resumed_pending,&workers);resumed_pending=0;if(rc)break;}
  if(gn_coop_stat(0)){resumed_pending=0;rc=execute_cooperative(&workers,lookahead);}
  else for(;!gn_hilbert_gate_stat(3);){capture_safe(1);rc=save_safe(0);if(rc)break;int n=gn_batch_fill(closure_batch_limit(batch,workers));if(n<0){rc=-n;break;}if(!n)break;
   capture_safe(1);rc=save_safe(0);if(rc)break;rc=execute_batch((u32)n,&workers);if(rc)break;
  }if(rc)break;if(fg_enabled&&gn_fg_status()==FKG_ACTIVE){rc=GN_REJECTED;break;}rc=gn_finish_degree();if(rc)break;capture_safe(0);rc=save_safe(1);if(rc)break;
 }
 if(rc){if(gn_coop_stat(0)){gn_coop_discard();capture_safe(1);}int saved=save_safe(1);if(saved)fprintf(stderr,"Checkpoint save failed: %s (previous durable checkpoint retained)\n",ename(saved));}
 else {gn_deadline(0);native_set_pulse(NULL);if(hilbert)rc=export_hilbert(target?target:(u32)gn_stat(2),budget);if(!rc&&export)rc=export_basis(&fixture);}
 last_log=0;log_pulse(gn_host_clock());telemetry_save(rc?"stopped":"complete",NULL,gn_host_clock());
 double elapsed=(gn_host_clock()-started)/1000;native_set_pulse(NULL);pool_close();struct rusage usage;getrusage(RUSAGE_SELF,&usage);u64 rss=(u64)usage.ru_maxrss;
#ifndef __APPLE__
 rss*=1024;
#endif
 Buffer result={0};buf_printf(&result,"{\"engine\":\"fomkyr-native\",\"version\":\"%s\",\"complete\":%s,\"code\":\"%s\",\"completedThroughDegree\":%" PRIu64 ",\"currentDegree\":%" PRIu64 ",\"basisSize\":%" PRIu64 ",\"terms\":%" PRIu64 ",\"diskBytes\":%" PRIu64 ",\"allocatedBytes\":%" PRIu64 ",\"budgetBytes\":%" PRIu64 ",\"peakRSSBytes\":%" PRIu64 ",\"workers\":%u,\"resumedFromDegree\":%u,\"resumedPartial\":%s,\"resolvedOverlaps\":%" PRIu64 ",\"totalOverlaps\":%" PRIu64 ",\"checkpointsWritten\":%" PRIu64 ",\"elapsedSeconds\":%.6f,\"identity\":\"%s\",\"recordABI\":3,\"independentGroebnerCertificate\":false}",VERSION,rc?"false":"true",ename(rc),gn_stat(2),gn_stat(3),gn_stat(0),gn_stat(1),gn_stat(6),gn_stat(4),budget,rss,workers,restored,restored_partial?"true":"false",gn_progress_stat(2)+gn_progress_stat(4)+gn_progress_stat(5),gn_progress_stat(0),checkpoints_written,elapsed,identity);if(hc.enabled){result.n--;result.s[result.n]=0;closure_metadata(&result);buf_add(&result,"}");}
 result.n--;result.s[result.n]=0;fg_metadata(&result);
 buf_printf(&result,",\"cooperative\":{\"quantumMs\":%" PRIu64 ",\"epochs\":%" PRIu64 ",\"started\":%" PRIu64 ",\"finished\":%" PRIu64 ",\"committed\":%" PRIu64 ",\"nonprefixCommits\":%" PRIu64 ",\"capacityReplayPairs\":%" PRIu64 ",\"pending\":%" PRIu64 ",\"commitRewrites\":%" PRIu64 ",\"lanes\":[",gn_coop_stat(0),gn_coop_stat(1),gn_coop_stat(2),gn_coop_stat(3),gn_coop_stat(4),gn_coop_stat(5),gn_coop_stat(6),gn_coop_stat(7),gn_coop_stat(8));
 for(u32 i=0;i<gn_memory_stat(1);i++)buf_printf(&result,"%s{\"activeMicroseconds\":%" PRIu64 ",\"maxSliceMicroseconds\":%" PRIu64 ",\"yields\":%" PRIu64 ",\"resumes\":%" PRIu64 "}",i?",":"",gn_coop_stat(100+i),gn_coop_stat(200+i),gn_coop_stat(300+i),gn_coop_stat(400+i));
 buf_printf(&result,"],\"window\":%" PRIu64 ",\"windowExpansions\":%" PRIu64 ",\"sectorOrderings\":%" PRIu64 ",\"policyFlags\":%" PRIu64 ",\"parkedCommit\":%" PRIu64 ",\"commitYields\":%" PRIu64 ",\"commitResumes\":%" PRIu64 ",\"preparedCommitSlices\":%" PRIu64 ",\"helperStarted\":%" PRIu64 ",\"helperFinished\":%" PRIu64 ",\"helperDeferred\":%" PRIu64 ",\"helperWorkspaceBytes\":%" PRIu64 ",\"helpersEnabled\":%s}",gn_coop_stat(13),gn_coop_stat(14),gn_coop_stat(15),gn_coop_stat(16),gn_coop_stat(18),gn_coop_stat(19),gn_coop_stat(20),gn_coop_stat(21),gn_coop_stat(22),gn_coop_stat(23),gn_coop_stat(24),gn_coop_stat(25),gn_coop_stat(26)?"true":"false");
 buf_printf(&result,",\"largeRowPool\":{\"workspaces\":%" PRIu64 ",\"limit\":%" PRIu64 ",\"workspaceBytes\":%" PRIu64 ",\"active\":%" PRIu64 ",\"admissions\":%" PRIu64 ",\"declines\":%" PRIu64 "}",gn_reserve_pool_stat(0),gn_reserve_pool_stat(1),gn_reserve_pool_stat(2),gn_reserve_pool_stat(4),gn_reserve_pool_stat(5),gn_reserve_pool_stat(6));
 buf_printf(&result,",\"cachePercent\":%u,\"sharedCacheBytes\":%" PRIu64 ",\"bigRowMaxTerms\":%u,\"bigRows\":[",cache_percent,shared_cache_bytes==UINT64_MAX?budget/16:shared_cache_bytes,big_row_max_terms);
 for(u32 i=0;i<gn_memory_stat(1);i++)buf_printf(&result,"%s{\"growths\":%" PRIu64 ",\"peakTerms\":%" PRIu64 ",\"lastCapacity\":%" PRIu64 ",\"reservedCapacity\":%" PRIu64 ",\"capacityMisses\":%" PRIu64 ",\"coefficientPoolMisses\":%" PRIu64 ",\"arithmeticWorkspaceMisses\":%" PRIu64 ",\"generalFallbacks\":%" PRIu64 ",\"reserveWaits\":%" PRIu64 "}",i?",":"",gn_exact_stat(i,12),gn_exact_stat(i,13),gn_exact_stat(i,14),gn_exact_stat(i,15),gn_exact_stat(i,6),gn_exact_stat(i,5),gn_exact_stat(i,7),gn_exact_stat(i,20),gn_exact_stat(i,19));
 buf_add(&result,"]}");
 emit_json(stdout,result.s);if(human_output){printf("Job directory: %s\n",workdir);if(!rc&&export)printf("Basis file: %s/result.gb\n",dir);if(!rc&&hilbert)printf("Hilbert coefficients: %s/hilbert.json\n",dir);}if(write_atomic(dir,"native-result.json",result.s,result.n))fprintf(stderr,"Could not save result metadata: %s\n",strerror(errno));buf_free(&result);buf_free(&safe_payload);native_close();fixture_free(&fixture);free(dir);unlock_job();
 if(!rc)return 0;if(rc==GN_CANCELLED)return native_stop?128+native_stop:124;return rc==GN_MEMORY||rc==GN_SCRATCH?75:70;
}
