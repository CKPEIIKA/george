// SPDX-License-Identifier: MIT
// Exact controls for pivot arithmetic, independent determinants and journals.
#include "modular_determinant.hpp"
#include "pair_journal.hpp"
#include "polynomial_workspace.hpp"
#include <cassert>
#include <iostream>
#include <map>
#include <random>
#include <unordered_map>

static int reference_det(std::vector<int32_t> a, int n, int p) {
  int64_t det = 1;
  for (int j = 0; j < n; ++j) {
    int h = j;
    while (h < n && !a[size_t(h) * n + j]) ++h;
    if (h == n) return 0;
    if (h != j) {
      for (int k = 0; k < n; ++k) std::swap(a[size_t(j) * n + k], a[size_t(h) * n + k]);
      det = (p - det) % p;
    }
    int pivot = a[size_t(j) * n + j];
    det = det * pivot % p;
    int inverse = modpow(pivot, p);
    for (int i = j + 1; i < n; ++i) {
      int64_t c = int64_t(a[size_t(i) * n + j]) * inverse % p;
      for (int k = j; k < n; ++k) {
        int64_t v = int64_t(a[size_t(i) * n + k]) - c * a[size_t(j) * n + k] % p;
        a[size_t(i) * n + k] = int(v < 0 ? v + p : v);
      }
    }
  }
  return int(det);
}
static void same_pivots(const ModularRank &a, const ModularRank &b) {
  assert(a.rows == b.rows && a.columns == b.columns);
  for (int h : a.rows) {
    SparseRow x, y;
    a.pivots[h].each(h, [&](int j, int c) { x.push_back({j, c}); });
    b.pivots[h].each(h, [&](int j, int c) { y.push_back({j, c}); });
    assert(x.size() == y.size());
    for (size_t i = 0; i < x.size(); ++i) assert(x[i].index == y[i].index && x[i].value == y[i].value);
  }
}
int main(int argc, char **argv) {
  assert(argc == 2);
  std::mt19937_64 gen(0x4b49524e554dULL);
  int matrices = 0;
  for (int prime : {3, 101, 31991, 1000003, 1000000007})
    for (int n : {0, 1, 2, 7, 31, 32, 33, 63, 64, 65, 95, 96, 97})
      for (int trial = 0; trial < 4; ++trial) {
        std::vector<int32_t> a(size_t(n) * n);
        for (auto &v : a) v = trial == 0 || gen() % 5 == 0 ? 0 : gen() % prime;
        if (trial == 2 && n > 1)
          std::copy(a.begin(), a.begin() + n, a.begin() + n);
        int expected = reference_det(a, n, prime);
        auto b = a, c = a;
        assert(determinant_sparse(n, b.data(), prime) == expected);
        assert(determinant_blocked(n, c.data(), prime) == expected);
        if (prime == 1000003) {
          b = a; c = a;
          assert(determinant_sparse<1000003>(n, b.data(), prime) == expected);
          assert(determinant_blocked<1000003>(n, c.data(), prime) == expected);
        }
        ++matrices;
      }
  for (int prime : {101, 1000003}) {
    ModularRank sparse(73, prime, 1), dense(73, prime, 0), mixed(73, prime, .55);
    for (int c = 0; c < 120; ++c) {
      std::vector<int> a(73);
      for (int &v : a) v = c % 4 == 0 ? 0 : gen() % prime;
      auto b = a, z = a;
      bool x = sparse.offer(a, c);
      assert(dense.offer(b, c) == x && mixed.offer(z, c) == x);
    }
    same_pivots(sparse, dense); same_pivots(sparse, mixed);
    assert(sparse.rank() == 73);
  }
  WordWorkspace<int64_t> workspace;
  for (int run = 0; run < 60; ++run) {
    workspace.clear(); std::map<__uint128_t, int64_t> expected;
    for (int j = 0; j < 1200; ++j) {
      __uint128_t w = (__uint128_t(gen() % 7) << 64) | (gen() % 23);
      int64_t v = int64_t(gen() % 11) - 5;
      expected[w] += v;
      workspace.add(w, v, [](auto a, auto b) { return a + b; }, 1000);
    }
    for (auto e : workspace.data()) { assert(e.value == expected[e.word]); expected.erase(e.word); }
    for (auto [w, v] : expected) { (void)w; assert(v == 0); }
  }
  const std::string binding(64, 'a');
  auto path = std::filesystem::path(argv[1]) / "discovery.state";
  ModularRank rank(80, 1000003);
  kir::PairJournal journal(path.string(), binding, 6, 1000003, 23, 80, 120);
  int cursor = 0;
  for (; cursor < 20; ++cursor) {
    std::vector<int> a(80); for (int &v : a) v = gen() % 1000003;
    rank.offer(a, cursor);
  }
  journal.save(rank, cursor);
  auto published = kir::read_small(path, 1 << 20).data;
  std::map<std::string, std::vector<unsigned char>> chunks;
  for (const auto &f : std::filesystem::directory_iterator(path.string() + ".parts"))
    chunks[f.path().string()] = kir::read_small(f.path(), 1 << 20).data;
  for (; cursor < 40; ++cursor) {
    std::vector<int> a(80); for (int &v : a) v = gen() % 1000003;
    rank.offer(a, cursor);
  }
  setenv("KIR_CHECKPOINT_BYTES", "1", 1);
  bool refused = false;
  try { journal.save(rank, cursor); } catch (const std::runtime_error &) { refused = true; }
  assert(refused && kir::read_small(path, 1 << 20).data == published);
  unsetenv("KIR_CHECKPOINT_BYTES");
  journal.save(rank, cursor);
  for (const auto &[name, data] : chunks) assert(kir::read_small(name, 1 << 20).data == data);
  ModularRank restored(80, 1000003);
  kir::PairJournal reader(path.string(), binding, 6, 1000003, 23, 80, 120);
  assert(reader.load(restored) == cursor); same_pivots(rank, restored);
  auto before = reader.written_bytes;
  reader.save(restored, cursor + 1);
  assert(reader.written_bytes - before < 4096);
  bool wrong_binding = false;
  try {
    ModularRank bad(80, 1000003);
    kir::PairJournal wrong(path.string(), std::string(64, 'b'), 6, 1000003, 23, 80, 120);
    wrong.load(bad);
  } catch (const std::runtime_error &) { wrong_binding = true; }
  assert(wrong_binding);
  auto file = std::filesystem::directory_iterator(path.string() + ".parts")->path();
  auto raw = kir::read_small(file, 1 << 20).data; raw.back() ^= 1;
  kir::durable_write(file, raw);
  bool corrupt = false;
  try {
    ModularRank bad(80, 1000003);
    kir::PairJournal broken(path.string(), binding, 6, 1000003, 23, 80, 120);
    broken.load(bad);
  } catch (const std::runtime_error &) { corrupt = true; }
  assert(corrupt);
  std::cout << "{\"determinantCases\":" << matrices << ",\"passed\":true}\n";
}
