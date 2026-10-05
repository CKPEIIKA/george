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
#include <boost/multiprecision/cpp_int.hpp>
#include <gmpxx.h>
int main() { boost::multiprecision::cpp_int a=1; mpq_class q(1,2); return a!=1 || q!=mpq_class(1,2); }
CPP
"$kircracker_cxx" -std=c++17 "$kircracker_check_dir/check.cpp" -lgmpxx -lgmp -o "$kircracker_check_dir/check"
"$kircracker_check_dir/check"
printf '%s\n' 'C++17, Python, Boost and GMP are available.'
