#define _DEFAULT_SOURCE
#define _POSIX_C_SOURCE 200809L
#include "../src/kernel.h"
#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/mman.h>
#include <time.h>
static unsigned char *base;
static u64 capacity;
static int disk=-1;
int host_init(u64 bytes,const char *path){if(base)munmap(base,capacity);if(disk>=0)close(disk);base=mmap(0,(size_t)bytes,PROT_READ|PROT_WRITE,MAP_PRIVATE|MAP_ANONYMOUS,-1,0);if(base==MAP_FAILED){base=0;return 0;}capacity=bytes;gn_bind(base);disk=path?open(path,O_RDWR|O_CREAT,0600):-1;return 1;}
int gn_host_ensure(u64 end){return end<=capacity;}
int gn_host_read(u64 off,u64 dst,u32 size){if(disk<0||dst+size>capacity)return 0;u32 n=0;while(n<size){ssize_t r=pread(disk,base+dst+n,size-n,(off_t)(off+n));if(r<=0)return 0;n+=(u32)r;}return 1;}
int gn_host_write(u64 off,u64 src,u32 size){if(disk<0||src+size>capacity)return 0;u32 n=0;while(n<size){ssize_t r=pwrite(disk,base+src+n,size-n,(off_t)(off+n));if(r<=0)return 0;n+=(u32)r;}return 1;}
double gn_host_clock(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec*1000.0+t.tv_nsec/1e6;}
void *host_pointer(u64 off){return base+off;}
int host_sync(void){return disk>=0?fsync(disk):0;}
