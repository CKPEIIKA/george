/* SPDX-License-Identifier: MIT. Reproduce an occupied worker after the
 * coordinator has exhausted its own batch tasks. No high-degree job is needed.
 * Build with src/kernel.c and native/{host,support,fixture}.c, -pthread. */
#define _POSIX_C_SOURCE 200809L
#include "../src/kernel.h"
#include <stdatomic.h>
#include <assert.h>
static int occupied_batch(u32 lane);
#define gn_batch_reduce occupied_batch
#define main test_cli_main
#include "../native/cli.c"
#undef main
#undef gn_batch_reduce
static _Atomic unsigned test_pulses,test_iterations;
static void test_pulse(double now){(void)now;atomic_fetch_add(&test_pulses,1);}
static int occupied_batch(u32 lane){
 if(!lane)return 0;
 double end=gn_host_clock()+1000;
 while(atomic_load(&test_pulses)<4&&gn_host_clock()<end)atomic_fetch_add(&test_iterations,1);
 return 0;
}
static char *capture_progress(int readable){
 FILE *file=tmpfile();assert(file);int original=dup(STDERR_FILENO);assert(original>=0);
 fflush(stderr);assert(dup2(fileno(file),STDERR_FILENO)>=0);
 human_output=readable;pool_waiting=1;quiet=0;last_log=0;started=0;
 log_pulse(12500);fflush(stderr);assert(dup2(original,STDERR_FILENO)>=0);close(original);
 assert(!fseek(file,0,SEEK_END));long size=ftell(file);assert(size>0);rewind(file);
 char *text=calloc((size_t)size+1,1);assert(text);assert(fread(text,1,(size_t)size,file)==(size_t)size);fclose(file);
 pool_waiting=0;return text;
}
int main(void){
 native_set_pulse(test_pulse);assert(!pool_open(2));
 (void)gn_host_clock();unsigned before=atomic_load(&test_pulses);
 assert(!pool_reduce(2));unsigned during=atomic_load(&test_pulses)-before;
 assert(!pool_waiting);assert(atomic_load(&test_iterations)>0);pool_close();
 printf("Worker wait: %u coordinator heartbeats while another lane worked.\n",during);
 assert(during>=3);
 char *text=capture_progress(0);Json j={0};assert(!json_parse(&j,text));
 char *phase=json_string(&j,json_key(&j,0,"phase"));assert(phase&&!strcmp(phase,"waiting-workers"));free(phase);
 const char *counts[]={"resolvedOverlaps","totalOverlaps","scheduledOverlaps","committedOverlaps","sampledRewrites","activeLanes"};
 for(unsigned i=0;i<sizeof(counts)/sizeof(*counts);i++){int ok=1;assert(json_u64(&j,json_key(&j,0,counts[i]),&ok)==0&&ok);}
 char *elapsed=json_string(&j,json_key(&j,0,"elapsedSeconds"));assert(elapsed&&!strcmp(elapsed,"12.500"));free(elapsed);
 assert(j.t[json_key(&j,0,"lanes")].type=='[');json_free(&j);free(text);
 text=capture_progress(1);assert(strstr(text,"Waiting for workers"));assert(strstr(text,"Elapsed: 12.500 s"));free(text);
 puts("Structured and readable worker-wait reports passed.");return 0;
}
