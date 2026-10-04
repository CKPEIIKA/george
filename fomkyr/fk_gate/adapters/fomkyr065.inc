/* SPDX-License-Identifier: MIT
 * Reference adapter included in the recovered fomkyr 0.6.5 kernel translation
 * unit. The public gate API is COORDINATOR ONLY, at joined-worker barriers.
 * The included fg_sector_pair is the one read-only worker shortcut; it never
 * mutates the basis or the published count snapshot.
 */
static int fg_quiet(void){
 if(S.input_expected||GN_LOAD(&S.batch_running)||GN_LOAD(&S.reserve_lock))return 0;
 for(u32 i=0;i<S.lane_slots;i++)if(S.lanes[i].busy)return 0;
 return 1;
}
#include "sector_counter.inc"
static int fg_upper(u32 d,u64 budget,FkgCount*out){
 int rc=gn_hilbert_upper(d,budget);if(rc){gn_hilbert_release();return rc;}
 *out=fkg_from_u64(0);u32 n=gn_hilbert_limbs();int overflow=0;
 for(u32 i=0;i<n;i++){u32 a=gn_hilbert_limb(d,i);if(i<4)out->limb[i]=a;else overflow|=!!a;}
 gn_hilbert_release();return overflow?GN_LIMIT:0;
}
API int gn_fg_bind(u32 length){
 if(!fg_quiet()||length!=64)return -GN_STATE;
 S.fg_sector_enabled=0;S.fg_sector_ready=0;GN_STORE(&S.fg_sector_skipped,0);S.fg_sector_ms=0;S.fg_sector_peak=0;S.fg_sector_error=0;
 S.fg_closed=0;S.fg_poll_calls=S.fg_skipped=S.fg_recounts=0;S.fg_count_ms=0;
 return fkg_bind(&S.fgate,PTR(char,S.lanes[0].io_base),(u32)S.generators,S.modulus);
}
API int gn_fg_sector_mode(u32 enabled){if(!fg_quiet()||S.current||enabled>1)return -GN_STATE;S.fg_sector_enabled=enabled;return 0;}
API int gn_fg_begin(u64 budget){
 S.fg_sector_ready=0;
 if(!fg_quiet()||!S.current||S.certifying)return -GN_STATE;
 if(!fkg_covers(&S.fgate,S.current)){S.fgate.status=FKG_UNAVAILABLE;return 0;}
 FkgCount upper;double before=gn_host_clock();int rc=fg_upper(S.current,budget,&upper);
 S.fg_count_ms+=gn_host_clock()-before;S.fg_recounts++;
 if(rc){S.fgate.status=FKG_UNAVAILABLE;return -rc;}
 int s=fkg_begin(&S.fgate,S.current,S.completed,S.nrules,upper,1);
 if(s<0)return -GN_REJECTED;
 if(S.fg_sector_enabled){
  before=gn_host_clock();rc=fg_sector_count(S.current,budget,S.fg_sector_upper);S.fg_sector_ms+=gn_host_clock()-before;
  if(rc){S.fg_sector_error=rc;if(rc!=GN_MEMORY&&rc!=GN_LIMIT&&rc!=GN_SCRATCH)return -rc;}
  else{
   u64 total=0;for(u32 k=0;k<360;k++){total+=S.fg_sector_upper[k];if(S.fg_sector_upper[k]<fkg_class_per_grade[S.current][fkg_group_class[S.current&1][k]])return -GN_REJECTED;}
   if(fkg_compare(upper,fkg_from_u64(total)))return -GN_REJECTED;
   S.fg_sector_ready=1;
  }
 }
 return s;
}
API int gn_fg_poll(void){
 if(!fg_quiet()||!S.current||S.certifying)return -GN_STATE;
 S.fg_poll_calls++;if(S.fgate.status==FKG_UNAVAILABLE)return 0;
 /* Stored words, not externally reported scalar rule counts, are audited.
  * This check runs once per NEW RULE, not once per reduction/pair. */
 int valid=S.nrules>=S.fgate.observed_rules;
 for(u64 id=S.fgate.observed_rules+1;valid&&id<=S.nrules;id++){
  Rule*r=rule((u32)id);u32 pos=0;
  if(r->degree!=S.current||divisor(r->lm,r->degree,(u32)id-1,&pos,&S.lanes[0]))valid=0;
  if(valid&&S.fg_sector_ready){u32 k=fg_word_group(r->lm,r->degree);if(S.fg_sector_upper[k]<=fkg_class_per_grade[S.current][fkg_group_class[S.current&1][k]])return -GN_REJECTED;S.fg_sector_upper[k]--;}
 }
 int rc=fkg_observe(&S.fgate,S.current,S.completed,S.nrules,valid,1);
 return rc<0?-GN_REJECTED:rc;
}
/* Two-phase close: arithmetic event updates are rechecked by a complete
 * normal-word count before the kernel is authorized to bypass any work. */
