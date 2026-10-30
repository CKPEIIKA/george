#pragma once
// SPDX-License-Identifier: MIT
// Exact incremental column elimination. Established pivots are immutable.
#include "modular_field.hpp"
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <functional>
#include <stdexcept>
#include <string>
#include <vector>
#include <limits>
struct ModularPivot {
  std::vector<SparseEntry> sparse;
  std::vector<int> dense;
  size_t nonzeros = 0;
  bool empty() const { return sparse.empty() && dense.empty(); }
  template <class F> void each(int lead, F fn) const {
    if (!dense.empty()) {
      for (size_t j = 0; j < dense.size(); j++)
        if (dense[j])
          fn(lead + int(j), dense[j]);
    } else
      for (auto e : sparse)
        fn(e.index, e.value);
  }
  size_t allocated_bytes() const {
    return sparse.capacity() * sizeof(SparseEntry) + dense.capacity() * sizeof(int);
  }
};
class ModularRank {
  int width_, prime_;
  double dense_threshold_;
  size_t payload_bytes_ = 0;
  bool delayed_ = false;
  std::vector<uint64_t> accumulation_;

public:
  std::vector<ModularPivot> pivots;
  std::vector<int> rows, columns;
  std::function<void()> cooperate;
  uint64_t axpys = 0, updates = 0, delayed_flushes = 0;
  bool uses_delayed_reduction() const { return delayed_; }
  ModularRank(int width, int prime, double threshold = .55)
      : width_(width), prime_(prime), dense_threshold_(threshold), pivots(width) {
    if (width < 1 || prime < 2)
      throw std::runtime_error("invalid rank field/dimensions");
    if (const char *mode = std::getenv("KIR_RANK_MODE")) {
      std::string name(mode);
      if (name != "reference" && name != "delayed")
        throw std::runtime_error("KIR_RANK_MODE must be reference or delayed");
      delayed_ = name == "delayed";
    }
    if (const char *value = std::getenv("KIR_DENSE_THRESHOLD")) {
      size_t used = 0;
      std::string text(value);
      double ratio = std::stod(text, &used);
      if (used != text.size() || !std::isfinite(ratio) || ratio < 0 || ratio > 1)
        throw std::runtime_error("dense threshold must be in 0..1");
      dense_threshold_ = ratio;
    }
  }
  int width() const { return width_; }
  int prime() const { return prime_; }
  size_t rank() const { return rows.size(); }
  void restore(int lead, int column, SparseRow row) {
    if (lead < 0 || lead >= width_ || !pivots[lead].empty() || row.empty() ||
        row.front().index != lead || row.front().value != 1)
      throw std::runtime_error("invalid restored pivot");
    int previous = lead - 1;
    for (auto e : row) {
      if (e.index <= previous || e.index >= width_ || e.value <= 0 || e.value >= prime_)
        throw std::runtime_error("invalid restored coefficient");
      previous = e.index;
    }
    auto &pivot = pivots[lead];
    pivot.nonzeros = row.size();
    if (row.size() > size_t((width_ - lead) * dense_threshold_)) {
      pivot.dense.resize(width_ - lead);
      for (auto e : row)
        pivot.dense[e.index - lead] = e.value;
    } else {
      row.shrink_to_fit();
      pivot.sparse = std::move(row);
    }
    payload_bytes_ += pivot.allocated_bytes();
    rows.push_back(lead);
    columns.push_back(column);
  }
  template <int FixedPrime> bool offer_impl(std::vector<int> &values, int column) {
    const int prime = FixedPrime ? FixedPrime : prime_;
    if (values.size() != size_t(width_))
      throw std::runtime_error("rank column width");
    for (int lead = 0; lead < width_; lead++)
      if (int coefficient = values[lead]) {
        if (cooperate)
          cooperate();
        auto &pivot = pivots[lead];
        if (pivot.empty()) {
          int inverse = modpow(coefficient, prime);
          SparseRow row;
          for (int j = lead; j < width_; j++)
            if (values[j])
              row.push_back({j, int(int64_t(values[j]) * inverse % prime)});
          restore(lead, column, std::move(row));
          return true;
        }
        axpys++;
        pivot.each(lead, [&](int at, int value) {
          int64_t result = int64_t(values[at]) - int64_t(coefficient) * value % prime;
          if (result < 0)
            result += prime;
          values[at] = int(result);
          updates++;
        });
      }
    return false;
  }
  /* Exact positive representatives delay expensive remainder operations.
   * If at most B pivots have been applied since the last flush, each entry is
   * <= (p-1) + B*(p-1)^2. Choose B from UINT64_MAX, so no wraparound is used as
   * modular arithmetic. Pivot selection still reduces its entry immediately.
   * Immutable pivots, row IDs and journal bytes are identical to reference mode.
   * A cancellation discards this one input accumulator, not accepted pivots. */
  template <int FixedPrime>
  bool offer_delayed(std::vector<int> &values, int column) {
    const int p = FixedPrime ? FixedPrime : prime_;
    if (values.size() != size_t(width_))
      throw std::runtime_error("rank column width");
    accumulation_.resize(width_);
    for (int j = 0; j < width_; ++j) {
      if (values[j] < 0 || values[j] >= p)
        throw std::runtime_error("noncanonical modular input");
      accumulation_[j] = uint64_t(values[j]);
    }
    const uint64_t pm1 = uint64_t(p - 1);
    const uint64_t max_steps = (std::numeric_limits<uint64_t>::max() - pm1) / (pm1 * pm1);
    uint64_t since_flush = 0;
    auto finish = [&]() {
      for (int j = 0; j < width_; ++j)
        values[j] = int(accumulation_[j] % uint64_t(p));
    };
    for (int lead = 0; lead < width_; ++lead) {
      int coefficient = int(accumulation_[lead] % uint64_t(p));
      if (!coefficient) continue;
      if (cooperate) cooperate();
      auto &pivot = pivots[lead];
      if (pivot.empty()) {
        int inverse = modpow(coefficient, p);
        finish();
        SparseRow row;
        for (int j = lead; j < width_; ++j)
          if (values[j]) row.push_back({j, int(int64_t(values[j]) * inverse % p)});
        restore(lead, column, std::move(row));
        return true;
      }
      // Flush before a further positive product could overflow uint64_t.
      if (since_flush == max_steps) {
        for (int j = lead; j < width_; ++j) accumulation_[j] %= uint64_t(p);
        since_flush = 0; delayed_flushes++;
      }
      const uint64_t factor = uint64_t(p - coefficient);
      if (!pivot.dense.empty()) {
        auto *dst = accumulation_.data() + lead;
        const auto *src = pivot.dense.data();
        // Contiguous, branch-free dense update. Zero entries add exactly zero.
        for (size_t j = 0; j < pivot.dense.size(); ++j)
          dst[j] += factor * uint64_t(src[j]);
      } else {
        for (auto entry : pivot.sparse)
          accumulation_[entry.index] += factor * uint64_t(entry.value);
      }
      axpys++; updates += pivot.nonzeros; since_flush++;
    }
    finish();
    return false;
  }
  bool offer(std::vector<int> &values, int column) {
    if (delayed_)
      return prime_ == 1000003 ? offer_delayed<1000003>(values, column) : offer_delayed<0>(values, column);
    return prime_ == 1000003 ? offer_impl<1000003>(values, column) : offer_impl<0>(values, column);
  }
  size_t allocated_bytes() const {
    size_t bytes = pivots.capacity() * sizeof(ModularPivot) +
                   (rows.capacity() + columns.capacity()) * sizeof(int);
    return bytes + payload_bytes_ + accumulation_.capacity() * sizeof(uint64_t);
  }
};
