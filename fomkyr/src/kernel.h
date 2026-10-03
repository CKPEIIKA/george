/* SPDX-License-Identifier: MIT
 * George Native: bounded, homogeneous free-associative completion kernel.
 * All stored addresses are byte offsets into a host-provided linear memory.
 */
#ifndef GEORGE_NATIVE_H
#define GEORGE_NATIVE_H
#include <stdint.h>
#include <stddef.h>
typedef uint64_t u64; typedef int64_t i64; typedef uint32_t u32; typedef uint8_t u8;
#define GN_ABI 3
#define GN_INLINE_DEGREE 31
/* Degree is an unsigned 32-bit index, not a fixed word-storage capacity. */
#define GN_INDEX_MAX (UINT32_MAX-1u)
#define GN_MAX_WORKERS 32
#define GN_WASM_HARD_BYTES UINT64_C(15000000000)
#ifdef __wasm__
#define GN_HARD_BYTES GN_WASM_HARD_BYTES
#else
/* Native offsets follow the host address range, not a browser cap. */
#define GN_HARD_BYTES ((u64)PTRDIFF_MAX & ~UINT64_C(65535))
#endif
enum { GN_OK=0, GN_MEMORY=1, GN_SCRATCH=2, GN_INPUT=3, GN_IO=4, GN_CANCELLED=5, GN_CORRUPT=6, GN_STATE=7, GN_BATCH_FULL=8, GN_LIMIT=9, GN_REJECTED=10, GN_DEFERRED=11, GN_REPACK=12 };
#ifdef __wasm__
#define API __attribute__((visibility("default")))
#define HOST(name) __attribute__((import_module("host"),import_name(name)))
#else
#define API
#define HOST(name)
#endif
HOST("ensure") int gn_host_ensure(u64 end);
HOST("read") int gn_host_read(u64 off, u64 dst, u32 size);
HOST("write") int gn_host_write(u64 off, u64 src, u32 size);
HOST("clock") double gn_host_clock(void);
#ifndef __wasm__
void gn_bind(void *base);
#endif
/* Optional bounded derived rewrite table. 0 disables; 2..4 compile local words,
 * never bound the degree of the overall computation. Construction is field/order
 * specific and re-created from the exact basis after checkpoint restoration. */
API int gn_local_rewrites(u32 degree,u64 bytes,u32 support);
API u64 gn_local_rule(u32 key); /* idle-boundary serialized identity for audit */
API int gn_pin_cache(u64 bytes);
API int gn_radix_queue(u32 enabled);
API int gn_row_reserve(u64 bytes);
API int gn_reserve_growth(u32 enabled);
API int gn_memory_policy(u32 enabled);
API int gn_batch_retry(u32 workers,u32 first);
API u64 gn_memory_stat(u32 key);
API u64 gn_reserve_stat(u32 lane,u32 key);
API u32 gn_abi(void);
API u64 gn_heap_base(void);
API int gn_init(u32 generators,u32 degree,u32 workers,u64 budget,u64 scratch_pool,u32 hash_bits,u32 modulus,u32 spill);
API int gn_workers(u32 workers);
API u64 gn_stack_top(u32 lane);
API u64 gn_cancel_ptr(void);
API void gn_cancel(u32 value);
API u64 gn_stat(u32 key);
API int gn_input_begin(u32 degree,u32 terms);
API int gn_input_term(u64 lo,u64 hi,i64 coefficient);
API int gn_input_end(void);
API int gn_input_bytes(u32 length,i64 coefficient);
API int gn_tune(u32 flags,u32 cache_percent,u32 heap_threshold);
/* Performance flags: 1=word matcher, 2=homogeneous chain criterion,
 * 4=sampled live telemetry / exact per-degree candidate denominator,
 * 8=early square/skew-commutation zero pruning,
 * 16=exact monic quadratic-binomial preconditioning,
 * 32=cost-ordered dispatch (commit order is unchanged). */
