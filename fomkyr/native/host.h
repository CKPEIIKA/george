/* SPDX-License-Identifier: MIT */
#ifndef FK_POSIX_HOST_H
#define FK_POSIX_HOST_H
#include "../src/kernel.h"
#include <signal.h>
extern volatile sig_atomic_t native_stop,native_checkpoint;
void native_set_pulse(void(*fn)(double));
int native_open(u64,const char*);void native_close(void);void *native_pointer(u64);
int native_sync(void);int native_truncate(u64);u64 native_size(void);
u64 native_available(void);u32 native_cpus(void);
#endif
