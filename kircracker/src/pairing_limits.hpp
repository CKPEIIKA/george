#pragma once
// SPDX-License-Identifier: MIT
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <limits>
#include <stdexcept>
#include <string>
namespace kir {
constexpr int exact_degree = 24;
constexpr int discovery_rows = 250000;
constexpr int minor_rank = 250000;
constexpr int candidate_columns = 2000000;
inline std::size_t polynomial_term_limit() {
  const char *value = std::getenv("KIR_POLY_MAX_TERMS");
  if (!value || std::string(value) == "0")
    return std::numeric_limits<uint32_t>::max() - 1;
  std::string text(value);
  if (text.empty() || text.find_first_not_of("0123456789") != std::string::npos)
    throw std::runtime_error("invalid polynomial term limit");
  auto limit = std::stoull(text);
  if (limit >= std::numeric_limits<uint32_t>::max())
    throw std::runtime_error("polynomial index width");
  return std::size_t(limit);
}
} // namespace kir
