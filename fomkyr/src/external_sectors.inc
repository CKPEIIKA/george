/* SPDX-License-Identifier: MIT. Explicit external S6 permutation-grade data.
 * Counts are dimensions of INDIVIDUAL grades, never class totals. The host
 * pins this policy to the input/order/field and records its hash in checkpoints.
 * The kernel checks shape, exact totals, and grading of input/restored rules.
 */
#define FG_EXTERNAL_MAX_DEGREE 30u
static u32 fg_step(u32 parity,u32 group,u32 generator){
 return fkg_group_step[parity][group][S.fg_external?S.fg_edge_map[generator]:generator];
}
static u64 fg_lower_group(u32 degree,u32 group){
 if(S.fg_external)return degree<=S.fg_external_through?PTR(u64,S.fg_external_base)[(u64)degree*360+group]:0;
 return degree<=FKG_PROFILE_DEGREE?fkg_class_per_grade[degree][fkg_group_class[degree&1][group]]:0;
}
static u64 fg_lower_total(u32 degree){
 if(S.fg_external)return degree<=S.fg_external_through?PTR(u64,S.fg_external_totals)[degree]:0;
 return degree<=FKG_PROFILE_DEGREE?fkg_fk6_q_lower[degree]:0;
}
static int fg_poly_homogeneous(Poly p){
 if(!p.n)return 1;u32 first=0;
 for(u32 term=0;term<p.n;term++){
  u32 g=0;Word w=pw(p,term);
  for(u32 j=0;j<p.degree;j++)g=fg_step(j&1,g,letter(w,p.degree,j));
  if(term&&g!=first)return 0;first=g;
 }return 1;
}
API int gn_fg_external_bind(u32 through){
 if(!fg_quiet()||S.current||S.nrules||S.modulus||S.generators>15||S.fgate.presentation_ok||S.fg_external||!through||through>FG_EXTERNAL_MAX_DEGREE)return GN_STATE;
 u64 bytes=((u64)through+1)*361*sizeof(u64),base=alloc_p(bytes);if(!base)return S.error;
 memset(PTR(u8,base),0,(size_t)bytes);S.fg_external_base=base;
 S.fg_external_totals=base+((u64)through+1)*360*sizeof(u64);
 PTR(u64,base)[0]=1;PTR(u64,S.fg_external_totals)[0]=1;
 S.fg_external=1;S.fg_external_through=through;fkg_reset(&S.fgate);return 0;
}
API int gn_fg_external_edge(u32 generator,u32 edge){
 if(!fg_quiet()||S.current||S.nrules||S.fg_external!=1||generator!=S.fg_external_edges||generator>=S.generators||edge>=15)return GN_STATE;
 for(u32 i=0;i<generator;i++)if(S.fg_edge_map[i]==edge)return GN_INPUT;
 S.fg_edge_map[generator]=edge;S.fg_external_edges++;return 0;
}
API int gn_fg_external_lower(u32 degree,u32 group,u64 dimension){
 if(!fg_quiet()||S.current||S.nrules||S.fg_external!=1||!degree||degree>S.fg_external_through||group>=360||S.fg_external_filled!=(degree-1)*360+group)return GN_STATE;
 u64 *total=&PTR(u64,S.fg_external_totals)[degree];if(UINT64_MAX-*total<dimension)return GN_LIMIT;
 PTR(u64,S.fg_external_base)[(u64)degree*360+group]=dimension;*total+=dimension;S.fg_external_filled++;return 0;
}
API int gn_fg_external_seal(void){
 if(!fg_quiet()||S.current||S.nrules||S.fg_external!=1||S.fg_external_edges!=S.generators||S.fg_external_filled!=S.fg_external_through*360)return GN_STATE;
 S.fg_external=2;S.fgate.presentation_ok=1;S.fgate.bound=S.fg_external_through;
 S.fgate.status=FKG_UNAVAILABLE;return 0;
}