API int gn_fg_close(u64 budget){
 if(!fg_quiet()||S.certifying||!S.current||S.batch_n!=S.batch_committed)return -GN_STATE;
 int st=gn_fg_poll();if(st!=FKG_READY)return st<0?st:-GN_STATE;
 FkgCount upper;double before=gn_host_clock();int rc=fg_upper(S.current,budget,&upper);
 S.fg_count_ms+=gn_host_clock()-before;S.fg_recounts++;
 if(rc){S.fgate.status=FKG_UNAVAILABLE;return -rc;}
 if(fkg_close(&S.fgate,upper,1)!=FKG_CLOSED)return -GN_REJECTED;
 S.fg_closed++;
 if(S.degree_total_known&&S.degree_total>=S.degree_seen)S.fg_skipped+=S.degree_total-S.degree_seen;
 S.iter_done=1; /* Preserve actual scheduled/committed/seen counters. */
 return FKG_CLOSED;
}
API int gn_fg_status(void){return S.fgate.status;}
API u32 gn_fg_limb(u32 item,u32 limb){
 if(limb>=4)return 0;FkgCount v;
 if(item==0)v=S.fgate.upper;else if(item==1)v=S.fgate.lower;
 else if(item==2){if(fkg_deficit(&S.fgate,&v))return 0;}else return 0;
 return v.limb[limb];
}
API u64 gn_fg_stat(u32 item){switch(item){
 case 0:return S.fgate.degree;case 1:return S.fg_closed;case 2:return S.fg_poll_calls;
 case 3:return S.fg_recounts;case 4:return S.fg_skipped;
 case 5:return(u64)(S.fg_count_ms*1000.0);case 6:return S.fgate.accepted_leaders;
 case 7:return sizeof(FkgGate);case 8:return GN_LOAD(&S.fg_sector_skipped);case 9:return(u64)(S.fg_sector_ms*1000);case 10:return S.fg_sector_peak;case 11:return S.fg_sector_error;case 12:return S.fg_sector_nodes;case 13:return S.fg_sector_enabled;case 14:return FKG_PROFILE_DEGREE;case 15:return FKG_EXACT_TOTAL_DEGREE;default:return 0;}}

API u64 gn_fg_class(u32 cls,u32 lower){if(cls>=11||S.fgate.degree>FKG_PROFILE_DEGREE)return 0;if(lower)return fkg_class_dimension[S.fgate.degree][cls];u64 sum=0;for(u32 g=0;g<360;g++)if(fkg_group_class[S.fgate.degree&1][g]==cls)sum+=S.fg_sector_upper[g];return sum;}

API u64 gn_fg_group(u32 g,u32 lower){if(g>=360||S.fgate.degree>FKG_PROFILE_DEGREE)return 0;return lower?fkg_class_per_grade[S.fgate.degree][fkg_group_class[S.fgate.degree&1][g]]:S.fg_sector_upper[g];}
