#pragma once
// SPDX-License-Identifier: MIT
#include <cstdint>
#include <vector>
struct SparseEntry {
  int index, value;
};
using SparseRow = std::vector<SparseEntry>;
static inline int modpow(int a, int prime) {
  int64_t value = a, result = 1;
  int exponent = prime - 2;
  while (exponent) {
    if (exponent & 1)
      result = result * value % prime;
    value = value * value % prime;
    exponent >>= 1;
  }
  return int(result);
}
