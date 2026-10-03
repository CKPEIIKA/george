#!/usr/bin/env bash
# Host compatibility/configuration probe; generated configuration stays local.
set -euo pipefail
fomkyr_root=$(cd "$(dirname "$0")/.." && pwd)
cd "$fomkyr_root"
fomkyr_probe=dist/native-check
mkdir -p "$fomkyr_probe"
fomkyr_cc=${FOMKYR_CHECK_CC:-}
if [[ -z $fomkyr_cc ]]; then
  for candidate in gcc clang cc; do
    if command -v "$candidate" >/dev/null; then fomkyr_cc=$candidate; break; fi
  done
fi
if [[ -z $fomkyr_cc ]]; then echo 'A C11 compiler with POSIX threads is required.' >&2; exit 1; fi
fomkyr_version=$("$fomkyr_cc" --version)
fomkyr_profile=lto
fomkyr_link='-flto -pthread'
if [[ $fomkyr_version != *clang* && $fomkyr_version == *'Free Software Foundation'* ]]; then
  fomkyr_profile=pgo
elif [[ $fomkyr_version == *clang* ]] && command -v ld.lld >/dev/null; then
  fomkyr_link+=' -fuse-ld=lld'
fi
cat > "$fomkyr_probe/probe.c" <<'C'
#define _GNU_SOURCE
#include <stdint.h>
#include <stddef.h>
#include <pthread.h>
#include <stdatomic.h>
#include <sys/mman.h>
#include <unistd.h>
_Static_assert(sizeof(void*)==8 && sizeof(ptrdiff_t)==8, "64-bit native host required");
static _Atomic uint64_t counter;
static void *work(void *p){(void)p;atomic_fetch_add(&counter,1);return 0;}
int main(void){
 uint32_t order=1;if(*(unsigned char*)&order!=1)return 1;
 if(!atomic_is_lock_free(&counter))return 2;
 pthread_t t;if(pthread_create(&t,0,work,0)||pthread_join(t,0)||counter!=1)return 3;
 void *p=mmap(0,65536,PROT_READ|PROT_WRITE,MAP_PRIVATE|MAP_ANONYMOUS,-1,0);
 if(p==MAP_FAILED)return 4;*(volatile char*)p=1;return munmap(p,65536)!=0;
}
C
fomkyr_arch=native
read -r -a fomkyr_link_flags <<< "$fomkyr_link"
if ! "$fomkyr_cc" -O3 -flto -std=c11 -march=native "$fomkyr_probe/probe.c" "${fomkyr_link_flags[@]}" -o "$fomkyr_probe/probe" > "$fomkyr_probe/compiler.log" 2>&1; then
  fomkyr_arch=''
  "$fomkyr_cc" -O3 -flto -std=c11 "$fomkyr_probe/probe.c" "${fomkyr_link_flags[@]}" -o "$fomkyr_probe/probe" >> "$fomkyr_probe/compiler.log" 2>&1
fi
"$fomkyr_probe/probe" || { echo 'Host probe failed: 64-bit little-endian POSIX threads, atomics and mmap are required.' >&2; exit 1; }
if [[ $fomkyr_profile == pgo ]]; then
  fomkyr_pgo_ok=true
  "$fomkyr_cc" -O3 -flto -std=c11 ${fomkyr_arch:+-march=$fomkyr_arch} \
    -fprofile-generate="$fomkyr_probe/profiles" -fprofile-update=atomic \
    "$fomkyr_probe/probe.c" "${fomkyr_link_flags[@]}" -o "$fomkyr_probe/probe-pgo" \
    >> "$fomkyr_probe/compiler.log" 2>&1 || fomkyr_pgo_ok=false
  if $fomkyr_pgo_ok; then "$fomkyr_probe/probe-pgo" || fomkyr_pgo_ok=false; fi
  if $fomkyr_pgo_ok; then
    "$fomkyr_cc" -O3 -flto -std=c11 ${fomkyr_arch:+-march=$fomkyr_arch} \
      -fprofile-use="$fomkyr_probe/profiles" -fprofile-correction \
      "$fomkyr_probe/probe.c" "${fomkyr_link_flags[@]}" -o "$fomkyr_probe/probe-pgo" \
      >> "$fomkyr_probe/compiler.log" 2>&1 || fomkyr_pgo_ok=false
  fi
  if $fomkyr_pgo_ok; then "$fomkyr_probe/probe-pgo" || fomkyr_pgo_ok=false; fi
  if ! $fomkyr_pgo_ok; then fomkyr_profile=lto; fi
fi
cat > dist/native-config.mk.tmp <<EOF
# Local configuration from make check. Re-run on the target host.
CC := $fomkyr_cc
CFLAGS := -O3 -flto -std=c11 -Wall -Wextra
LDFLAGS := $fomkyr_link
NATIVE_ARCH := $fomkyr_arch
NATIVE_PROFILE := $fomkyr_profile
EOF
mv dist/native-config.mk.tmp dist/native-config.mk
printf 'Host compatible: 64-bit, little-endian, POSIX threads, lock-free atomics, mmap.\n'
printf 'Compiler: %s\nOptimization: O3 + LTO; architecture: %s; profile: %s\n' "$fomkyr_cc" "${fomkyr_arch:-portable}" "$fomkyr_profile"
printf 'Configuration saved locally. Run make, then ./dist/fomkyr --help.\n'
