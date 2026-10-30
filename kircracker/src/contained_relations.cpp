// SPDX-License-Identifier: MIT
// Exact subset of defining-relation consequences in a saved word spanning
// chart. Partial discovery is an upper-bound candidate, never a completeness
// assertion.
#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <sys/resource.h>
#include <unordered_map>
#include <unordered_set>
#include <vector>
using U = __uint128_t;
using V = uint32_t;
using B = uint64_t;
static void need(bool ok, const char *m) {
  if (!ok)
    throw std::runtime_error(m);
}
static U mask(V n) { return n ? ((U(1) << (4 * n)) - 1) : 0; }
static V permutation_grade(U w, V d) {
  std::array<V, 6> p{0, 1, 2, 3, 4, 5};
  for (V q = d; q--;) {
    V a = V((w >> (4 * q)) & 15);
    need(a < 5, "star letter");
    std::swap(p[a], p[5]);
  }
  V out = 0;
  for (V i = 0; i < 6; i++) {
    V smaller = 0;
    for (V j = i + 1; j < 6; j++)
      smaller += p[j] < p[i];
    out = out * (6 - i) + smaller;
  }
  return out;
}
struct Hash {
  size_t operator()(U w) const {
    B x = B(w) ^ B(w >> 64);
    x ^= x >> 30;
    x *= 0xbf58476d1ce4e5b9ULL;
    x ^= x >> 27;
    x *= 0x94d049bb133111ebULL;
    return x ^ (x >> 31);
  }
};
static B get(std::istream &f, int bytes) {
  B v = 0;
  for (int i = 0; i < bytes; i++) {
    int c = f.get();
    need(c >= 0, "truncated input");
    v |= B(c) << (8 * i);
  }
  return v;
}
static void put(std::ostream &f, B v, int bytes) {
  for (int i = 0; i < bytes; i++) {
    f.put(char(v & 255));
    v >>= 8;
  }
}
static U wordin(std::istream &f) {
  B lo = get(f, 8), hi = get(f, 8);
  return U(lo) | (U(hi) << 64);
}
static void wordout(std::ostream &f, U w) {
  put(f, B(w), 8);
  put(f, B(w >> 64), 8);
}
struct Term {
  U word;
  bool odd;
};
struct Rel {
  V degree, tip;
  std::vector<Term> terms;
};
static std::vector<Rel> relations(const std::string &path) {
  std::ifstream f(path);
  V k, n;
  need(bool(f >> k >> n) && k == 5 && n == 248,
       "248-relation library required");
  std::vector<Rel> out;
  for (V i = 0; i < n; i++) {
    Rel r;
    V nt;
    need(bool(f >> r.degree >> nt) && r.degree >= 2 && r.degree <= 31 &&
             nt > 0 && nt < 100000,
         "relation dimensions");
    r.tip = ~V(0);
    for (V j = 0; j < nt; j++) {
      std::string c;
      need(bool(f >> c), "coefficient input");
      size_t pos = c[0] == '-' ? 1 : 0;
      need(pos < c.size() &&
               c.find_first_not_of("0123456789", pos) == std::string::npos,
           "integer coefficient");
      Term t{0, bool((c.back() - '0') & 1)};
      for (V q = 0; q < r.degree; q++) {
        V a;
        need(bool(f >> a) && a < 5, "relation letter");
        t.word = (t.word << 4) | a;
      }
      if (t.odd && r.tip == ~V(0))
        r.tip = j;
      r.terms.push_back(t);
    }
    need(r.tip != ~V(0),
         "relation has no odd coefficient; divide content first");
    out.push_back(std::move(r));
  }
  std::string extra;
  need(!(f >> extra), "extra library data");
  return out;
}
struct Trie {
  std::array<int, 5> next;
  std::vector<V> rels;
  Trie() { next.fill(-1); }
};
struct Timeout {};
int main(int argc, char **argv) {
  try {
    need(argc == 9 || argc == 10,
         "usage frame relations binding output group seconds memoryBytes "
         "discovery|replay [trace]");
    std::string frame = argv[1], library = argv[2], binding = argv[3],
                out = argv[4], mode = argv[8];
    V group = std::stoul(argv[5]);
    double seconds = std::stod(argv[6]);
    B budget = std::stoull(argv[7]);
    bool replay = mode == "replay";
    need((replay && argc == 10) ||
             (!replay && argc == 9 && mode == "discovery"),
         "mode/options");
    need(binding.size() == 64 && group < 720 && std::isfinite(seconds) &&
             seconds > 0 && budget >= 64 * 1024 * 1024,
         "limits");
    auto start = std::chrono::steady_clock::now();
    auto elapsed = [&]() {
      return std::chrono::duration<double>(std::chrono::steady_clock::now() -
                                           start)
          .count();
    };
    B operations = 0;
    auto check = [&]() {
      if (!(++operations & 127) && elapsed() > seconds)
        throw Timeout();
    };
    std::ifstream f(frame, std::ios::binary);
    char magic[8], bind[64];
    need(bool(f.read(magic, 8)) && !std::memcmp(magic, "KKRMAP01", 8) &&
             bool(f.read(bind, 64)) && !std::memcmp(bind, binding.data(), 64),
         "frame binding");
    V D = get(f, 4), k = get(f, 4), prime = get(f, 4), flags = get(f, 4);
    B previous = get(f, 8), n = get(f, 8), actions = get(f, 8);
    need(D >= 2 && D <= 31 && k == 5 && prime == 2 && !flags && !actions &&
             n < 100000000,
         "spanning frame dimensions");
    (void)previous;
    std::vector<U> words;
    for (B i = 0; i < n; i++) {
      U w = wordin(f);
      V g = get(f, 4);
      need(g < 720 && (w >> (4 * D)) == 0, "frame word");
      if (g == group) {
        need(permutation_grade(w, D) == group, "literal sector grade");
        words.push_back(w);
      }
    }
    get(f, 8);
    need(f.peek() == EOF, "frame trailing bytes");
    need(!words.empty() && words.size() < 10000000, "empty/large sector");
    need(std::is_sorted(words.begin(), words.end()) &&
             std::adjacent_find(words.begin(), words.end()) == words.end(),
         "frame word order");
    V width = words.size();
    std::unordered_map<U, V, Hash> index;
    index.reserve(width * 2);
    for (V i = 0; i < width; i++)
      index.emplace(words[i], i);
    auto rels = relations(library);
    std::vector<Trie> trie(1);
    for (V i = 0; i < rels.size(); i++) {
      auto &r = rels[i];
      if (r.degree > D)
        continue;
      U w = r.terms[r.tip].word;
      int state = 0;
      for (V j = 0; j < r.degree; j++) {
        V a = V((w >> (4 * j)) & 15);
        int at = trie[state].next[a];
        if (at < 0) {
          at = trie.size();
          trie[state].next[a] = at;
          trie.emplace_back();
        }
        state = at;
      }
      trie[state].rels.push_back(i);
    }
    std::filesystem::create_directories(out);
    std::string tracepath = out + "/relations.cpr";
    need(!std::filesystem::exists(tracepath), "refuse trace overwrite");
    std::ofstream trace(tracepath, std::ios::binary);
    trace.write("CPREL001", 8);
    trace.write(binding.data(), 64);
    put(trace, D, 4);
    put(trace, group, 4);
    put(trace, 2, 4);
    put(trace, width, 4);
    for (U w : words)
      wordout(trace, w);
    std::vector<std::vector<V>> piv(width);
    B pivotBytes = 0, contexts = 0, eligible = 0, missing = 0;
    V rank = 0;
    double last = 0;
    V cursor = 0;
    bool timed = false;
    auto telemetry = [&](bool force = false) {
      double t = elapsed();
      if (!force && t - last < 5)
        return;
      last = t;
      struct rusage u{};
      getrusage(RUSAGE_SELF, &u);
      std::cout << "{\"type\":\"contained_relation_progress\",\"group\":"
                << group << ",\"columns\":" << width
                << ",\"relationRank\":" << rank
                << ",\"upperCandidate\":" << width - rank
                << ",\"wordCursor\":" << cursor << ",\"contexts\":" << contexts
                << ",\"eligible\":" << eligible
                << ",\"missingTermContexts\":" << missing
                << ",\"pivotBytes\":" << pivotBytes
                << ",\"peakRSSBytes\":" << B(u.ru_maxrss) * 1024
                << ",\"seconds\":" << t << "}\n"
                << std::flush;
    };
    auto source = [&](U original, V ri, V pos, std::vector<V> &row) {
      need(ri < rels.size(), "source relation");
      auto &r = rels[ri];
      need(pos + r.degree <= D && ((original >> (4 * pos)) & mask(r.degree)) ==
                                      r.terms[r.tip].word,
           "source matching tip");
      U prefix = original >> (4 * (pos + r.degree)),
        suffix = original & mask(pos);
      row.clear();
      for (const auto &t : r.terms) {
        U w =
            (prefix << (4 * (r.degree + pos))) | (t.word << (4 * pos)) | suffix;
        auto it = index.find(w);
        if (it == index.end())
          return false;
        if (t.odd)
          row.push_back(it->second);
      }
      std::sort(row.begin(), row.end());
      size_t out = 0;
      for (size_t i = 0; i < row.size();) {
        size_t j = i + 1;
        while (j < row.size() && row[j] == row[i])
          j++;
        if ((j - i) & 1)
          row[out++] = row[i];
        i = j;
      }
      row.resize(out);
      return true;
    };
    auto addtrace = [&](V lead, V ri, V pos, U original,
                        const std::vector<V> &deps) {
      put(trace, lead, 4);
      put(trace, ri, 4);
      put(trace, pos, 4);
      put(trace, deps.size(), 4);
      wordout(trace, original);
      for (V d : deps)
        put(trace, d, 4);
      need(bool(trace), "trace write");
    };
    std::ifstream saved;
    B expectedCount = 0;
    if (replay) {
      saved.open(argv[9], std::ios::binary);
      char m[8], b[64];
      need(bool(saved.read(m, 8)) && !std::memcmp(m, "CPREL001", 8) &&
               bool(saved.read(b, 64)) && !std::memcmp(b, binding.data(), 64),
           "replay binding");
      need(get(saved, 4) == D && get(saved, 4) == group && get(saved, 4) == 2 &&
               get(saved, 4) == width,
           "replay scope");
      for (U w : words)
        need(wordin(saved) == w, "replay chart");
    }
    try {
      if (!replay) {
        for (cursor = 0; cursor < width; cursor++) {
          check();
          U original = words[cursor];
          for (V pos = 0; pos < D; pos++) {
            int state = 0;
            for (V q = pos; q < D; q++) {
              V a = V((original >> (4 * q)) & 15);
              need(a < 5, "frame generator");
              state = trie[state].next[a];
              if (state < 0)
                break;
              for (V ri : trie[state].rels) {
                check();
                contexts++;
                std::vector<V> row, deps;
                if (!source(original, ri, pos, row)) {
                  missing++;
                  continue;
                }
                eligible++;
                while (!row.empty() && !piv[row.back()].empty()) {
                  check();
                  V h = row.back();
                  deps.push_back(h);
                  std::vector<V> next;
                  const auto &b = piv[h];
                  next.reserve(row.size() + b.size());
                  std::set_symmetric_difference(row.begin(), row.end(),
                                                b.begin(), b.end(),
                                                std::back_inserter(next));
                  row.swap(next);
                  need(pivotBytes + B(row.capacity()) * 4 + width * 100 <
                           budget,
                       "relation pivot budget");
                }
                if (row.empty())
                  continue;
                V h = row.back();
                row.shrink_to_fit();
                need(pivotBytes + B(row.capacity()) * 4 + width * 100 < budget,
                     "relation pivot budget");
                addtrace(h, ri, pos, original, deps);
                pivotBytes += row.capacity() * 4;
                piv[h] = std::move(row);
                rank++;
              }
            }
          }
          telemetry();
        }
      } else {
        for (;;) {
          check();
          V lead = get(saved, 4);
          if (lead == ~V(0)) {
            expectedCount = get(saved, 4);
            need(expectedCount == rank, "replay final rank");
            need(saved.peek() == EOF, "replay trailing data");
            break;
          }
          V ri = get(saved, 4), pos = get(saved, 4), nd = get(saved, 4);
          need(lead < width && nd <= width && piv[lead].empty(),
               "replay record");
          U original = wordin(saved);
          need(index.count(original), "replay context chart");
          std::vector<V> row, deps;
          need(source(original, ri, pos, row), "replay missing literal term");
          std::unordered_set<V> toggle(row.begin(), row.end());
          for (V i = 0; i < nd; i++) {
            V h = get(saved, 4);
            need(h < width && !piv[h].empty(), "replay dependency");
            deps.push_back(h);
            for (V c : piv[h]) {
              check();
              auto it = toggle.find(c);
              if (it == toggle.end())
                toggle.insert(c);
              else
                toggle.erase(it);
            }
          }
          row.assign(toggle.begin(), toggle.end());
          std::sort(row.begin(), row.end());
          need(!row.empty() && row.back() == lead,
               "replay nonzero triangular pivot");
          addtrace(lead, ri, pos, original, deps);
          pivotBytes += row.size() * 4;
          piv[lead] = std::move(row);
          rank++;
          contexts++;
          eligible++;
          telemetry();
        }
      }
    } catch (const Timeout &) {
      timed = true;
      if (replay)
        throw std::runtime_error("replay timeout; no verified bound");
    }
    put(trace, ~V(0), 4);
    put(trace, rank, 4);
    trace.flush();
    need(bool(trace), "trace final write");
    trace.close();
    telemetry(true);
    std::ofstream free(out + "/free-words.bin", std::ios::binary);
    for (V i = 0; i < width; i++)
      if (piv[i].empty())
        wordout(free, words[i]);
    need(bool(free), "free words write");
    std::ofstream report(out + "/RESULT.json");
    report << "{\"degree\":" << D << ",\"group\":" << group
           << ",\"prime\":2,\"candidateColumns\":" << width
           << ",\"relationRank\":" << rank
           << ",\"upperCandidate\":" << width - rank
           << ",\"enumeratedAllContainedContexts\":"
           << (!timed ? "true" : "false")
           << ",\"globalRelationEnumerationComplete\":false,\"replayed\":"
           << (replay ? "true" : "false") << ",\"status\":\""
           << (replay ? "REPLAYED_PARTIAL_UPPER_IN_RETAINED_SPANNING_CHAIN"
                      : "UNVERIFIED_UPPER_CANDIDATE")
           << "\",\"contexts\":" << contexts
           << ",\"eligibleContexts\":" << eligible
           << ",\"missingTermContexts\":" << missing
           << ",\"elapsedSeconds\":" << elapsed() << "}\n";
    need(bool(report), "report write");
    return 0;
  } catch (const std::exception &e) {
    std::cerr << e.what() << '\n';
    return 2;
  }
}
