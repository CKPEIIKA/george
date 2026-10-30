#pragma once
// SPDX-License-Identifier: MIT
// Independent modular determinant: panel LU followed by exact blocked Schur
// updates. The panel multipliers stay below the diagonal until their update.
#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>
template <int FixedPrime = 0> static int determinant_blocked(int n, int32_t *a, int field) {
  const int p = FixedPrime ? FixedPrime : field;
  int64_t determinant = 1;
  constexpr int panel = 32, tile = 64;
  const uint64_t max_product = uint64_t(p - 1) * uint64_t(p - 1);
  const int products =
      std::min(32, int(std::min(uint64_t(32), std::numeric_limits<uint64_t>::max() /
                                                  std::max(uint64_t(1), max_product))));
  auto subtract = [&](int32_t &at, int factor, int value) {
    int64_t next = int64_t(at) - int64_t(factor) * value % p;
    if (next < 0)
      next += p;
    at = int(next);
  };
  for (int first = 0; first < n; first += panel) {
    int end = std::min(n, first + panel);
    for (int j = first; j < end; j++) {
      int pivot = j;
      while (pivot < n && !a[size_t(pivot) * n + j])
        pivot++;
      if (pivot == n)
        return 0;
      if (pivot != j) {
        for (int k = first; k < n; k++)
          std::swap(a[size_t(pivot) * n + k], a[size_t(j) * n + k]);
        determinant = (p - determinant) % p;
      }
      int value = a[size_t(j) * n + j];
      determinant = determinant * value % p;
      int64_t inverse = 1, x = value;
      int power = p - 2;
      while (power) {
        if (power & 1)
          inverse = inverse * x % p;
        x = x * x % p;
        power >>= 1;
      }
      // Complete this pivot row's trailing U using the earlier panel columns.
      for (int q = first; q < j; q++)
        if (int factor = a[size_t(j) * n + q])
          for (int k = end; k < n; k++)
            subtract(a[size_t(j) * n + k], factor, a[size_t(q) * n + k]);
      for (int i = j + 1; i < n; i++)
        if (int entry = a[size_t(i) * n + j]) {
          int factor = int(int64_t(entry) * inverse % p);
          a[size_t(i) * n + j] = factor;
          for (int k = j + 1; k < end; k++)
            subtract(a[size_t(i) * n + k], factor, a[size_t(j) * n + k]);
        }
    }
    for (int i = end; i < n; i++)
      for (int block = end; block < n; block += tile) {
        int width = std::min(tile, n - block);
        for (int q0 = first; q0 < end; q0 += products) {
          int qe = std::min(end, q0 + products);
          uint64_t sums[tile]{};
          for (int q = q0; q < qe; q++)
            if (int factor = a[size_t(i) * n + q])
              for (int k = 0; k < width; k++)
                sums[k] += uint64_t(factor) * uint64_t(a[size_t(q) * n + block + k]);
          for (int k = 0; k < width; k++) {
            int64_t value = int64_t(a[size_t(i) * n + block + k]) - int64_t(sums[k] % p);
            if (value < 0)
              value += p;
            a[size_t(i) * n + block + k] = int(value);
          }
        }
      }
  }
  return int(determinant);
}
template <int FixedPrime = 0> static int determinant_sparse(int n, int32_t *a, int field) {
  const int p = FixedPrime ? FixedPrime : field;
  int64_t det = 1;
  std::vector<int> nonzero;
  for (int j = 0; j < n; j++) {
    int pivot = j;
    while (pivot < n && !a[size_t(pivot) * n + j])
      pivot++;
    if (pivot == n)
      return 0;
    if (pivot != j) {
      for (int k = j; k < n; k++)
        std::swap(a[size_t(pivot) * n + k], a[size_t(j) * n + k]);
      det = (p - det) % p;
    }
    int value = a[size_t(j) * n + j];
    det = det * value % p;
    int64_t inverse = 1, x = value;
    int exponent = p - 2;
    while (exponent) {
      if (exponent & 1)
        inverse = inverse * x % p;
      x = x * x % p;
      exponent >>= 1;
    }
    nonzero.clear();
    for (int k = j + 1; k < n; k++)
      if (a[size_t(j) * n + k])
        nonzero.push_back(k);
    for (int i = j + 1; i < n; i++)
      if (a[size_t(i) * n + j]) {
        int factor = int(int64_t(a[size_t(i) * n + j]) * inverse % p);
        a[size_t(i) * n + j] = 0;
        for (int k : nonzero) {
          int64_t result =
              int64_t(a[size_t(i) * n + k]) - int64_t(factor) * a[size_t(j) * n + k] % p;
          if (result < 0)
            result += p;
          a[size_t(i) * n + k] = int(result);
        }
      }
  }
  return int(det);
}
static int exact_modular_determinant(int n, int32_t *a, int prime, uint64_t nonzero) {
  std::string mode = "auto";
  if (const char *value = std::getenv("KIR_VERIFY_DETERMINANT"))
    mode = value;
  if (mode != "auto" && mode != "sparse" && mode != "blocked")
    throw std::runtime_error("verifier determinant: auto, sparse or blocked");
  bool sparse = mode == "sparse" || (mode == "auto" && (n < 64 || nonzero < uint64_t(n) * n / 5));
  if (sparse)
    return prime == 1000003 ? determinant_sparse<1000003>(n, a, prime)
                            : determinant_sparse<0>(n, a, prime);
  return prime == 1000003 ? determinant_blocked<1000003>(n, a, prime)
                          : determinant_blocked<0>(n, a, prime);
}
