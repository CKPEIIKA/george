// SPDX-License-Identifier: MIT
// Included after the independent integer verifier. A cache is admitted only by
// the Python proof-record layer; this ABI additionally checks shape and words.
#include "verified_lu.hpp"
#include <bit>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <numeric>

namespace kir_cached {
static_assert(std::endian::native == std::endian::little, "LU cache is little endian");
struct Cache {
  std::ifstream file;
  int rank = 0, determinant = 0;
  std::vector<U> rows, cols;
  Cache(const char *path, int n, int d, int prime) {
    if (!path || !*path) return;
    file.open(path, std::ios::binary);
    char magic[8]; uint32_t h[6];
    if (!file.read(magic, 8) || std::memcmp(magic, "KIRLU001", 8) ||
        !file.read(reinterpret_cast<char *>(h), sizeof h) || h[0] != unsigned(n) ||
        h[1] != unsigned(d) || h[2] != unsigned(prime) || !h[3] ||
        h[3] > unsigned(kir::minor_rank) || !h[4] || h[4] >= unsigned(prime) || h[5])
      throw std::runtime_error("entry cache: invalid header");
    rank = int(h[3]); determinant = int(h[4]);
    if (std::filesystem::file_size(path) != 32ull + 32ull * rank + 4ull * rank * rank)
      throw std::runtime_error("entry cache: invalid length");
    rows.resize(rank); cols.resize(rank);
    if (!file.read(reinterpret_cast<char *>(rows.data()), rank * sizeof(U)) ||
        !file.read(reinterpret_cast<char *>(cols.data()), rank * sizeof(U)))
      throw std::runtime_error("entry cache: truncated words");
    if (validate_words(n, d, rows.data(), rank) || validate_words(n, d, cols.data(), rank))
      throw std::runtime_error("entry cache: invalid words");
  }
};
static bool order(const std::vector<U> &words, const std::vector<U> &old, std::vector<int> &out) {
  std::unordered_map<U, int, WordHash> index;
  for (size_t i = 0; i < words.size(); i++)
    if (!index.emplace(words[i], int(i)).second)
      throw std::runtime_error("duplicate minor word");
  out.clear(); std::vector<bool> seen(words.size());
  for (U w : old) {
    auto it = index.find(w);
    if (it == index.end() || seen[it->second]) return false;
    seen[it->second] = true; out.push_back(it->second);
  }
  for (size_t i = 0; i < words.size(); i++) if (!seen[i]) out.push_back(int(i));
  return true;
}
static int sign(const std::vector<int> &order) {
  std::vector<bool> seen(order.size()); int out = 1;
  for (size_t i = 0; i < order.size(); i++) if (!seen[i]) {
    int length = 0;
    for (int j = int(i); !seen[j]; j = order[j]) { seen[j] = true; length++; }
    if (!(length & 1)) out = -out;
  }
  return out;
}
static std::vector<U> reorder(const std::vector<U> &v, const std::vector<int> &o) {
  std::vector<U> out; out.reserve(v.size());
  for (int i : o) out.push_back(v[i]);
  return out;
}
static int cache_size(int rank, uint64_t bytes) {
  int lo = 0, hi = rank;
  while (lo < hi) {
    int m = lo + (hi - lo + 1) / 2;
    if (32ull + 32ull * m + 4ull * m * m <= bytes) lo = m;
    else hi = m - 1;
  }
  return lo;
}
static bool save(const char *path, int n, int d, int prime, int rank, int cap,
                 const int32_t *a, const std::vector<U> &u, const std::vector<U> &v,
                 const std::vector<int> &pivots) {
  if (!path || !*path || !cap) return false;
  int det = 1;
  for (int i = 0; i < cap; i++) det = int(int64_t(det) * a[size_t(i) * rank + i] % prime);
  if (!det) throw std::runtime_error("invalid cached LU prefix");
  std::ofstream file(path, std::ios::binary | std::ios::trunc);
  uint32_t h[6] = {unsigned(n), unsigned(d), unsigned(prime), unsigned(cap), unsigned(det), 0};
  file.write("KIRLU001", 8); file.write(reinterpret_cast<char *>(h), sizeof h);
  for (int i = 0; i < cap; i++) file.write(reinterpret_cast<const char *>(&u[pivots[i]]), sizeof(U));
  file.write(reinterpret_cast<const char *>(v.data()), cap * sizeof(U));
  for (int i = 0; i < cap; i++)
    file.write(reinterpret_cast<const char *>(a + size_t(i) * rank), cap * sizeof(int32_t));
  file.flush();
  bool ok = bool(file); file.close();
  if (!ok) { std::error_code e; std::filesystem::remove(path, e); }
  return ok;
}
} // namespace kir_cached

