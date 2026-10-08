/* SPDX-License-Identifier: MIT. Terminal formatting; persisted records stay JSON. */
#ifndef FOMKYR_HUMAN_H
#define FOMKYR_HUMAN_H
#include <stdarg.h>

static int human_output;

static const char *human_phase(const char *phase) {
 if(!phase)return "Computing";
 if(!strcmp(phase,"waiting-workers"))return "Waiting for workers";
 if(!strcmp(phase,"committing"))return "Committing results";
 if(!strcmp(phase,"reducing"))return "Reducing pairs";
 if(!strcmp(phase,"preparing"))return "Preparing work";
 return phase;
}

static int human_number(Json *j, int object, const char *key, u64 *value) {
 int ok=1;*value=json_u64(j,json_key(j,object,key),&ok);return ok;
}
static int human_flag(Json *j, const char *key) {
 char *s=json_string(j,json_key(j,0,key));int yes=s&&!strcmp(s,"true");free(s);return yes;
}
static void human_size(FILE *out, const char *label, u64 bytes) {
 const u64 gib=UINT64_C(1073741824),mib=UINT64_C(1048576);
 fprintf(out,"%s: %.2f %s\n",label,(double)bytes/(bytes>=gib?gib:mib),bytes>=gib?"GiB":"MiB");
}
static void human_memory(FILE *out, Json *j) {
 const char *keys[]={"budgetBytes","ordinaryScratchBytes","rowReserveBytes","allocatedBytes","peakRSSBytes"};
 const char *labels[]={"Memory allowance","Reduction workspace","Shared row reserve","Allocated capacity","Peak physical RAM"};
 for(unsigned i=0;i<sizeof(keys)/sizeof(*keys);i++){u64 value;if(human_number(j,0,keys[i],&value))human_size(out,labels[i],value);}
}
static void human_time(FILE *out, Json *j) {
 const char *keys[]={"elapsedSeconds","elapsedMs","cumulativeElapsedMs"};
 for(unsigned i=0;i<sizeof(keys)/sizeof(*keys);i++){
  char *s=json_string(j,json_key(j,0,keys[i]));if(!s)continue;
  char *end;double value=strtod(s,&end);int valid=end!=s&&!*end;free(s);
  if(valid){fprintf(out,"Elapsed: %.3f s\n",i?value/1000.0:value);return;}
 }
}
static void emit_json(FILE *out, const char *payload) {
 if(!human_output){fprintf(out,"%s\n",payload);return;}
 Json j={0};if(json_parse(&j,(char*)payload)){json_free(&j);fputs("Status formatting failed.\n",out);return;}
 char *event=json_string(&j,json_key(&j,0,"event"));u64 degree=0,completed=0,rules=0,workers=0;
 human_number(&j,0,"currentDegree",&degree);human_number(&j,0,"completedThroughDegree",&completed);
 human_number(&j,0,"basisSize",&rules);human_number(&j,0,"workers",&workers);
 if(event&&!strcmp(event,"progress")){
  u64 resolved=0,total=0;human_number(&j,0,"degree",&degree);
  human_number(&j,0,"resolvedOverlaps",&resolved);human_number(&j,0,"totalOverlaps",&total);
  fprintf(out,"Degree %" PRIu64 ": %" PRIu64 " / %" PRIu64 " overlaps; %" PRIu64 " workers. ",degree,resolved,total,workers);
  human_time(out,&j);
  u64 active=0,rewrites=0,terms=0;
  if(human_number(&j,0,"activeLanes",&active)){
   human_number(&j,0,"sampledRewrites",&rewrites);human_number(&j,0,"maxActiveTerms",&terms);
   char *phase=json_string(&j,json_key(&j,0,"phase"));
   fprintf(out,"  %s; %" PRIu64 " active reductions; %" PRIu64 " sampled rewrites; largest active row: %" PRIu64 " terms.\n",human_phase(phase),active,rewrites,terms);free(phase);
   u64 parked=0,waits=0;human_number(&j,0,"parkedReductions",&parked);human_number(&j,0,"reserveWaits",&waits);
   if(parked||waits)fprintf(out,"  Parked reductions: %" PRIu64 "; reserve wait attempts: %" PRIu64 ".\n",parked,waits);
   u64 helpers=0,deferred=0;human_number(&j,0,"helperFinished",&helpers);human_number(&j,0,"helperDeferred",&deferred);
   if(helpers||deferred)fprintf(out,"  Helper pairs completed: %" PRIu64 "; deferred to full workspaces: %" PRIu64 ".\n",helpers,deferred);
   u64 arenas=0,leased=0,poolbytes=0;
   if(human_number(&j,0,"largeRowWorkspaces",&arenas)){human_number(&j,0,"activeLargeRowWorkspaces",&leased);human_number(&j,0,"largeRowWorkspaceBytes",&poolbytes);fprintf(out,"  Large-row workspaces: %" PRIu64 " active / %" PRIu64 "; total allowance %.2f GiB.\n",leased,arenas,(double)poolbytes/1073741824.0);}
   int array=json_key(&j,0,"lanes");
   if(array>=0)for(int i=array+1;i<j.n&&j.t[i].start<j.t[array].end;){
    int entry=i;u64 lane=0,left=0,right=0,overlap=0,task=0;
    char *tier=json_string(&j,json_key(&j,entry,"reductionTier"));
    if(human_number(&j,entry,"lane",&lane)){
     fprintf(out,"    Lane %" PRIu64 ": %s",lane,tier?tier:"unknown tier");
     if(human_number(&j,entry,"leftRule",&left)&&human_number(&j,entry,"rightRule",&right)&&human_number(&j,entry,"overlap",&overlap))
      fprintf(out,"; pair %" PRIu64 "/%" PRIu64 ", overlap %" PRIu64,left,right,overlap);
     else if(human_number(&j,entry,"batchTask",&task))fprintf(out,"; commit task %" PRIu64,task);
     int row=json_key(&j,entry,"bigRow");u64 cap=0,growths=0,misses=0;
     if(row>=0&&human_number(&j,row,"capacity",&cap)&&cap){human_number(&j,row,"growths",&growths);human_number(&j,row,"capacityMisses",&misses);fprintf(out,"; table capacity %" PRIu64 ", growths %" PRIu64 ", capacity misses %" PRIu64,cap,growths,misses);}
     fputs(".\n",out);
    }
    free(tier);int end=j.t[entry].end;i++;while(i<j.n&&j.t[i].start<end)i++;
   }
  }
 }else if(event&&!strcmp(event,"pair-plan-reordered")){
  u64 order=0,retained=0,remaining=0;human_number(&j,0,"order",&order);human_number(&j,0,"retainedCommittedPairs",&retained);human_number(&j,0,"remainingCandidates",&remaining);
  fprintf(out,"Reordered unfinished pairs: order %" PRIu64 "; retained committed pairs %" PRIu64 "; remaining candidates %" PRIu64 ".\n",order,retained,remaining);
 }else if(event&&!strcmp(event,"pair-plan-adopted")){
  u64 kept=0,candidates=0;human_number(&j,0,"retainedCommittedPairs",&kept);human_number(&j,0,"plannedCandidates",&candidates);
  fprintf(out,"Whole-degree pair plan adopted: %" PRIu64 " committed pairs retained; %" PRIu64 " remaining candidates.\n",kept,candidates);
 }else if(event&&!strcmp(event,"checkpoint")){
  char *file=json_string(&j,json_key(&j,0,"file"));
  fprintf(out,"Checkpoint saved: %s.\n",file?file:"safe frontier");free(file);
 }else if(event&&!strcmp(event,"memory-adaptation")){
  u64 first=0;human_number(&j,0,"replayFromTask",&first);
  fprintf(out,"Workspace pressure: using %" PRIu64 " workers; retrying pending work from task %" PRIu64 ".\n",workers,first);
 }else if(event&&!strcmp(event,"hilbert-degree-closure")){
  int details=json_key(&j,0,"details");human_number(&j,details,"degree",&degree);
  char *evidence=json_string(&j,json_key(&j,0,"evidence"));
  fprintf(out,"Hilbert closure at degree %" PRIu64 " (%s).\n",degree,evidence?evidence:"evidence");free(evidence);
 }else if(event&&!strcmp(event,"fk-gate-degree-closure")){
  human_number(&j,0,"degree",&degree);fprintf(out,"FK6 imported-profile closure at degree %" PRIu64 ".\n",degree);
 }else if(event&&!strcmp(event,"fk-gate-progress")){
  u64 deficit=0,closed=0;human_number(&j,0,"degree",&degree);human_number(&j,0,"deficit",&deficit);human_number(&j,0,"closedSectors",&closed);
  fprintf(out,"FK6 degree %" PRIu64 ": %" PRIu64 " closed components; dimension deficit %" PRIu64 ".\n",degree,closed,deficit);
 }else if(event&&!strcmp(event,"start")){
  char *version=json_string(&j,json_key(&j,0,"version"));
  fprintf(out,"Fomkyr %s — native C; %" PRIu64 " workers.\n",version?version:"",workers);free(version);
  human_memory(out,&j);u64 resumed=0;human_number(&j,0,"resumedFromDegree",&resumed);
  if(resumed||human_flag(&j,"resumedPartial"))fprintf(out,"Resuming checkpoint: completed degree %" PRIu64 "%s.\n",resumed,human_flag(&j,"resumedPartial")?", saved partial frontier":"");
 }else if(json_key(&j,0,"complete")>=0){
  char *code=json_string(&j,json_key(&j,0,"code"));
  if(human_flag(&j,"complete"))fprintf(out,"Completed through degree %" PRIu64 ": %" PRIu64 " polynomials.\n",completed,rules);
  else fprintf(out,"Stopped: %s. Completed through degree %" PRIu64 "; active degree %" PRIu64 ".\n",code?code:"ERROR",completed,degree);
  free(code);u64 terms=0;if(human_number(&j,0,"terms",&terms))fprintf(out,"Terms: %" PRIu64 "; workers: %" PRIu64 ".\n",terms,workers);
  human_time(out,&j);human_memory(out,&j);
 }else if(json_key(&j,0,"checkpoint")>=0){
  fputs("No valid checkpoint found.\n",out);
 }else if(json_key(&j,0,"completedThroughDegree")>=0){
  fprintf(out,"Checkpoint: completed through degree %" PRIu64 "; %" PRIu64 " polynomials.\n",completed,rules);
  if(human_flag(&j,"partial"))fprintf(out,"Saved partial degree: %" PRIu64 ".\n",degree);
  human_time(out,&j);
 }else{
  fprintf(out,"Native memory plan: %" PRIu64 " workers.\n",workers);human_memory(out,&j);
  if(human_flag(&j,"wasmLimit"))fputs("Wasm allowance limit enabled.\n",out);
 }
 int plan=json_key(&j,0,"pairPlan");u64 order=0;
 if(plan>=0&&human_number(&j,plan,"order",&order)&&order){u64 count=0,bytes=0;human_number(&j,plan,"candidates",&count);human_number(&j,plan,"allocatedBytes",&bytes);fprintf(out,"Pair priority: %s; %" PRIu64 " candidates; %.3f MiB plan storage.\n",order==1?"largest overlap first":order==2?"sparser input first":"smallest ambiguity word first",count,(double)bytes/1048576.0);}
 if(human_flag(&j,"conditionalOnExternalDimensions"))fputs("Results are conditional on the supplied external Hilbert dimensions.\n",out);
 if(human_flag(&j,"conditionalOnImportedFkDimensions"))fputs("Results are conditional on the imported FK6 dimensions; external proof package not replayed here.\n",out);
 free(event);json_free(&j);
}
#if defined(__GNUC__) || defined(__clang__)
static void log_json(FILE *out, const char *format, ...) __attribute__((format(printf,2,3)));
#endif
static void log_json(FILE *out, const char *format, ...) {
 va_list args;va_start(args,format);
 if(!human_output){vfprintf(out,format,args);va_end(args);return;}
 va_list copy;va_copy(copy,args);int n=vsnprintf(NULL,0,format,copy);va_end(copy);
 char *text=n>=0?malloc((size_t)n+1):NULL;
 if(text){vsnprintf(text,(size_t)n+1,format,args);emit_json(out,text);free(text);}
 else fputs("Status formatting failed.\n",out);
 va_end(args);
}
#endif
