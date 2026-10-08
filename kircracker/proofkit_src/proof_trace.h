/* SPDX-License-Identifier: MIT
 * Coordinator-only optional genealogy. KIR_GENEALOGY=/path/events.jsonl enables
 * it. No reductions, skipped pairs or coefficients are invented. Native only.
 * An incomplete log is not a proof of completion. Basis records remain unchanged.
 */
#ifndef KIR_PROOF_TRACE_H
#define KIR_PROOF_TRACE_H
#ifndef __wasm__
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
static FILE *kir_trace_file;
static int kir_trace_opened, kir_trace_failed, kir_trace_batch;
static uint32_t kir_trace_left,kir_trace_right,kir_trace_overlap,kir_trace_snapshot;
static const char *kir_trace_kind="unknown";
static void kir_trace_parent(const char *kind,uint32_t f,uint32_t g,uint32_t k,uint32_t snapshot){kir_trace_kind=kind;kir_trace_left=f;kir_trace_right=g;kir_trace_overlap=k;kir_trace_snapshot=snapshot;}
static int kir_trace_append(uint32_t id,uint32_t degree,uint32_t terms,const unsigned char *word,uint64_t checksum,int restored){
 if(!kir_trace_opened){const char*p=getenv("KIR_GENEALOGY");kir_trace_opened=1;if(p&&*p){kir_trace_file=fopen(p,"a");if(!kir_trace_file)kir_trace_failed=1;}}
 if(kir_trace_failed)return 0;if(!kir_trace_file)return 1;
 int ok=fprintf(kir_trace_file,"{\"event\":\"rule\",\"id\":%u,\"degree\":%u,\"terms\":%u,\"kind\":\"%s\",\"leftRule\":%u,\"rightRule\":%u,\"overlapLength\":%u,\"snapshot\":%u,\"recordChecksum\":\"%llu\",\"leadingWord\":[",id,degree,terms,restored?"restored":kir_trace_kind,kir_trace_left,kir_trace_right,kir_trace_overlap,kir_trace_snapshot,(unsigned long long)checksum)>=0;
 for(uint32_t j=0;j<degree&&ok;j++)ok=fprintf(kir_trace_file,"%s%u",j?",":"",word[j])>=0;
 if(ok)ok=fprintf(kir_trace_file,"]}\n")>=0;if(ok)ok=fflush(kir_trace_file)==0;
 if(!ok)kir_trace_failed=1;return ok;
}
#endif
#endif