extern "C" int kv_verify_extend128(int n, int d, const Count *us, const Count *vs,
                                   int rank, int prime, int threads, int tile,
                                   const char *cache_path, const char *output_path,
                                   Count cache_bytes, int32_t *detout, Count *stats) {
  using namespace kir_cached;
  if (!us || !vs || !detout || !stats || n < 2 || n > 6 || rank < 1 ||
      rank > kir::minor_rank || prime < 3 || prime > 1000000007 || d < 0 ||
      d > MAX_EXACT_DEGREE || threads < 1 || threads > 16 || tile < 1 || tile > 1024) return 1;
  for (int q = 2; int64_t(q) * q <= prime; q++) if (prime % q == 0) return 1;
  std::fill(stats, stats + 8, 0);
  try {
    verify_error.clear(); auto start = std::chrono::steady_clock::now();
    std::vector<U> u(rank), v(rank);
    for (int i = 0; i < rank; i++) {
      u[i] = U(us[2*i]) | (U(us[2*i+1]) << 64);
      v[i] = U(vs[2*i]) | (U(vs[2*i+1]) << 64);
    }
    if (validate_words(n,d,u.data(),rank) || validate_words(n,d,v.data(),rank)) return 2;
    Cache cache(cache_path, n, d, prime);
    int old = 0, ordering_sign = 1;
    std::vector<int> ro, co;
    if (cache.rank && cache.rank <= rank && order(u,cache.rows,ro) && order(v,cache.cols,co)) {
      old = cache.rank; ordering_sign = sign(ro) * sign(co);
      u = reorder(u,ro); v = reorder(v,co);
    }
    std::vector<int32_t> a(size_t(rank) * rank);
    int inherited_det = 1;
    if (old) {
      for (int i = 0; i < old; i++) {
        int32_t *row = a.data() + size_t(i) * rank;
        if (!cache.file.read(reinterpret_cast<char *>(row), old * sizeof(int32_t)))
          throw std::runtime_error("entry cache: truncated LU");
        for (int j = 0; j < old; j++) if (row[j] < 0 || row[j] >= prime)
          throw std::runtime_error("entry cache: invalid residue");
        inherited_det = int(int64_t(inherited_det) * row[i] % prime);
      }
      if (inherited_det != cache.determinant) throw std::runtime_error("entry cache: diagonal mismatch");
    }
    cache.file.close();
    Verifier all(n,d,u.data(),rank);
    std::unique_ptr<Verifier> added;
    if (old && old < rank) added = std::make_unique<Verifier>(n,d,u.data()+old,rank-old);
    uint64_t entries = 0; unsigned maxbits = 0;
    Verifier::Work serial(d);
    for (int col = 0; col < rank; col += tile) {
      int nc = std::min(tile,rank-col);
      std::vector<Z> raw(size_t(rank) * nc);
      std::atomic<int> next{0},bad{0}; std::mutex mutex; std::string error;
      auto work = [&]() {
        try {
          Verifier::Work local(d); auto &ws = threads == 1 ? serial : local;
          for (;;) {
            int j = next++; if (j >= nc) break;
            if (col+j < old) {
              if (added) added->column_flat(v[col+j],j,nc,raw.data()+size_t(old)*nc,ws);
            } else all.column_flat(v[col+j],j,nc,raw.data(),ws);
          }
        } catch (const std::exception &e) { std::lock_guard<std::mutex> lock(mutex); bad=1; error=e.what(); }
          catch (...) { std::lock_guard<std::mutex> lock(mutex); bad=1; error="invalid exact derivative input"; }
      };
      std::vector<std::thread> pool;
      try { for(int t=1;t<threads && t<nc;t++) pool.emplace_back(work); work(); }
      catch (...) { bad=1; next=nc; }
      for(auto &t:pool) t.join();
      if(bad) throw std::runtime_error(error);
      for(int j=0;j<nc;j++) for(int i=(col+j<old?old:0);i<rank;i++) {
        Z z=raw[size_t(i)*nc+j]; maxbits=std::max(maxbits,zbits(z));
        Z rem=z%prime; if(rem<0) rem+=prime;
        a[size_t(i)*rank+col+j]=int32_t(rem); entries++;
      }
      if(col%1024==0) {
        std::fprintf(stderr,"{\"type\":\"verification_entries_progress\",\"columns\":%d,\"rank\":%d,\"cachedRank\":%d}\n",col+nc,rank,old);
        std::fflush(stderr);
      }
    }
    auto entries_done=std::chrono::steady_clock::now();
    std::fprintf(stderr,"{\"type\":\"verification_entries_complete\",\"rank\":%d,\"entries\":%llu,\"reusedEntries\":%llu,\"seconds\":%.3f}\n",rank,(unsigned long long)entries,(unsigned long long)old*old,std::chrono::duration<double>(entries_done-start).count());
    std::fprintf(stderr,"{\"type\":\"verification_factorization_start\",\"rank\":%d,\"cachedRank\":%d,\"schurRank\":%d}\n",rank,old,rank-old);std::fflush(stderr);
    std::vector<int> pivots(rank); std::iota(pivots.begin(),pivots.end(),0);
    int det;
    if(prime==1000003) {
      if(old) kir_lu::extend<1000003>(rank,a.data(),old,prime);
      det=kir_lu::factor<1000003>(rank,a.data(),old,pivots,prime);
    } else {
      if(old) kir_lu::extend<>(rank,a.data(),old,prime);
      det=kir_lu::factor<>(rank,a.data(),old,pivots,prime);
    }
    det=int(int64_t(det)*inherited_det%prime);
    if(ordering_sign<0 && det) det=prime-det;
    *detout=det;
    if(!det) return 5;
    auto factors_done=std::chrono::steady_clock::now();
    int cap=cache_size(rank,cache_bytes);
    if(cap && (!old || cap>old) && save(output_path,n,d,prime,rank,cap,a.data(),u,v,pivots)) stats[4]=cap;
    stats[0]=entries;stats[1]=maxbits;stats[2]=uint64_t(old)*old;stats[3]=old;
    stats[5]=std::chrono::duration_cast<std::chrono::microseconds>(entries_done-start).count();
    stats[6]=std::chrono::duration_cast<std::chrono::microseconds>(factors_done-entries_done).count();
    return 0;
  } catch(const std::bad_alloc &) { verify_error="independent replay memory allocation failed";return 7; }
    catch(const std::exception &e) { verify_error=e.what();return 3; }
    catch(...) { verify_error="invalid cached verifier input";return 3; }
}
