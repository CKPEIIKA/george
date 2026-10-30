// SPDX-License-Identifier: MIT
// Independent explicit prefix-twisted INTEGER-polynomial derivatives.
// No discovery recursion, suffix permutation cache, or modular polynomial arithmetic.
//
// For d<=24 the l1 growth of a scalar derivative entry is bounded by d!.
// 24! = 620448401733239439360000 < 2^80, so signed __int128 is exact with
// enormous headroom.  This is the only arithmetic extension needed beyond the
// old d<=20/int64 verifier.  128-bit packed words remain valid through degree 31.
#include "modular_determinant.hpp"
#include "pairing_limits.hpp"
#include "polynomial_workspace.hpp"
#include <algorithm>
#include <array>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <limits>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <type_traits>
#include <unordered_map>
#include <vector>
using U = __uint128_t;
using Count = uint64_t;
using Z = __int128_t;
using UZ = __uint128_t;
static constexpr int MAX_EXACT_DEGREE = kir::exact_degree;
constexpr UZ factorial_bound(int degree) {
  UZ value = 1;
  for (int i = 2; i <= degree; i++)
    value *= i;
  return value;
}
static_assert(factorial_bound(MAX_EXACT_DEGREE) < (UZ(1) << 127),
              "exact derivative coefficient width");
static_assert(MAX_EXACT_DEGREE * 4 < 128, "packed derivative word width");