API int gn_rational_heap(u32 enabled);
API int gn_big_rational_heap(u32 enabled);
API int gn_growing_rational(u32 enabled);
API int gn_legacy_big_division(u32 enabled);
API u64 gn_exact_stat(u32 lane,u32 key);
API int gn_rational_rewrites(u32 enabled); /* same exact cached identities in rational NF */
API u32 gn_modulus(void);
API u64 gn_deep_stat(u32 lane,u32 key); /* read only at barriers, unlike gn_live_stat */
API int gn_optimize(u32 flags,u64 matcher_budget);
API int gn_word_cache(u32 entries); /* power of two, 256..1048576; optional bounded growth */
API u64 gn_live_stat(u32 lane,u32 key);
API u64 gn_progress_stat(u32 key);
API void gn_deadline(double absolute_ms);
API u64 gn_completion_bound(void);
API int gn_start_degree(u32 degree);
API int gn_next_pair(u32 lane); /* 1=pair, 0=end, negative=error */
API int gn_reduce_pair(u32 lane);
API int gn_commit(u32 lane);
API int gn_batch_mode(u32 enabled);
API int gn_batch_fill(u32 limit);
API int gn_batch_reduce(u32 lane);
API u32 gn_batch_status(u32 task);
API int gn_batch_commit(u32 task);
API int gn_batch_fallback(void);
API int gn_hilbert(u32 degree,u64 extra_budget);
/* Partial-leading-ideal UPPER BOUND only; never certifies a degree. */
API int gn_hilbert_upper(u32 degree,u64 extra_budget);
API void gn_hilbert_release(void);
/* Portable quiescent frontier. Records remain ABI 3; cursor format is separate.
 * Captures all committed rules + iterator + uncommitted descriptors, no pointers. */
API u64 gn_frontier_export(void);
API u32 gn_frontier_size(void);
API int gn_frontier_restore(u32 bytes);
API u32 gn_frontier_pending(void);
API u32 gn_frontier_hash_bits(void);
API u64 gn_hilbert_coefficient(u32 degree,u32 high);
API u32 gn_hilbert_limbs(void);
API u32 gn_hilbert_limb(u32 degree,u32 limb);
/* Hilbert closure is conditional on a HOST-authorized independent lower bound.
 * Bounds wider than uint64 decline this OPTIONAL path, not ordinary completion. */
API int gn_hilbert_gate_begin(u64 lower,u64 extra_budget);
API int gn_hilbert_gate_try(void); /* 1=closed, 0=continue, negative=error */
API u64 gn_hilbert_gate_stat(u32 key);
/* Exact integer dual certificate replay. Original fixture relations are supplied
 * by the host, never taken from the certificate. A diagonal nonzero evaluation
 * minor establishes independence; all original contexts are annihilated in Q. */
API int gn_lb_begin(u32 degree,u32 dimension,u32 relations,u32 terms,u64 extra_budget);
API int gn_lb_pivot(u32 index,u32 column);
API int gn_lb_relation(u32 degree,u32 terms);
API int gn_lb_term(u32 word_index,i64 coefficient);
API int gn_lb_vector(u32 index);
API int gn_lb_entry(u32 column,i64 value);
API int gn_lb_check(void);
API int gn_lb_finish(void);
API void gn_lb_release(void);
API int gn_finish_degree(void);
API int gn_rewind_degree(void); /* replay current degree, preserving committed rules */
API u32 gn_result_count(u32 lane);
API u64 gn_lane_stat(u32 lane,u32 key);
API u64 gn_rule_stat(u32 id,u32 key);
API int gn_candidate_check(void); /* validate LM antichain; enable reject-only verification */
API u32 gn_is_certifying(void);
API u64 gn_canonical_rule(u32 id); /* full reduced representative for CRT; no basis mutation */
API u64 gn_export_rule(u32 id); /* serialized record in coordinator I/O workspace */
API u32 gn_export_size(void);
API u64 gn_import_buffer(void);
API u32 gn_import_capacity(void);
API int gn_restore_rule(u32 bytes,u64 file_offset);
API int gn_restored_through(u32 degree);
/* Narrow arithmetic test hooks; also useful for independent ABI tests. */
API i64 gn_test_small(u32 operation,i64 a,i64 b);
#endif
