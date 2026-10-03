/* SPDX-License-Identifier: MIT. POSIX native host, independent of Node/WASM. */
#define _GNU_SOURCE
#define _DEFAULT_SOURCE
#define _POSIX_C_SOURCE 200809L
#include "host.h"
#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include <time.h>
#include <errno.h>
#include <string.h>
#include <pthread.h>
#ifdef __linux__
#include <sched.h>
#endif
static unsigned char *base;static u64 capacity;static int disk=-1;
volatile sig_atomic_t native_stop=0,native_checkpoint=0;
static void(*pulse)(double);static pthread_t coordinator;
void native_set_pulse(void(*fn)(double)){pulse=fn;coordinator=pthread_self();}
int native_open(u64 bytes,const char*path){
 if(bytes>SIZE_MAX||!bytes){errno=EOVERFLOW;return 0;}
 int flags=MAP_PRIVATE|MAP_ANONYMOUS;
#ifdef MAP_NORESERVE
 flags|=MAP_NORESERVE; /* Address reservation only: physical allocations still obey OS/cgroup limits. */
#endif
 base=mmap(NULL,(size_t)bytes,PROT_READ|PROT_WRITE,flags,-1,0);
 if(base==MAP_FAILED){base=NULL;return 0;}capacity=bytes;gn_bind(base);
 disk=open(path,O_RDWR|O_CREAT,0600);if(disk<0){native_close();return 0;}return 1;
}
void native_close(void){if(disk>=0)close(disk);disk=-1;if(base)munmap(base,(size_t)capacity);base=NULL;capacity=0;}
void*native_pointer(u64 off){return base+off;}
int gn_host_ensure(u64 end){return end<=capacity;}
int gn_host_read(u64 off,u64 dst,u32 size){if(disk<0||dst>capacity||size>capacity-dst||off>INT64_MAX-size)return 0;u32 done=0;while(done<size){ssize_t n=pread(disk,base+dst+done,size-done,(off_t)(off+done));if(n<0&&errno==EINTR)continue;if(n<=0)return 0;done+=(u32)n;}return 1;}
int gn_host_write(u64 off,u64 src,u32 size){if(disk<0||src>capacity||size>capacity-src||off>INT64_MAX-size)return 0;u32 done=0;while(done<size){ssize_t n=pwrite(disk,base+src+done,size-done,(off_t)(off+done));if(n<0&&errno==EINTR)continue;if(n<=0)return 0;done+=(u32)n;}return 1;}
double gn_host_clock(void){if(native_stop)gn_cancel(1);struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);double now=(double)t.tv_sec*1000.0+(double)t.tv_nsec/1e6;if(pulse&&pthread_equal(pthread_self(),coordinator))pulse(now);return now;}
int native_sync(void){int r;do{r=fsync(disk);}while(r&&errno==EINTR);return r;}
int native_truncate(u64 bytes){if(bytes>INT64_MAX){errno=EOVERFLOW;return -1;}return ftruncate(disk,(off_t)bytes);}
u64 native_size(void){struct stat st;if(fstat(disk,&st))return 0;return(u64)st.st_size;}
static u64 read_num(const char*path){FILE*f=fopen(path,"r");if(!f)return UINT64_MAX;char b[128];u64 n=UINT64_MAX;if(fgets(b,sizeof(b),f)&&strncmp(b,"max",3)){char*e;errno=0;unsigned long long v=strtoull(b,&e,10);if(!errno&&e!=b)n=v;}fclose(f);return n;}
u64 native_available(void){
 long pages=-1,page=sysconf(_SC_PAGESIZE);
#ifdef _SC_AVPHYS_PAGES
 pages=sysconf(_SC_AVPHYS_PAGES);
#endif
 if(pages<1)pages=sysconf(_SC_PHYS_PAGES);
 u64 n=(pages>0&&page>0)?(u64)pages*(u64)page:UINT64_C(1073741824);
#ifdef __linux__
 FILE*f=fopen("/proc/meminfo","r");if(f){char line[256];while(fgets(line,sizeof(line),f)){unsigned long long kb;if(sscanf(line,"MemAvailable: %llu kB",&kb)==1){n=(u64)kb*1024;break;}}fclose(f);}
 /* cgroup v2 and common v1 mounts. Current deployment's resource limits outrank
  * the host's physical-memory total, e.g. inside containers or Slurm jobs. */
 u64 lim=read_num("/sys/fs/cgroup/memory.max"),used=read_num("/sys/fs/cgroup/memory.current");
 if(lim==UINT64_MAX){lim=read_num("/sys/fs/cgroup/memory/memory.limit_in_bytes");used=read_num("/sys/fs/cgroup/memory/memory.usage_in_bytes");}
 if(lim!=UINT64_MAX&&used!=UINT64_MAX){u64 remaining=lim>used?lim-used:0;if(remaining<n)n=remaining;}
#endif
 struct rlimit r;if(!getrlimit(RLIMIT_AS,&r)&&r.rlim_cur!=RLIM_INFINITY&&(u64)r.rlim_cur<n)n=(u64)r.rlim_cur;
 return n;
}
u32 native_cpus(void){long n=sysconf(_SC_NPROCESSORS_ONLN);if(n<1)n=1;
#ifdef __linux__
 cpu_set_t set;if(!sched_getaffinity(0,sizeof(set),&set)){long a=CPU_COUNT(&set);if(a>0&&a<n)n=a;}
 FILE*f=fopen("/sys/fs/cgroup/cpu.max","r");if(f){unsigned long long quota,period;if(fscanf(f,"%llu %llu",&quota,&period)==2&&period){u64 q=(quota+period-1)/period;if(q&&q<(u64)n)n=(long)q;}fclose(f);}
#endif
 if(n>GN_MAX_WORKERS)n=GN_MAX_WORKERS;return(u32)n;}
