// SPDX-License-Identifier: MIT
// Modular suffix discovery. Mathematical acceptance uses the independent
// prefix-integer verifier; discovery journals are recovery data only.
#include "modular_rank.hpp"
#include "pair_journal.hpp"
#include "pair_kernel.cpp"
#include "pairing_limits.hpp"
#include "polynomial_workspace.hpp"
#include <cmath>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <unordered_map>
static thread_local std::string pairing_error;
static volatile std::sig_atomic_t pairing_interrupted = 0;
static void pairing_signal(int) { pairing_interrupted = 1; }
struct PairYield {};
struct PairSignals {
  using Handler = void (*)(int);
  Handler term, interrupt;
  PairSignals() {
    pairing_interrupted = 0;
    term = std::signal(SIGTERM, pairing_signal);
    interrupt = std::signal(SIGINT, pairing_signal);
  }
  ~PairSignals() {
    std::signal(SIGTERM, term);
    std::signal(SIGINT, interrupt);
  }
};

struct DeletionKey {
  U word;
  int edge;
  bool operator==(const DeletionKey &b) const { return word == b.word && edge == b.edge; }
};
struct DeletionHash {
  size_t operator()(const DeletionKey &k) const {
    return mix(Count(k.word)) ^ mix(Count(k.word >> 64)) ^ mix(k.edge);
  }
};
struct SuffixTrie {
  struct Node {
    uint32_t first = 0;
    uint16_t mask = 0;
    int rows = -1;
  };
  struct BuildNode {
    std::array<int, 15> next;
    int rows = -1;
    BuildNode() { next.fill(-1); }
  };
  Eval &e;
  std::chrono::steady_clock::time_point deadline = std::chrono::steady_clock::time_point::max();
  uint64_t operations = 0;
  void check() {
    if ((++operations & 4095) == 0 &&
        (pairing_interrupted || std::chrono::steady_clock::now() > deadline))
      throw PairYield{};
  }

  int d;
  std::vector<Node> nodes;
  std::vector<uint32_t> children;
  std::vector<int> row_next;
  std::vector<WordWorkspace<int>> scratch;
  std::unordered_map<DeletionKey, std::vector<U>, DeletionHash> cache;
  uint64_t walks = 0, terms = 0, hits = 0, misses = 0, cache_bytes = 0;
  size_t cache_budget = 64ull << 20;
  int cache_degree = 10;
  bool star_rows = true;
  size_t term_limit = kir::polynomial_term_limit();
  bool touches_centre(U word) const {
    const U ones = (~U(0)) / 15;
    for (int edge = 0; edge < e.n * (e.n - 1) / 2; edge++)
      if (e.es[edge].second == e.n - 1) {
        U x = word ^ (ones * (edge + 1));
        if ((~(x | (x >> 1) | (x >> 2) | (x >> 3))) & ones)
          return true;
      }
    return false;
  }

