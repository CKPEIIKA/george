#pragma once
// SPDX-License-Identifier: MIT
// Reusable full-key accumulator. A table index addresses a contiguous entry;
// zero coefficients are retained until finish() so cancellation never breaks probes.
#include <algorithm>
#include <cstdint>
#include <limits>
#include <stdexcept>
#include <vector>
template <class Coefficient> class WordWorkspace {
public:
  struct Entry {
    __uint128_t word;
    Coefficient value;
  };

private:
  std::vector<uint64_t> slots;
  uint32_t epoch = 1;
  std::vector<Entry> entries;
  static uint64_t hash(__uint128_t word) {
    uint64_t x = uint64_t(word) ^ uint64_t(word >> 64) * 0x9e3779b97f4a7c15ULL;
    x ^= x >> 30;
    x *= 0xbf58476d1ce4e5b9ULL;
    x ^= x >> 27;
    x *= 0x94d049bb133111ebULL;
    return x ^ (x >> 31);
  }
  void rehash(size_t size) {
    std::vector<uint64_t> next(size, 0);
    for (size_t i = 0; i < entries.size(); i++) {
      size_t at = hash(entries[i].word) & (size - 1);
      while (next[at])
        at = (at + 1) & (size - 1);
      next[at] = (uint64_t(epoch) << 32) | uint32_t(i + 1);
    }
    slots.swap(next);
  }

public:
  void clear() {
    entries.clear();
    if (++epoch == 0) {
      std::fill(slots.begin(), slots.end(), 0);
      epoch = 1;
    }
  }
  template <class Add> void add(__uint128_t word, Coefficient value, Add combine, size_t limit) {
    if (!value)
      return;
    if (slots.empty())
      rehash(32);
    if ((entries.size() + 1) * 10 > slots.size() * 7)
      rehash(slots.size() * 2);
    size_t at = hash(word) & (slots.size() - 1);
    while (uint32_t(slots[at] >> 32) == epoch) {
      auto &entry = entries[uint32_t(slots[at]) - 1];
      if (entry.word == word) {
        entry.value = combine(entry.value, value);
        return;
      }
      at = (at + 1) & (slots.size() - 1);
    }
    if (entries.size() >= limit)
      throw std::runtime_error("derivative workspace term limit");
    entries.push_back({word, value});
    slots[at] = (uint64_t(epoch) << 32) | uint32_t(entries.size());
  }
  const std::vector<Entry> &data() const { return entries; }
  size_t size() const { return entries.size(); }
  size_t allocated_bytes() const {
    return slots.capacity() * sizeof(uint64_t) + entries.capacity() * sizeof(Entry);
  }
};
