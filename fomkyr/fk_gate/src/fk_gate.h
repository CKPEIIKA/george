/* SPDX-License-Identifier: MIT
 * FK Gate 0.3: fixed-size degree-closure arithmetic; no allocation or algebra.
 * The host is responsible for an actual admissible-order homogeneous reducer,
 * ideal-membership provenance and counting ALL forbidden leading words.
 */
#ifndef FK_GATE_H
#define FK_GATE_H
#include <stdint.h>
#include <stddef.h>
#define FKG_ABI 1u
#define FKG_UNAVAILABLE 0
#define FKG_ACTIVE 1
#define FKG_READY 2
#define FKG_CLOSED 3
#define FKG_BAD_STATE (-1)
#define FKG_BAD_COUNT (-2)
#define FKG_BAD_EVENT (-3)
#define FKG_NONQUIESCENT (-4)
typedef struct {uint32_t limb[4];} FkgCount;
typedef struct {
 uint32_t abi,bound,degree;int32_t status;
 uint64_t initial_rules,observed_rules,accepted_leaders;
 FkgCount initial_upper,upper,lower;
 uint32_t presentation_ok,field,previous_complete,reserved;
} FkgGate;
/* Unknown identity/field disables the gate, never broadens applicability. */
int fkg_bind(FkgGate*,const char identity_hex[64],uint32_t generators,uint32_t characteristic);
void fkg_reset(FkgGate*);
int fkg_covers(const FkgGate*,uint32_t degree);
/* Profile metadata: coverage means a proved LOWER bound, not full equality. */
uint32_t fkg_profile_degree(void);
uint32_t fkg_exact_total_degree(void);
int fkg_begin(FkgGate*,uint32_t degree,uint32_t completed,uint64_t rule_count,FkgCount upper,int quiescent);
/* Batch event must be proven: all appended leaders are DISTINCT, degree d,
 * and previously irreducible. Kernel adapter enforces this from actual words. */
int fkg_observe(FkgGate*,uint32_t degree,uint32_t completed,uint64_t rule_count,int admissible_additions,int quiescent);
/* Optional recomputed upper catches stale snapshots. No coefficient guessing. */
int fkg_close(FkgGate*,FkgCount recomputed_upper,int quiescent);
int fkg_compare(FkgCount,FkgCount);
FkgCount fkg_from_u64(uint64_t);
int fkg_subtract(FkgCount*,uint64_t);
int fkg_deficit(const FkgGate*,FkgCount*);
const char*fkg_certificate_sha256(void);
#endif