struct WordHash {
  size_t operator()(U w) const {
    uint64_t x =
        uint64_t(w) ^ ((uint64_t(w >> 64) + 0x9e3779b97f4a7c15ULL) * 0xbf58476d1ce4e5b9ULL);
    x ^= x >> 30;
    x *= 0xbf58476d1ce4e5b9ULL;
    x ^= x >> 27;
    return x ^ (x >> 31);
  }
};
using Poly = std::unordered_map<U, Z, WordHash>;
static thread_local std::string verify_error;
extern "C" const char *kv_last_error() { return verify_error.c_str(); }
static Z add_checked(Z a, Z b) {
  Z out;
  if (__builtin_add_overflow(a, b, &out))
    throw std::overflow_error("exact derivative accumulator overflow");
  return out;
}
struct Node {
  std::array<int, 15> next;
  std::vector<int> rows;
  Node() { next.fill(-1); }
};
static UZ zabs(Z x) { return x < 0 ? UZ(-(x + 1)) + 1 : UZ(x); } // safe even for minimum Z
static unsigned zbits(Z x) {
  UZ v = zabs(x);
  unsigned b = 0;
  while (v) {
    v >>= 1;
    b++;
  }
  return b;
}
struct Verifier {
  int n, d, ne;
  std::array<std::pair<int, int>, 15> edges{};
  int eid[6][6]{};
  int perm[15][15]{};
  std::vector<Node> trie{1};
  Verifier(int N, int D, const U *us, int nu) : n(N), d(D) {
    ne = 0;
    for (int i = 0; i < n; i++)
      for (int j = i + 1; j < n; j++) {
        edges[ne] = {i, j};
        eid[i][j] = eid[j][i] = ne++;
      }
    for (int e = 0; e < ne; e++)
      for (int f = 0; f < ne; f++) {
        auto [a, b] = edges[e];
        auto [x0, y0] = edges[f];
        int x = x0, y = y0;
        x = x == a ? b : x == b ? a : x;
        y = y == a ? b : y == b ? a : y;
        perm[e][f] = (x < y ? 1 : -1) * (eid[x][y] + 1);
      }
    for (int i = 0; i < nu; i++) {
      U u = us[i];
      int at = 0;
      for (int j = 0; j < d; j++) {
        int e = int(u & 15) - 1;
        u >>= 4;
        if (e < 0 || e >= ne)
          throw 1;
        int nx = trie[at].next[e];
        if (nx < 0) {
          nx = trie.size();
          trie[at].next[e] = nx;
          trie.emplace_back();
        }
        at = nx;
      }
      if (u)
        throw 2;
      trie[at].rows.push_back(i);
    }
  }
  U mask(int l) const { return l >= 32 ? ~U(0) : (U(1) << (4 * l)) - 1; }
  Poly derivative(const Poly &input, int e, int len) const {
    Poly out;
    for (auto [word, c] : input) {
      U prefix = 0;
      int sign = 1;
      for (int j = 0; j < len; j++) {
        int shift = 4 * (len - j - 1);
        int f = int((word >> shift) & 15) - 1;
        if (f == e) {
          U v = (prefix << shift) | (word & mask(len - j - 1));
          out[v] = add_checked(out[v], sign < 0 ? -c : c);
        }
        int t = perm[e][f];
        prefix = (prefix << 4) | unsigned(std::abs(t));
        if (t < 0)
          sign = -sign;
      }
    }
    for (auto it = out.begin(); it != out.end();)
      if (!it->second)
        it = out.erase(it);
      else
        ++it;
    return out;
  }
  template <class T> void walk(int node, const Poly &poly, int len, int col, int nv, T *out) const {
    if (poly.empty())
      return;
    if (!len) {
      auto it = poly.find(0);
      if (it != poly.end())
        for (int row : trie[node].rows) {
          if constexpr (std::is_same_v<T, int64_t>) {
            if (it->second < std::numeric_limits<int64_t>::min() ||
                it->second > std::numeric_limits<int64_t>::max())
              throw 4;
          }
          out[(size_t)row * nv + col] = T(it->second);
        }
      return;
    }
    for (int e = 0; e < ne; e++)
      if (trie[node].next[e] >= 0) {
        Poly child = derivative(poly, e, len);
        walk(trie[node].next[e], child, len - 1, col, nv, out);
      }
  }
  struct Work {
    std::vector<WordWorkspace<Z>> levels;
    size_t term_limit = kir::polynomial_term_limit();
    explicit Work(int degree) : levels(degree + 1) {}
  };
  void derivative_flat(const WordWorkspace<Z> &input, WordWorkspace<Z> &out, int edge, int len,
                       size_t term_limit) const {
    out.clear();
    for (auto entry : input.data())
      if (entry.value) {
        U prefix = 0;
        int sign = 1;
        for (int j = 0; j < len; j++) {
          int shift = 4 * (len - j - 1), letter = int((entry.word >> shift) & 15) - 1;
          if (letter == edge) {
            U word = (prefix << shift) | (entry.word & mask(len - j - 1));
            out.add(word, sign < 0 ? -entry.value : entry.value, add_checked, term_limit);
          }
          int mapped = perm[edge][letter];
          prefix = (prefix << 4) | unsigned(std::abs(mapped));
          if (mapped < 0)
            sign = -sign;
        }
      }
  }
  void walk_flat(int node, int len, int col, int stride, Z *out, Work &work) const {
    const auto &poly = work.levels[len];
    bool any = false;
    for (auto entry : poly.data())
      if (entry.value) {
        any = true;
        break;
      }
    if (!any)
      return;
    if (!len) {
      for (auto entry : poly.data())
        if (entry.word == 0)
          for (int row : trie[node].rows)
            out[size_t(row) * stride + col] = entry.value;
      return;
    }
    for (int edge = 0; edge < ne; edge++)
      if (trie[node].next[edge] >= 0) {
        derivative_flat(poly, work.levels[len - 1], edge, len, work.term_limit);
        walk_flat(trie[node].next[edge], len - 1, col, stride, out, work);
      }
  }
  void column_flat(U word, int col, int stride, Z *out, Work &work) const {
    work.levels[d].clear();
    work.levels[d].add(word, Z(1), add_checked, 1);
    walk_flat(0, d, col, stride, out, work);
  }
};
static int validate_words(int n, int d, const U *vs, int nv) {
  if (n < 2 || n > 6 || d < 0 || d > MAX_EXACT_DEGREE || nv < 1)
    return 1;
  int ne = n * (n - 1) / 2;
  for (int j = 0; j < nv; j++) {
    U w = vs[j];
    for (int k = 0; k < d; k++) {
      int e = int(w & 15) - 1;
      w >>= 4;
      if (e < 0 || e >= ne)
        return 2;
    }
    if (w)
      return 2;
  }
  return 0;
}
static int matrix_impl64(int n, int d, const U *us, int nu, const U *vs, int nv, int64_t *out,
                         int threads) {
  if (n < 2 || n > 6 || d < 0 || d > 20 || nu < 1 || nv < 1 || threads < 1 || threads > 16)
    return 1;
  try {
    Verifier v(n, d, us, nu);
    if (int q = validate_words(n, d, vs, nv))
      return q;
    std::fill(out, out + (size_t)nu * nv, 0);
    std::atomic<int> next{0}, bad{0};
    auto run = [&]() {
      try {
        for (;;) {
          int j = next++;
          if (j >= nv)
            break;
          v.walk(0, Poly{{vs[j], 1}}, d, j, nv, out);
        }
      } catch (...) {
        bad = 1;
      }
    };
    std::vector<std::thread> pool;
    try {
      for (int k = 1; k < threads; k++)
        pool.emplace_back(run);
      run();
    } catch (...) {
      bad = 1;
      next = nv;
    }
    for (auto &t : pool)
      if (t.joinable())
        t.join();
    return bad ? 3 : 0;
  } catch (...) {
    return 3;
  }
}
extern "C" int kv_matrix(int n, int d, const Count *us, int nu, const Count *vs, int nv,
                         int64_t *out, int threads) {
  if (d < 0 || d > 16 || nu < 1 || nv < 1 || !us || !vs || !out)
    return 1;
  try {
    std::vector<U> u(nu), v(nv);
    for (int i = 0; i < nu; i++)
      u[i] = us[i];
    for (int i = 0; i < nv; i++)
      v[i] = vs[i];
    return matrix_impl64(n, d, u.data(), nu, v.data(), nv, out, threads);
  } catch (...) {
    return 3;
  }
}
extern "C" int kv_matrix_wide(int n, int d, const Count *us, int nu, const Count *vs, int nv,
                              int64_t *out, int threads) {
  if (d < 0 || d > 20 || nu < 1 || nv < 1 || !us || !vs || !out)
    return 1;
  try {
    std::vector<U> u(nu), v(nv);
    for (int i = 0; i < nu; i++)
      u[i] = U(us[2 * i]) | (U(us[2 * i + 1]) << 64);
    for (int i = 0; i < nv; i++)
      v[i] = U(vs[2 * i]) | (U(vs[2 * i + 1]) << 64);
    return matrix_impl64(n, d, u.data(), nu, v.data(), nv, out, threads);
  } catch (...) {
    return 3;
  }
}
extern "C" int kv_det_mod(int n, const int64_t *input, int p) {
  if (n < 0 || n > 10000 || !input || p < 2 || p > 1000000007)
    return -1;
  try {
    std::vector<int> a((size_t)n * n);
    for (size_t k = 0; k < a.size(); k++) {
      int64_t v = input[k] % p;
      if (v < 0)
        v += p;
      a[k] = int(v);
    }
    int64_t det = 1;
    for (int j = 0; j < n; j++) {
      int pivot = j;
      while (pivot < n && !a[(size_t)pivot * n + j])
        pivot++;
      if (pivot == n)
        return 0;
      if (pivot != j) {
        for (int k = 0; k < n; k++)
          std::swap(a[(size_t)j * n + k], a[(size_t)pivot * n + k]);
        det = (p - det) % p;
      }
      int v = a[(size_t)j * n + j];
      det = det * v % p;
      int64_t inv = 1, x = v;
      int exp = p - 2;
      while (exp) {
        if (exp & 1)
          inv = inv * x % p;
        x = x * x % p;
        exp >>= 1;
      }
      for (int i = j + 1; i < n; i++)
        if (a[(size_t)i * n + j]) {
          int64_t c = a[(size_t)i * n + j] * inv % p;
          a[(size_t)i * n + j] = 0;
          for (int k = j + 1; k < n; k++) {
            int64_t z = a[(size_t)i * n + k] - c * a[(size_t)j * n + k] % p;
            if (z < 0)
              z += p;
            a[(size_t)i * n + k] = int(z);
          }
        }
    }
    return int(det);
  } catch (...) {
    return -2;
  }
}
static int compact_impl(int n, int d, const Count *us, const Count *vs, int rank, int prime,
                        int threads, int tile, const int32_t *expected, int32_t *detout,
                        Count *stats, bool wideStats) {
  if (!us || !vs || !detout || !stats || rank < 1 || rank > kir::minor_rank || prime < 3 ||
      prime > 1000000007 || tile < 1 || tile > 1024 || threads < 1 || threads > 16 || d < 0 ||
      d > MAX_EXACT_DEGREE)
    return 1;
  for (int q = 2; int64_t(q) * q <= prime; q++)
    if (prime % q == 0)
      return 1;
  try {
    verify_error.clear();
    auto started = std::chrono::steady_clock::now();
    std::vector<int32_t> a((size_t)rank * rank);
    uint64_t entries = 0, maxabs64 = 0, nonzero_entries = 0;
    unsigned maxbits = 0;
    std::vector<U> u(rank), v(rank);
    for (int i = 0; i < rank; i++) {
      u[i] = U(us[2 * i]) | (U(us[2 * i + 1]) << 64);
      v[i] = U(vs[2 * i]) | (U(vs[2 * i + 1]) << 64);
    }
    if (int q = validate_words(n, d, v.data(), rank))
      return q;
    Verifier verifier(n, d, u.data(), rank);
    bool reference_accumulator = false;
    if (const char *mode = std::getenv("KIR_VERIFY_ACCUMULATOR")) {
      std::string name(mode);
      if (name != "flat" && name != "reference")
        throw std::runtime_error("verifier accumulator: flat or reference");
      reference_accumulator = name == "reference";
    }

    std::unique_ptr<Verifier::Work> serial_workspace;
    if (threads == 1)
      serial_workspace = std::make_unique<Verifier::Work>(d);
    for (int col = 0; col < rank; col += tile) {
      int nc = std::min(tile, rank - col);
      std::vector<Z> raw((size_t)rank * nc);
      std::atomic<int> next{0}, bad{0};
      std::mutex error_mutex;
      std::string error;
      auto work = [&]() {
        try {
          Verifier::Work local_workspace(d);
          auto &workspace = serial_workspace ? *serial_workspace : local_workspace;
          for (;;) {
            int j = next++;
            if (j >= nc)
              break;
            if (reference_accumulator)
              verifier.walk(0, Poly{{v[col + j], 1}}, d, j, nc, raw.data());
            else
              verifier.column_flat(v[col + j], j, nc, raw.data(), workspace);
          }
        } catch (const std::exception &e) {
          std::lock_guard<std::mutex> guard(error_mutex);
          bad = 1;
          error = e.what();
        } catch (...) {
          std::lock_guard<std::mutex> guard(error_mutex);
          bad = 1;
          error = "invalid exact derivative input";
        }
      };
      std::vector<std::thread> pool;
      try {
        for (int i = 1; i < threads && i < nc; i++)
          pool.emplace_back(work);
        work();
      } catch (...) {
        bad = 1;
        next = nc;
      }
      for (auto &t : pool)
        t.join();
      if (bad) {
        verify_error = error;
        return 3;
      }
      for (int i = 0; i < rank; i++)
        for (int j = 0; j < nc; j++) {
          Z z = raw[(size_t)i * nc + j];
          unsigned bits = zbits(z);
          maxbits = std::max(maxbits, bits);
          UZ av = zabs(z);
          if (!wideStats) {
            if (av > std::numeric_limits<uint64_t>::max())
              return 6;
            maxabs64 = std::max(maxabs64, uint64_t(av));
          }
          Z rem = z % prime;
          if (rem < 0)
            rem += prime;
          int32_t m = int(rem);
          size_t pos = (size_t)i * rank + col + j;
          if (expected && expected[pos] != m)
            return 4;
          a[pos] = m;
          nonzero_entries += (m != 0);
          entries++;
        }
    }
    auto entries_done = std::chrono::steady_clock::now();
    std::fprintf(stderr,
                 "{\"type\":\"verification_entries_complete\",\"rank\":%d,\"entries\":%llu,"
                 "\"seconds\":%.3f}\n",
                 rank, (unsigned long long)entries,
                 std::chrono::duration<double>(entries_done - started).count());
    std::fflush(stderr);
    int det = exact_modular_determinant(rank, a.data(), prime, nonzero_entries);
    *detout = det;
    stats[0] = entries;
    stats[1] = wideStats ? maxbits : maxabs64;
    return det ? 0 : 5;
  } catch (const std::bad_alloc &) {
    verify_error = "independent replay memory allocation failed";
    return 7;
  } catch (const std::exception &e) {
    verify_error = e.what();
    return 3;
  } catch (...) {
    verify_error = "invalid verifier input";
    return 3;
  }
}
extern "C" int kv_verify_compact(int n, int d, const Count *us, const Count *vs, int rank,
                                 int prime, int threads, int tile, const int32_t *expected,
                                 int32_t *detout, Count *stats) {
  if (d > 20)
    return 1;
  return compact_impl(n, d, us, vs, rank, prime, threads, tile, expected, detout, stats, false);
}
// Wide ABI for d=21..24.  stats[1] is the maximum exact INTEGER entry bit length,
// not a truncated magnitude.  The determinant is still computed modulo `prime`.
extern "C" int kv_verify_compact128(int n, int d, const Count *us, const Count *vs, int rank,
                                    int prime, int threads, int tile, const int32_t *expected,
                                    int32_t *detout, Count *stats) {
  if (d < 0 || d > MAX_EXACT_DEGREE)
    return 1;
  return compact_impl(n, d, us, vs, rank, prime, threads, tile, expected, detout, stats, true);
}

#include "verified_lu.inc"