  SuffixTrie(Eval &eval, const std::vector<Prepared> &words, int degree)
      : e(eval), d(degree), row_next(words.size(), -1), scratch(degree + 1) {
    if (const char *p = std::getenv("KIR_TRIE_CACHE_MB"))
      cache_budget = std::stoull(p) << 20;
    if (const char *p = std::getenv("KIR_TRIE_CACHE_MAX_DEGREE"))
      cache_degree = std::stoi(p);
    std::vector<BuildNode> build(1);
    for (size_t i = 0; i < words.size(); i++)
      if (!words[i].zero) {
        int node = 0;
        U w = words[i].word;
        for (int j = d - 1; j >= 0; j--) {
          int edge = int((w >> (4 * j)) & 15) - 1;
          if (e.es[edge].second != e.n - 1)
            star_rows = false;
          int next = build[node].next[edge];
          if (next < 0) {
            next = int(build.size());
            build[node].next[edge] = next;
            build.emplace_back();
          }
          node = next;
        }
        row_next[i] = build[node].rows;
        build[node].rows = int(i);
      }
    nodes.reserve(build.size());
    children.reserve(build.size() - 1);
    for (const auto &b : build) {
      Node node;
      node.first = children.size();
      node.rows = b.rows;
      for (int edge = 0; edge < 15; edge++)
        if (b.next[edge] >= 0) {
          node.mask |= uint16_t(1u << edge);
          children.push_back(b.next[edge]);
        }
      nodes.push_back(node);
    }
  }
  void derivative(const WordWorkspace<int> &input, int edge, int len) {
    auto &out = scratch[len - 1];
    out.clear();
    for (auto entry : input.data())
      if (entry.value) {
        check();
        const U *cuts = nullptr;
        size_t count = 0;
        std::array<U, kir::exact_degree> fresh{};
        DeletionKey key{entry.word, edge};
        if (cache_budget && len <= cache_degree) {
          auto it = cache.find(key);
          if (it != cache.end()) {
            hits++;
            count = it->second.size();
            cuts = count ? it->second.data() : fresh.data();
          }
        }
        if (!cuts) {
          misses++;
          int state = 0;
          for (int j = 0; j < len; j++) {
            int q = int((entry.word >> (4 * j)) & 15) - 1, match = e.conj[state][edge];
            if (q == std::abs(match) - 1) {
              bool square =
                  j > 0 && j + 1 < len &&
                  ((entry.word >> (4 * (j - 1))) & 15) == ((entry.word >> (4 * (j + 1))) & 15);
              if (!square) {
                U cut = ((entry.word >> (4 * (j + 1))) << (4 * j)) | (entry.word & e.mask(j));
                if (!star_rows || len == 1 || touches_centre(cut))
                  fresh[count++] = (cut << 1) | U(match < 0);
              }
            }
            state = e.left[q][state];
          }
          cuts = fresh.data();
          size_t bytes = 160 + sizeof(U) * count;
          if (cache_budget && len <= cache_degree && cache_bytes + bytes <= cache_budget) {
            auto it = cache.emplace(key, std::vector<U>(fresh.begin(), fresh.begin() + count));
            if (it.second)
              cache_bytes += bytes;
            cuts = it.first->second.data();
            count = it.first->second.size();
          }
        }
        for (size_t i = 0; i < count; i++) {
          int value = (cuts[i] & 1) ? e.p - entry.value : entry.value;
          out.add(
              cuts[i] >> 1, value,
              [&](int a, int b) {
                int64_t sum = int64_t(a) + b;
                return int(sum >= e.p ? sum - e.p : sum);
              },
              term_limit);
          terms++;
        }
      }
  }
  void walk(int index, int len, std::vector<int> &column) {
    walks++;
    check();
    const auto &poly = scratch[len];
    bool nonzero = false;
    for (auto x : poly.data())
      if (x.value) {
        nonzero = true;
        break;
      }
    if (!nonzero)
      return;
    const auto &node = nodes[index];
    if (!len) {
      int value = 0;
      for (auto x : poly.data())
        if (x.word == 0)
          value = x.value;
      for (int row = node.rows; row >= 0; row = row_next[row])
        column[row] = value;
      return;
    }
    uint16_t mask = node.mask;
    uint32_t child = node.first;
    while (mask) {
      int edge = __builtin_ctz(unsigned(mask));
      mask &= mask - 1;
      derivative(poly, edge, len);
      walk(children[child++], len - 1, column);
    }
  }
  void column(U word, std::vector<int> &out) {
    std::fill(out.begin(), out.end(), 0);
    scratch[d].clear();
    scratch[d].add(word, 1, [](int a, int b) { return a + b; }, 1);
    walk(0, d, out);
  }
  size_t allocated_bytes() const {
    size_t bytes = nodes.capacity() * sizeof(Node) + children.capacity() * 4 +
                   row_next.capacity() * 4 + cache_bytes;
    for (const auto &p : scratch)
      bytes += p.allocated_bytes();
    return bytes;
  }
};
extern "C" const char *kp_engine_error() { return pairing_error.c_str(); }
extern "C" int kp_import_checkpoint(const char *source, const char *old_binding, const char *target,
                                    const char *new_binding, int n, int prime, int degree, int rows,
                                    int duals) {
  try {
    pairing_error.clear();
    if (!source || !target || !old_binding || !new_binding || degree < 0 ||
        degree > kir::exact_degree || rows < 1 || rows > kir::discovery_rows || duals < 1 ||
        duals > kir::candidate_columns)
      throw std::runtime_error("checkpoint import arguments");
    ModularRank rank(rows, prime);
    kir::PairJournal journal(target, new_binding, n, prime, degree, rows, duals);
    std::ifstream input(source, std::ios::binary);
    char magic[8]{};
    input.read(magic, 8);
    input.close();
    if (std::string(magic, 8) == "FKPAIR02") {
      if (std::filesystem::exists(target) ||
          std::filesystem::exists(std::string(target) + ".parts"))
        throw std::runtime_error("import destination exists");
      kir::PairJournal old(source, old_binding, n, prime, degree, rows, duals);
      int cursor = old.load(rank);
      journal.save(rank, cursor);
    } else
      journal.import_legacy(source, old_binding, rank);
    return 0;
  } catch (const std::exception &e) {
    pairing_error = e.what();
    return 3;
  } catch (...) {
    pairing_error = "unknown checkpoint import failure";
    return 3;
  }
}
extern "C" int kp_minor_trie_wide(void *ptr, const Count *us, int nu, const Count *vs, int nv,
                                  int len, int *rowids, int *colids, int *matrix, Count *stats,
                                  double seconds) {
  if (!ptr || !us || !vs || !rowids || !colids || !stats || nu < 1 || nv < 1 ||
      nu > kir::discovery_rows || nv > kir::candidate_columns || len < 0 ||
      len > kir::exact_degree || !std::isfinite(seconds) || !(seconds > 0))
    return -1;
  try {
    pairing_error.clear();
    PairSignals signals;
    Eval &e = *(Eval *)ptr;
    auto clock = []() { return std::chrono::steady_clock::now(); };
    auto t0 = clock();
    auto elapsed = [&]() { return std::chrono::duration<double>(clock() - t0).count(); };
    std::vector<Prepared> u;
    u.reserve(nu);
    for (int i = 0; i < nu; i++)
      u.push_back(prepare_word(e, U(us[2 * i]) | (U(us[2 * i + 1]) << 64), len));
    ModularRank rank(nu, e.p);
    std::unique_ptr<kir::PairJournal> journal;
    int cursor = 0;
    const char *state = std::getenv("KIR_PAIR_STATE"),
               *binding = std::getenv("KIR_PAIR_STATE_BINDING");
    if (state && *state) {
      if (matrix || !binding)
        throw std::runtime_error("journal API/binding");
      journal = std::make_unique<kir::PairJournal>(state, binding, e.n, e.p, len, nu, nv);
      cursor = journal->load(rank);
    }
    int cap = nu;
    if (const char *p = std::getenv("KIR_MINOR_MAX_RANK"))
      cap = std::min(nu, std::max(1, std::stoi(p)));
    size_t budget = 0;
    if (const char *p = std::getenv("KIR_WORKER_BYTES"))
      budget = std::stoull(p);
    std::fprintf(
        stderr,
        "{\"type\":\"pair_state_loaded\",\"rank\":%zu,\"nextColumn\":%d,\"format\":\"FKPAIR02\"}\n",
        rank.rank(), cursor);
    std::fflush(stderr);
    std::fprintf(stderr, "{\"type\":\"rank_arithmetic\",\"mode\":\"%s\",\"overflowChecked\":true}\n",
                 rank.uses_delayed_reduction() ? "delayed" : "reference");
    SuffixTrie trie(e, u, len);
    if (seconds < 1e8)
      trie.deadline = t0 + std::chrono::duration_cast<std::chrono::steady_clock::duration>(
                               std::chrono::duration<double>(seconds));
    rank.cooperate = [&]() {
      if (pairing_interrupted || clock() > trie.deadline)
        throw PairYield{};
    };
    std::vector<int> column(nu);
    std::vector<std::vector<int>> kept;
    uint64_t offered = 0;
    double derivative_time = 0, rank_time = 0, checkpoint_time = 0, last_progress = elapsed(),
           last_save = elapsed();
    if (matrix && rank.rank())
      throw std::runtime_error("matrix output cannot resume a journal");
    auto save = [&]() {
      if (journal) {
        auto begin = clock();
        journal->save(rank, cursor);
        checkpoint_time += std::chrono::duration<double>(clock() - begin).count();
        last_save = elapsed();
      }
    };
    for (int j = cursor; j < nv && rank.rank() < size_t(cap); j++) {
      if (elapsed() > seconds || pairing_interrupted)
        break;
      auto start = clock();
      const auto dual = prepare_word(e, U(vs[2 * j]) | (U(vs[2 * j + 1]) << 64), len);
      try {
        if (dual.zero)
          std::fill(column.begin(), column.end(), 0);
        else
          trie.column(dual.word, column);
      } catch (const PairYield &) {
        break;
      }

      derivative_time += std::chrono::duration<double>(clock() - start).count();
      for (int i = 0; i < nu; i++)
        if (u[i].grade != e.inv[dual.grade] && column[i])
          throw std::runtime_error("pairing grade mismatch");
      std::vector<int> original;
      if (matrix)
        original = column;
      start = clock();
      bool gained = false;
      try {
        gained = rank.offer(column, j);
      } catch (const PairYield &) {
        break;
      }
      rank_time += std::chrono::duration<double>(clock() - start).count();
      if (matrix && gained)
        kept.push_back(std::move(original));
      offered++;
      cursor = j + 1;
      size_t allocated = rank.allocated_bytes() + trie.allocated_bytes() +
                         u.capacity() * sizeof(Prepared) + column.capacity() * sizeof(int);
      if (journal && elapsed() - last_save >= 60)
        save();
      if (elapsed() - last_progress >= 5) {
        std::fprintf(stderr,
                     "{\"type\":\"discovery_progress\",\"rank\":%zu,\"rows\":%d,\"offeredColumns\":"
                     "%llu,\"seconds\":%.3f,\"derivativeSeconds\":%.3f,\"eliminationSeconds\":%.3f,"
                     "\"checkpointSeconds\":%.3f,\"checkpointBytes\":%llu,\"allocatedBytes\":%zu,"
                     "\"cacheHits\":%llu,\"cacheMisses\":%llu}\n",
                     rank.rank(), nu, (unsigned long long)offered, elapsed(), derivative_time,
                     rank_time, checkpoint_time,
                     (unsigned long long)(journal ? journal->written_bytes : 0), allocated,
                     (unsigned long long)trie.hits, (unsigned long long)trie.misses);
        std::fflush(stderr);
        last_progress = elapsed();
      }
      if (budget && allocated > budget) {
        save();
        throw std::runtime_error("discovery allocation budget; journal preserved");
      }
    }
    save();
    int count = rank.rank();
    for (int i = 0; i < count; i++) {
      rowids[i] = rank.rows[i];
      colids[i] = rank.columns[i];
      if (matrix)
        for (int j = 0; j < count; j++)
          matrix[size_t(i) * count + j] = kept[j][rank.rows[i]];
    }
    stats[0] = uint64_t(nu) * offered;
    stats[1] = rank.axpys;
    stats[2] = offered;
    stats[3] = trie.walks;
    stats[4] = trie.terms;
    stats[5] = trie.nodes.size();
    return count;
  } catch (const std::bad_alloc &e) {
    pairing_error = "discovery memory allocation failed; last committed journal retained";
    return -3;
  } catch (const std::exception &e) {
    pairing_error = e.what();
    return -2;
  } catch (...) {
    pairing_error = "unknown discovery failure";
    return -2;
  }
}
