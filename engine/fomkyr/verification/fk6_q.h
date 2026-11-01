/* SPDX-License-Identifier: MIT. Exact FK6/Q total dimensions through degree 20.
 * Imported external project dimensions; runtime does not replay the proof.
 * External specialist review is pending; hashes bind bytes but do not replace proof replay. */
#ifndef FKG_FK6_Q_PROFILE_H
#define FKG_FK6_Q_PROFILE_H
#include <stdint.h>
#define FKG_PROFILE_DEGREE 20u
#define FKG_EXACT_TOTAL_DEGREE 20u
#define FKG_CERTIFICATE_SHA256 "ff53cb4a9ea903dbd63c3875a2d512884953586e3ec832036504431be47857a2"
#define FKG_PROFILE_PROOF_STATUS "computational-proof-pending-external-review"
static const uint64_t fkg_fk6_q_lower[21]={1,15,125,765,3831,16605,64432,228855,755777,2347365,6916867,19468980,52632322,137268120,346652740,850296030,2031123484,4735557180,10797439780,24117029700,52848046446};
static const char*const fkg_identities[]={"17c5a3b13bbae1fd6e03ece75139f297d437bda2ae062b093d77a92f091b88bf"};
#endif
