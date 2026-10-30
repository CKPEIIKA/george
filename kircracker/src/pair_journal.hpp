#pragma once
// SPDX-License-Identifier: MIT
// Discovery recovery only. Published manifests reference immutable pivot chunks.
// Selected minors still require independent integer-prefix mathematical replay.
#include "modular_rank.hpp"
#include <cerrno>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fcntl.h>
#include <filesystem>
#include <fstream>
#include <sys/stat.h>
#include <unistd.h>
#ifdef KIR_HAVE_ZSTD
#include <zstd.h>
#endif
namespace kir {
inline uint64_t hash_bytes(const unsigned char *p, size_t n, uint64_t h = 1469598103934665603ULL) {
  for (size_t i = 0; i < n; i++) {
    h ^= p[i];
    h *= 1099511628211ULL;
  }
  return h;
}
struct Bytes {
  std::vector<unsigned char> data;
  size_t at = 0;
  void put(uint64_t n, unsigned bytes) {
    for (unsigned i = 0; i < bytes; i++) {
      data.push_back(n & 255);
      n >>= 8;
    }
  }
  uint64_t get(unsigned bytes) {
    if (bytes > 8 || at > data.size() || bytes > data.size() - at)
      throw std::runtime_error("truncated pivot chunk");
    uint64_t n = 0;
    for (unsigned i = 0; i < bytes; i++)
      n |= uint64_t(data[at++]) << (8 * i);
    return n;
  }
  void text(const std::string &s) { data.insert(data.end(), s.begin(), s.end()); }
  std::string text(size_t n) {
    if (at > data.size() || n > data.size() - at)
      throw std::runtime_error("truncated checkpoint text");
    std::string s(data.begin() + at, data.begin() + at + n);
    at += n;
    return s;
  }
};
inline void durable_write(const std::filesystem::path &target,
                          const std::vector<unsigned char> &data) {
  auto temp = target.string() + ".tmp-" + std::to_string(getpid());
  int fd = open(temp.c_str(), O_WRONLY | O_CREAT | O_EXCL, 0600);
  if (fd < 0)
    throw std::runtime_error("cannot create checkpoint temporary file");
  try {
    size_t at = 0;
    while (at < data.size()) {
      ssize_t n = write(fd, data.data() + at, std::min(size_t(1 << 20), data.size() - at));
      if (n < 0 && errno == EINTR)
        continue;
      if (n <= 0)
        throw std::runtime_error("checkpoint write failed");
      at += n;
    }
    if (fsync(fd))
      throw std::runtime_error("checkpoint fsync failed");
    if (close(fd)) {
      fd = -1;
      throw std::runtime_error("checkpoint close failed");
    }
    fd = -1;
    if (rename(temp.c_str(), target.c_str()))
      throw std::runtime_error("checkpoint publication failed");
    int dir = open(target.parent_path().empty() ? "." : target.parent_path().c_str(),
                   O_RDONLY | O_DIRECTORY);
    if (dir < 0)
      throw std::runtime_error("checkpoint parent open failed");
    int result = fsync(dir);
    close(dir);
    if (result)
      throw std::runtime_error("checkpoint directory sync failed");
  } catch (...) {
    if (fd >= 0)
      close(fd);
    unlink(temp.c_str());
    throw;
  }
}
inline Bytes read_small(const std::filesystem::path &path, size_t limit) {
  std::ifstream f(path, std::ios::binary | std::ios::ate);
  if (!f)
    throw std::runtime_error("cannot open checkpoint");
  auto n = f.tellg();
  if (n < 0 || uint64_t(n) > limit)
    throw std::runtime_error("checkpoint size limit");
  Bytes b;
  b.data.resize(size_t(n));
  f.seekg(0);
  if (!f.read(reinterpret_cast<char *>(b.data.data()), n))
    throw std::runtime_error("checkpoint read failed");
  return b;
}
struct LegacyReader {
  std::ifstream file;
  std::vector<unsigned char> buffer = std::vector<unsigned char>(1 << 20);
  size_t begin = 0, end = 0;
  uint64_t position = 0, length = 0, read_position = 0, hash = 1469598103934665603ULL;
  explicit LegacyReader(const std::string &path) : file(path, std::ios::binary | std::ios::ate) {
    if (!file || file.tellg() < std::streamoff(108))
      throw std::runtime_error("legacy checkpoint open/length");
    length = uint64_t(file.tellg());
    file.seekg(0);
  }
  void fill() {
    if (begin < end)
      return;
    size_t count = std::min(uint64_t(buffer.size()), length - read_position);
    if (!count || !file.read(reinterpret_cast<char *>(buffer.data()), count))
      throw std::runtime_error("legacy checkpoint truncated");
    if (read_position < length - 8)
      hash = hash_bytes(buffer.data(), std::min(uint64_t(count), length - 8 - read_position), hash);
    begin = 0;
    end = count;
    read_position += count;
  }
  void bytes(char *out, size_t count) {
    while (count) {
      fill();
      size_t n = std::min(count, end - begin);
      std::memcpy(out, buffer.data() + begin, n);
      begin += n;
      position += n;
      out += n;
      count -= n;
    }
  }
  uint64_t get(unsigned count) {
    if (count > 8)
      throw std::runtime_error("legacy integer width");
    unsigned char raw[8];
    bytes(reinterpret_cast<char *>(raw), count);
    uint64_t result = 0;
    for (unsigned i = 0; i < count; i++)
      result |= uint64_t(raw[i]) << (8 * i);
    return result;
  }
  std::string text(size_t count) {
    std::string result(count, 0);
    bytes(result.data(), count);
    return result;
  }
  void finish() {
    if (position != length - 8)
      throw std::runtime_error("legacy trailing data");
    uint64_t expected = get(8);
    if (expected != hash || position != length)
      throw std::runtime_error("legacy checkpoint checksum");
  }
};

class PairJournal {
  struct Chunk {
    std::string name;
    uint32_t begin, end;
    uint64_t hash;
  };
  std::filesystem::path path, parts;
  std::string binding;
  int n, p, d, width, duals;
  size_t saved = 0;
  std::vector<Chunk> chunks;
  uint64_t retained_bytes = 0;
  void shape(int N, int P, int D, int W, int V) {
    if (N != n || P != p || D != d || W != width || V != duals)
      throw std::runtime_error("checkpoint shape mismatch");
  }
  void row(Bytes &b, ModularRank &rank, std::vector<bool> &selected, int cursor) {
    int lead = int(b.get(4)), column = int(b.get(4));
    uint32_t type = b.get(4), count = b.get(4);
    if (lead < 0 || lead >= width || column < 0 || column >= cursor || selected[column] || !count ||
        count > uint32_t(width) || type > 1)
      throw std::runtime_error("invalid checkpoint pivot metadata");
    selected[column] = true;
    SparseRow out;
    if (type) {
      if (count != uint32_t(width - lead))
        throw std::runtime_error("dense checkpoint width");
      for (uint32_t j = 0; j < count; j++) {
        int value = b.get(4);
        if (value < 0 || value >= p)
          throw std::runtime_error("dense checkpoint residue");
        if (value)
          out.push_back({lead + int(j), value});
      }
    } else
      for (uint32_t j = 0; j < count; j++) {
        int at = b.get(4), value = b.get(4);
        out.push_back({at, value});
      }
    rank.restore(lead, column, std::move(out));
  }

public:
  uint64_t written_bytes = 0;
  PairJournal(std::string target, std::string bind, int N, int P, int D, int W, int V)
      : path(std::move(target)), parts(path.string() + ".parts"), binding(std::move(bind)), n(N),
        p(P), d(D), width(W), duals(V) {
    if (binding.size() != 64 || binding.find_first_not_of("0123456789abcdef") != std::string::npos)
      throw std::runtime_error("checkpoint SHA256 binding required");
  }
  int load(ModularRank &rank) {
    retained_bytes = 0;
    if (std::filesystem::exists(parts))
      for (const auto &entry : std::filesystem::directory_iterator(parts))
        if (entry.is_regular_file() && !entry.is_symlink())
          retained_bytes += entry.file_size();
    if (!std::filesystem::exists(path))
      return 0;
    Bytes m = read_small(path, 64 * 1024 * 1024);
    uint64_t expected = 0;
    if (m.data.size() < 112)
      throw std::runtime_error("checkpoint header missing");
    for (unsigned i = 0; i < 8; i++)
      expected |= uint64_t(m.data[m.data.size() - 8 + i]) << (8 * i);
    if (hash_bytes(m.data.data(), m.data.size() - 8) != expected)
      throw std::runtime_error("journal manifest checksum");
    if (m.text(8) != "FKPAIR02" || m.text(64) != binding)
      throw std::runtime_error("journal input binding mismatch; import legacy states explicitly");
    int N = m.get(4), P = m.get(4), D = m.get(4), W = m.get(4), V = m.get(4);
    shape(N, P, D, W, V);
    int cursor = m.get(4), count = m.get(4);
    uint32_t nc = m.get(4);
    if (cursor < 0 || cursor > duals || count < 0 || count > width || count > cursor ||
        nc > uint32_t(count))
      throw std::runtime_error("journal rank/cursor");
    std::vector<bool> selected(duals, false);
    for (uint32_t i = 0; i < nc; i++) {
      Chunk c;
      c.begin = m.get(4);
      c.end = m.get(4);
      c.hash = m.get(8);
      unsigned len = m.get(4);
      if (len > 120)
        throw std::runtime_error("chunk filename limit");
      c.name = m.text(len);
      if (c.name.empty() ||
          c.name.find_first_not_of("0123456789abcdef-_.kpc") != std::string::npos ||
          c.name.find("..") != std::string::npos || c.begin != rank.rank() || c.end <= c.begin ||
          c.end > uint32_t(count))
        throw std::runtime_error("journal chunk coverage/path");
      Bytes packed = read_small(parts / c.name, 64 * 1024 * 1024);
      if (packed.text(8) != "KIRPIV02")
        throw std::runtime_error("chunk magic");
      uint32_t flags = packed.get(4);
      size_t bytes = packed.get(8);
      uint64_t digest = packed.get(8);
      if (bytes > 64 * 1024 * 1024 || digest != c.hash)
        throw std::runtime_error("chunk header");
      Bytes raw;
      if (flags == 0) {
        raw.data.assign(packed.data.begin() + packed.at, packed.data.end());
        if (raw.data.size() != bytes)
          throw std::runtime_error("raw chunk length");
      } else if (flags == 1) {
#ifdef KIR_HAVE_ZSTD
        raw.data.resize(bytes);
        size_t got = ZSTD_decompress(raw.data.data(), bytes, packed.data.data() + packed.at,
                                     packed.data.size() - packed.at);
        if (ZSTD_isError(got) || got != bytes)
          throw std::runtime_error("zstd checkpoint decode");
#else
        throw std::runtime_error("this checkpoint needs a zstd-enabled build");
#endif
      } else
        throw std::runtime_error("unknown chunk compression");
      if (hash_bytes(raw.data.data(), raw.data.size()) != c.hash)
        throw std::runtime_error("chunk checksum");
      while (rank.rank() < c.end)
        row(raw, rank, selected, cursor);
      if (raw.at != raw.data.size())
        throw std::runtime_error("trailing pivot payload");
      chunks.push_back(c);
    }
    if (rank.rank() != size_t(count) || m.at + 8 != m.data.size())
      throw std::runtime_error("incomplete checkpoint coverage");
    saved = count;
    return cursor;
  }
  int import_legacy(const std::string &source, const std::string &old_binding, ModularRank &rank) {
    if (std::filesystem::exists(path) || std::filesystem::exists(parts))
      throw std::runtime_error("import destination exists");
    LegacyReader in(source);
    if (in.text(8) != "FKPAIR01" || in.text(64) != old_binding)
      throw std::runtime_error("legacy input binding");
    int N = in.get(4), P = in.get(4), D = in.get(4), W = in.get(4), V = in.get(4);
    shape(N, P, D, W, V);
    int cursor = in.get(4), count = in.get(4);
    if (cursor < 0 || cursor > duals || count < 0 || count > width || count > cursor)
      throw std::runtime_error("legacy rank/cursor");
    std::vector<bool> selected(duals, false);
    for (int i = 0; i < count; i++) {
      int lead = in.get(4), column = in.get(4);
      uint32_t size = in.get(4);
      if (column < 0 || column >= cursor || selected[column] || !size || size > uint32_t(width))
        throw std::runtime_error("legacy pivot metadata");
      selected[column] = true;
      SparseRow row;
      row.reserve(size);
      for (uint32_t j = 0; j < size; j++) {
        int at = in.get(4), value = in.get(4);
        row.push_back({at, value});
      }
      rank.restore(lead, column, std::move(row));
    }
    in.finish();
    save(rank, cursor);
    return cursor;
  }
  void save(const ModularRank &rank, int cursor) {
    if (cursor < 0 || cursor > duals || rank.rank() > size_t(cursor))
      throw std::runtime_error("checkpoint cursor");
    std::filesystem::create_directories(parts);
    // Publish the chunk list only with the new manifest. An interrupted save
    // may leave reusable orphan chunks, but must not alter the old generation.
    auto next_chunks = chunks;
    size_t begin = saved;
    while (begin < rank.rank()) {
      Bytes raw;
      size_t end = begin;
      do {
        int lead = rank.rows[end];
        const auto &pivot = rank.pivots[lead];
        raw.put(lead, 4);
        raw.put(rank.columns[end], 4);
        raw.put(!pivot.dense.empty(), 4);
        raw.put(pivot.dense.empty() ? pivot.sparse.size() : pivot.dense.size(), 4);
        if (!pivot.dense.empty())
          for (int value : pivot.dense)
            raw.put(value, 4);
        else
          for (auto e : pivot.sparse) {
            raw.put(e.index, 4);
            raw.put(e.value, 4);
          }
        end++;
      } while (end < rank.rank() && raw.data.size() < 4 * 1024 * 1024);
      uint64_t digest = hash_bytes(raw.data.data(), raw.data.size());
      Bytes payload;
      unsigned flags = 0;
#ifdef KIR_HAVE_ZSTD
      payload.data.resize(ZSTD_compressBound(raw.data.size()));
      size_t size = ZSTD_compress(payload.data.data(), payload.data.size(), raw.data.data(),
                                  raw.data.size(), 1);
      if (ZSTD_isError(size))
        throw std::runtime_error("zstd checkpoint encode");
      payload.data.resize(size);
      if (size < raw.data.size())
        flags = 1;
#endif
      if (!flags)
        payload.data = std::move(raw.data);
      Bytes packed;
      packed.text("KIRPIV02");
      packed.put(flags, 4);
      packed.put(flags ? raw.data.size() : payload.data.size(), 8);
      packed.put(digest, 8);
      packed.data.insert(packed.data.end(), payload.data.begin(), payload.data.end());
      char name[100];
      std::snprintf(name, sizeof(name), "%08x-%08x-%016llx.kpc", unsigned(begin), unsigned(end),
                    (unsigned long long)digest);
      auto chunk = parts / name;
      if (std::filesystem::exists(chunk)) {
        auto old = read_small(chunk, 64 * 1024 * 1024);
        if (old.data != packed.data)
          throw std::runtime_error("conflicting immutable pivot chunk");
      } else {
        if (const char *cap = std::getenv("KIR_CHECKPOINT_BYTES")) {
          uint64_t budget = std::stoull(cap);
          if (budget && (retained_bytes > budget || packed.data.size() > budget - retained_bytes))
            throw std::runtime_error("checkpoint disk budget; prior generation preserved");
        }
        if (std::filesystem::space(parts).available < packed.data.size() + 4 * 1024 * 1024)
          throw std::runtime_error("checkpoint disk headroom; prior generation preserved");
        durable_write(chunk, packed.data);
        written_bytes += packed.data.size();
        retained_bytes += packed.data.size();
      }
      next_chunks.push_back({name, uint32_t(begin), uint32_t(end), digest});
      begin = end;
    }
    Bytes m;
    m.text("FKPAIR02");
    m.text(binding);
    for (int x : {n, p, d, width, duals, cursor, int(rank.rank()), int(next_chunks.size())})
      m.put(x, 4);
    for (const auto &c : next_chunks) {
      m.put(c.begin, 4);
      m.put(c.end, 4);
      m.put(c.hash, 8);
      m.put(c.name.size(), 4);
      m.text(c.name);
    }
    m.put(hash_bytes(m.data.data(), m.data.size()), 8);
    if (std::filesystem::space(parts).available < m.data.size() + 4 * 1024 * 1024)
      throw std::runtime_error("checkpoint manifest disk headroom; prior generation preserved");
    durable_write(path, m.data);
    written_bytes += m.data.size();
    chunks.swap(next_chunks);
    saved = rank.rank();
  }
};
} // namespace kir
