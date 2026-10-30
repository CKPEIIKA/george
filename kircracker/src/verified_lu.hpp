#pragma once
// SPDX-License-Identifier: MIT
// Exact pivoted LU with retained multipliers. Unlike determinant-only elimination,
// every row swap includes earlier L columns, so the saved factors are reusable.
#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <numeric>
#include <stdexcept>
#include <string>
#include <vector>

namespace kir_lu {
template <int Fixed = 0> struct Field {
  int p;
  explicit Field(int prime) : p(Fixed ? Fixed : prime) {}
  int mul(int a, int b) const { return int(int64_t(a) * b % p); }
  int inverse(int a) const {
    if (!a) throw std::runtime_error("zero LU pivot");
    int x = a, out = 1;
    for (int e = p - 2; e; e >>= 1, x = mul(x, x))
      if (e & 1) out = mul(out, x);
    return out;
  }
  int subtract(int a, uint64_t sum) const {
    int64_t x = int64_t(a) - int64_t(sum % p);
    return int(x < 0 ? x + p : x);
  }
  int chunk() const {
    return int(std::min<uint64_t>(32, std::numeric_limits<uint64_t>::max() /
                                       (uint64_t(p - 1) * (p - 1))));
  }
};

template <int Fixed = 0>
int blocked(int n, int32_t *a, int start, std::vector<int> &rows, int prime) {
  Field<Fixed> f(prime);
  int det = 1;
  constexpr int panel = 32, tile = 64;
  const int chunk = f.chunk();
  for (int first = start; first < n; first += panel) {
    int end = std::min(n, first + panel);
    for (int j = first; j < end; j++) {
      int pivot = j;
      while (pivot < n && !a[size_t(pivot) * n + j]) pivot++;
      if (pivot == n) return 0;
      if (pivot != j) {
        for (int k = 0; k < n; k++)
          std::swap(a[size_t(pivot) * n + k], a[size_t(j) * n + k]);
        std::swap(rows[pivot], rows[j]);
        det = f.p - det;
      }
      int value = a[size_t(j) * n + j];
      det = f.mul(det, value);
      int inv = f.inverse(value);
      for (int q = first; q < j; q++)
        if (int factor = a[size_t(j) * n + q])
          for (int k = end; k < n; k++)
            a[size_t(j) * n + k] =
                f.subtract(a[size_t(j) * n + k], uint64_t(factor) * a[size_t(q) * n + k]);
      for (int i = j + 1; i < n; i++)
        if (int entry = a[size_t(i) * n + j]) {
          int factor = f.mul(entry, inv);
          a[size_t(i) * n + j] = factor;
          for (int k = j + 1; k < end; k++)
            a[size_t(i) * n + k] =
                f.subtract(a[size_t(i) * n + k], uint64_t(factor) * a[size_t(j) * n + k]);
        }
    }
    for (int i = end; i < n; i++)
      for (int col = end; col < n; col += tile) {
        int width = std::min(tile, n - col);
        for (int q0 = first; q0 < end; q0 += chunk) {
          uint64_t sums[tile]{};
          for (int q = q0; q < std::min(end, q0 + chunk); q++)
            if (int c = a[size_t(i) * n + q])
              for (int k = 0; k < width; k++)
                sums[k] += uint64_t(c) * a[size_t(q) * n + col + k];
          for (int k = 0; k < width; k++)
            a[size_t(i) * n + col + k] = f.subtract(a[size_t(i) * n + col + k], sums[k]);
        }
      }
  }
  return det;
}

template <int Fixed = 0>
int factor(int n, int32_t *a, int start, std::vector<int> &rows, int prime) {
  Field<Fixed> f(prime);
  std::string mode = "auto";
  if (const char *v = std::getenv("KIR_VERIFY_LU_MODE")) mode = v;
  if (mode != "auto" && mode != "sparse" && mode != "blocked")
    throw std::runtime_error("LU mode: auto, sparse or blocked");
  if (mode == "blocked") return blocked<Fixed>(n, a, start, rows, prime);
  int det = 1;
  std::vector<int> nz;
  for (int j = start; j < n; j++) {
    int pivot = j;
    while (pivot < n && !a[size_t(pivot) * n + j]) pivot++;
    if (pivot == n) return 0;
    // Observe fill during elimination, rather than deciding from initial density.
    if (mode == "auto" && n - j >= 128 && (j - start) % 16 == 0) {
      int rn = 0, cn = 0;
      for (int k = j + 1; k < n; k++) {
        rn += a[size_t(pivot) * n + k] != 0;
        cn += a[size_t(k) * n + j] != 0;
      }
      if (rn > (n - j) / 8 && cn > (n - j) / 8)
        return f.mul(det, blocked<Fixed>(n, a, j, rows, prime));
    }
    if (pivot != j) {
      for (int k = 0; k < n; k++)
        std::swap(a[size_t(pivot) * n + k], a[size_t(j) * n + k]);
      std::swap(rows[pivot], rows[j]);
      det = f.p - det;
    }
    int value = a[size_t(j) * n + j], inv = f.inverse(value);
    det = f.mul(det, value);
    nz.clear();
    for (int k = j + 1; k < n; k++)
      if (a[size_t(j) * n + k]) nz.push_back(k);
    for (int i = j + 1; i < n; i++)
      if (int entry = a[size_t(i) * n + j]) {
        int c = f.mul(entry, inv);
        a[size_t(i) * n + j] = c;
        for (int k : nz)
          a[size_t(i) * n + k] =
              f.subtract(a[size_t(i) * n + k], uint64_t(c) * a[size_t(j) * n + k]);
      }
  }
  return det;
}

// Transform [A B; C D], where A already stores LU, to a factorization using
// L^-1 B, C U^-1 and the exact Schur complement D - (C U^-1)(L^-1 B).
template <int Fixed = 0>
void extend(int n, int32_t *a, int old, int prime) {
  Field<Fixed> f(prime);
  constexpr int panel = 32, tile = 64;
  int chunk = f.chunk();
  for (int first = 0; first < old; first += panel) {
    int end = std::min(old, first + panel);
    for (int i = first; i < end; i++)
      for (int q = first; q < i; q++)
        if (int c = a[size_t(i) * n + q])
          for (int j = old; j < n; j++)
            a[size_t(i) * n + j] =
                f.subtract(a[size_t(i) * n + j], uint64_t(c) * a[size_t(q) * n + j]);
    for (int i = end; i < old; i++)
      for (int col = old; col < n; col += tile) {
        int width = std::min(tile, n - col);
        for (int q0 = first; q0 < end; q0 += chunk) {
          uint64_t sums[tile]{};
          for (int q = q0; q < std::min(end, q0 + chunk); q++)
            if (int c = a[size_t(i) * n + q])
              for (int j = 0; j < width; j++)
                sums[j] += uint64_t(c) * a[size_t(q) * n + col + j];
          for (int j = 0; j < width; j++)
            a[size_t(i) * n + col + j] = f.subtract(a[size_t(i) * n + col + j], sums[j]);
        }
      }
  }
  std::vector<int> inverses(old);
  for (int j = 0; j < old; j++) inverses[j] = f.inverse(a[size_t(j) * n + j]);
  for (int first = 0; first < old; first += panel) {
    int end = std::min(old, first + panel);
    for (int i = old; i < n; i++) {
      for (int j = first; j < end; j++) {
        int v = a[size_t(i) * n + j];
        for (int q = first; q < j; q++)
          v = f.subtract(v, uint64_t(a[size_t(i) * n + q]) * a[size_t(q) * n + j]);
        a[size_t(i) * n + j] = f.mul(v, inverses[j]);
      }
      for (int col = end; col < old; col += tile) {
        int width = std::min(tile, old - col);
        for (int q0 = first; q0 < end; q0 += chunk) {
          uint64_t sums[tile]{};
          for (int q = q0; q < std::min(end, q0 + chunk); q++)
            if (int c = a[size_t(i) * n + q])
              for (int j = 0; j < width; j++)
                sums[j] += uint64_t(c) * a[size_t(q) * n + col + j];
          for (int j = 0; j < width; j++)
            a[size_t(i) * n + col + j] = f.subtract(a[size_t(i) * n + col + j], sums[j]);
        }
      }
    }
  }
  for (int i = old; i < n; i++)
    for (int col = old; col < n; col += tile) {
      int width = std::min(tile, n - col);
      for (int q0 = 0; q0 < old; q0 += chunk) {
        uint64_t sums[tile]{};
        for (int q = q0; q < std::min(old, q0 + chunk); q++)
          if (int c = a[size_t(i) * n + q])
            for (int j = 0; j < width; j++)
              sums[j] += uint64_t(c) * a[size_t(q) * n + col + j];
        for (int j = 0; j < width; j++)
          a[size_t(i) * n + col + j] = f.subtract(a[size_t(i) * n + col + j], sums[j]);
      }
    }
}
} // namespace kir_lu
