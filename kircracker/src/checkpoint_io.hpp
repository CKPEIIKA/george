#pragma once
// MIT. Local immutable, endian-stable degree checkpoints; original mathematical
// recurrence is unchanged. FNV validates accidental corruption; host SHA256 binds
// files to evidence. Neither hash is treated as mathematical proof.
#include <algorithm>
#include <cerrno>
#include <csignal>
#include <cstdint>
#include <cstring>
#include <fcntl.h>
#include <filesystem>
#include <fstream>
#include <stdexcept>
#include <string>
#include <unistd.h>
#include <vector>
static volatile std::sig_atomic_t kk_interrupted = 0;
static void kk_signal(int) { kk_interrupted = 1; }
static uint64_t kk_hash(uint64_t h, const unsigned char *p, size_t n) {
  for (size_t i = 0; i < n; i++) {
    h ^= p[i];
    h *= 1099511628211ULL;
  }
  return h;
}
class BinaryWriter {
  std::string target, temp;
  std::ofstream out;
  std::vector<unsigned char> buffer = std::vector<unsigned char>(1 << 20);
  size_t buffered = 0;
  uint64_t hash = 1469598103934665603ULL;
  bool done = false;
  void flush_buffer() {
    if (!buffered)
      return;
    out.write(reinterpret_cast<const char *>(buffer.data()), buffered);
    if (!out)
      throw std::runtime_error("checkpoint write failed (disk full?)");
    hash = kk_hash(hash, buffer.data(), buffered);
    buffered = 0;
  }
  void bytes(const void *source, size_t n) {
    const auto *p = static_cast<const unsigned char *>(source);
    while (n) {
      size_t take = std::min(n, buffer.size() - buffered);
      std::memcpy(buffer.data() + buffered, p, take);
      buffered += take;
      p += take;
      n -= take;
      if (buffered == buffer.size())
        flush_buffer();
    }
  }

public:
  BinaryWriter(std::string path, const std::string &binding, uint32_t d, uint32_t k, uint32_t prime,
               uint64_t previous, uint64_t words, uint64_t actions, bool scoped = false)
      : target(path), temp(path + ".tmp-" + std::to_string(getpid())),
        out(temp, std::ios::binary | std::ios::trunc) {
    if (!out)
      throw std::runtime_error("cannot open checkpoint");
    bytes(scoped ? "KKRSCOP1" : "KKRMAP01", 8);
    bytes(binding.data(), 64);
    number(d, 4);
    number(k, 4);
    number(prime, 4);
    number(scoped ? 1 : 0, 4);
    number(previous, 8);
    number(words, 8);
    number(actions, 8);
  }
  void number(uint64_t x, unsigned n) {
    unsigned char b[8];
    for (unsigned i = 0; i < n; i++) {
      b[i] = x & 255;
      x >>= 8;
    }
    bytes(b, n);
  }
  void finish() {
    if (kk_interrupted)
      throw std::runtime_error("interrupted before checkpoint commit");
    flush_buffer();
    uint64_t h = hash;
    unsigned char b[8];
    for (unsigned i = 0; i < 8; i++) {
      b[i] = h & 255;
      h >>= 8;
    }
    out.write((char *)b, 8);
    out.flush();
    if (!out)
      throw std::runtime_error("checkpoint flush failed");
    out.close();
    int fd = open(temp.c_str(), O_RDONLY);
    if (fd < 0 || fsync(fd)) {
      if (fd >= 0)
        close(fd);
      throw std::runtime_error("checkpoint fsync failed");
    }
    close(fd);
    std::filesystem::rename(temp, target);
    fd = open(std::filesystem::path(target).parent_path().c_str(), O_RDONLY | O_DIRECTORY);
    if (fd >= 0) {
      fsync(fd);
      close(fd);
    }
    done = true;
  }
  ~BinaryWriter() {
    if (!done) {
      out.close();
      std::error_code ec;
      std::filesystem::remove(temp, ec);
    }
  }
};
class BinaryReader {
  std::ifstream in;
  uint64_t hash = 1469598103934665603ULL;
  void bytes(void *p, size_t n) {
    if (!in.read((char *)p, n))
      throw std::runtime_error("truncated checkpoint");
    hash = kk_hash(hash, (const unsigned char *)p, n);
  }

public:
  uint64_t previous, words, actions;
  BinaryReader(const std::string &path, const std::string &binding, uint32_t d, uint32_t k,
               uint32_t prime, bool scoped = false)
      : in(path, std::ios::binary) {
    char magic[8], bind[64];
    bytes(magic, 8);
    bytes(bind, 64);
    if (std::memcmp(magic, scoped ? "KKRSCOP1" : "KKRMAP01", 8) || std::string(bind, 64) != binding)
      throw std::runtime_error("checkpoint format/input mismatch");
    if (number(4) != d || number(4) != k || number(4) != prime || number(4) != (scoped ? 1 : 0))
      throw std::runtime_error("checkpoint degree/field mismatch");
    previous = number(8);
    words = number(8);
    actions = number(8);
  }
  uint64_t number(unsigned n) {
    unsigned char b[8];
    bytes(b, n);
    uint64_t v = 0;
    for (unsigned i = 0; i < n; i++)
      v |= uint64_t(b[i]) << (8 * i);
    return v;
  }
  void finish() {
    uint64_t want = 0;
    unsigned char b[8];
    if (!in.read((char *)b, 8))
      throw std::runtime_error("missing checkpoint checksum");
    for (unsigned i = 0; i < 8; i++)
      want |= uint64_t(b[i]) << (8 * i);
    char c;
    if (want != hash || in.get(c))
      throw std::runtime_error("checkpoint checksum/trailing data");
  }
};
