#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
kircracker_cxx=${CXX:-g++}
command -v "$kircracker_cxx" >/dev/null
command -v make >/dev/null
python3 -c 'import sys; assert sys.version_info >= (3, 9), "Python 3.9 or later is required"'
kircracker_check_dir=$(mktemp -d)
trap 'rm -rf "$kircracker_check_dir"' EXIT
cat >"$kircracker_check_dir/check.cpp" <<'CPP'
#include <gmpxx.h>
int main() { mpz_class a=1; mpq_class q(1,2); return a!=1 || q!=mpq_class(1,2); }
CPP
kircracker_gmp_flags=()
if [[ -n ${GMP_PREFIX:-} ]]; then
  kircracker_gmp_flags=("-I$GMP_PREFIX/include" "-L$GMP_PREFIX/lib" "-Wl,-rpath,$GMP_PREFIX/lib")
fi
"$kircracker_cxx" "${kircracker_gmp_flags[@]}" -std=c++20 "$kircracker_check_dir/check.cpp" -lgmpxx -lgmp -o "$kircracker_check_dir/check"
"$kircracker_check_dir/check"
printf '%s\n' 'C++20, Python and GMP are available.'
