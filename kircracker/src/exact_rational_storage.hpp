// SPDX-License-Identifier: MIT
#pragma once
// Immutable exact coefficient interning and bounded, rebuildable row caches.
#include <gmpxx.h>
#include <cstdint>
#include <limits>
#include <list>
#include <memory>
#include <stdexcept>
#include <unordered_map>
#include <utility>
#include <vector>

namespace kir {
class ExactRationalPool {
  using Id = uint32_t;
  static constexpr Id none = std::numeric_limits<Id>::max();
  std::vector<mpq_class> values_{mpq_class(0), mpq_class(1), mpq_class(-1)};
  std::vector<Id> next_{none, none, none};
  std::unordered_map<uint64_t, Id> heads_;
  size_t limb_bytes_ = 0;

  static uint64_t hash_integer(mpz_srcptr z, uint64_t h) {
    h = (h ^ uint64_t(mpz_sgn(z) + 1)) * 1099511628211ULL;
    h = (h ^ uint64_t(mpz_size(z))) * 1099511628211ULL;
    for (size_t i = 0; i < mpz_size(z); ++i)
      h = (h ^ uint64_t(mpz_getlimbn(z, i))) * 1099511628211ULL;
    return h;
  }

public:
  Id intern(const mpq_class &value) {
    if (value == 0) return 0;
    if (value == 1) return 1;
    if (value == -1) return 2;
    // Inputs are canonical GMP rationals. A hash collision never implies equality.
    uint64_t h = hash_integer(value.get_num_mpz_t(), 1469598103934665603ULL);
    h = hash_integer(value.get_den_mpz_t(), h);
    auto found = heads_.find(h);
    Id previous = found == heads_.end() ? none : found->second;
    for (Id id = previous; id != none; id = next_[id])
      if (values_[id] == value) return id;
    if (values_.size() >= none)
      throw std::runtime_error("exact coefficient index limit");
    Id id = Id(values_.size());
    values_.push_back(value);
    next_.push_back(previous);
    heads_[h] = id;
    limb_bytes_ += (mpz_size(value.get_num_mpz_t()) + mpz_size(value.get_den_mpz_t())) * sizeof(mp_limb_t);
    return id;
  }
  const mpq_class &operator[](Id id) const { return values_[id]; }
  size_t size() const { return values_.size(); }
  // Logical storage charge; allocator/GMP spare capacity is controlled by RSS admission.
  size_t allocated_bytes() const {
    return values_.capacity() * sizeof(mpq_class) + next_.capacity() * sizeof(Id)
           + heads_.bucket_count() * sizeof(void *)
           + heads_.size() * (sizeof(std::pair<const uint64_t, Id>) + 2 * sizeof(void *))
           + limb_bytes_;
  }
};

template <class Key, class Row> class ExactRowCache {
  struct Entry { Row row; size_t bytes; typename std::list<Key>::iterator age; };
  std::unordered_map<Key, Entry> rows_;
  std::list<Key> ages_;
  std::unique_ptr<Row> scratch_;
  size_t budget_, bytes_ = 0, scratch_bytes_ = 0;

public:
  uint64_t hits = 0, misses = 0, evictions = 0, oversized = 0;
  explicit ExactRowCache(size_t budget) : budget_(budget) {}
  size_t size() const { return rows_.size(); }
  size_t allocated_bytes() const { return bytes_ + scratch_bytes_; }
  size_t budget() const { return budget_; }

  // The borrowed reference is valid until the next get(). Eviction changes no
  // source row, row ID, coefficient or proof journal; discarded rows are rebuilt.
  template <class Build, class Charge>
  const Row &get(const Key &key, Build build, Charge charge) {
    scratch_.reset(); scratch_bytes_ = 0;
    auto found = rows_.find(key);
    if (found != rows_.end()) {
      ++hits;
      ages_.splice(ages_.begin(), ages_, found->second.age);
      return found->second.row;
    }
    ++misses;
    Row row = build();
    size_t cost = charge(row) + sizeof(Entry) + sizeof(Key) + 4 * sizeof(void *);
    if (cost > budget_) {
      ++oversized;
      scratch_bytes_ = cost;
      scratch_ = std::make_unique<Row>(std::move(row));
      return *scratch_;
    }
    while (bytes_ > budget_ - cost) {
      auto old = rows_.find(ages_.back());
      bytes_ -= old->second.bytes;
      rows_.erase(old); ages_.pop_back(); ++evictions;
    }
    ages_.push_front(key);
    auto added = rows_.emplace(key, Entry{std::move(row), cost, ages_.begin()});
    bytes_ += cost;
    return added.first->second.row;
  }
};
} // namespace kir
