CXX ?= g++
.DEFAULT_GOAL := all
CPPFLAGS := -Isrc
GMP_PREFIX ?=
GMP_LIBS := -lgmpxx -lgmp
ifneq ($(strip $(GMP_PREFIX)),)
CPPFLAGS += -I$(GMP_PREFIX)/include
GMP_LIBS := -L$(GMP_PREFIX)/lib -Wl,-rpath,$(GMP_PREFIX)/lib -lgmpxx -lgmp
endif
BASEFLAGS := -std=c++20 -O3 -flto -pthread -Wall -Wextra
CXXFLAGS ?= $(BASEFLAGS)
ZSTD_LIBS := $(shell pkg-config --libs libzstd 2>/dev/null)
ifneq ($(strip $(ZSTD_LIBS)),)
CPPFLAGS += -DKIR_HAVE_ZSTD $(shell pkg-config --cflags libzstd 2>/dev/null)
endif
NATIVE ?= 0
ifeq ($(NATIVE),1)
CXXFLAGS += -march=native -mtune=native
endif
BIN := bin/kir-relative bin/libpair.so bin/libverify.so bin/libtriepair.so bin/libconvolve.so bin/libproofnf.so
PREFIX ?= $(HOME)/.local
DESTDIR ?=
.PHONY: all check native clean test install proof-tools relation-pilot projection-pilot
check:
	CXX="$(CXX)" GMP_PREFIX="$(GMP_PREFIX)" bash tools/check-host.sh
all: $(BIN) bin/exact-quotient-audit
	python3 tools/record_build.py --compiler "$(CXX)" --flags "$(CXXFLAGS)"
native:
	$(MAKE) clean
	$(MAKE) NATIVE=1 all proof-tools
bin:
	mkdir -p $@
bin/kir-relative: src/module_builder.cpp src/common.hpp src/checkpoint_io.hpp | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $< $(GMP_LIBS) -o $@
bin/libpair.so: src/pair_kernel.cpp src/minor_stream.inc src/modular_field.hpp src/pairing_limits.hpp | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -fPIC -shared $< -o $@
bin/libverify.so: src/prefix_verify.cpp src/pairing_limits.hpp src/polynomial_workspace.hpp src/modular_determinant.hpp src/verified_lu.hpp src/verified_lu.inc | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -fPIC -shared $< -o $@
bin/libtriepair.so: src/trie_discovery.cpp src/pair_kernel.cpp src/minor_stream.inc src/modular_field.hpp src/pairing_limits.hpp src/polynomial_workspace.hpp src/modular_rank.hpp src/pair_journal.hpp | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -fPIC -shared $< $(ZSTD_LIBS) -o $@
bin/libproofnf.so: proofkit_src/nf.cpp | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -fPIC -shared $< $(GMP_LIBS) -o $@
bin/libconvolve.so: src/group_convolution.cpp | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -fPIC -shared $< -o $@
proof-tools: bin/exact-quotient-audit
relation-pilot: bin/kir-contained-relations
projection-pilot: bin/kir-projected-relations
bin/kir-projected-relations: src/projected_relations.cpp src/contained_relations.cpp src/checkpoint_io.hpp | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $< $(GMP_LIBS) -o $@
bin/kir-contained-relations: src/contained_relations.cpp | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $< -o $@
bin/exact-quotient-audit: src/exact_quotient_audit.cpp | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $< $(GMP_LIBS) -o $@
test: all
	python3 -m unittest discover -s tests -v
clean:
	rm -f $(BIN) bin/exact-quotient-audit bin/kir-contained-relations bin/kir-projected-relations
install: all proof-tools
	python3 tools/install.py --prefix "$(DESTDIR)$(PREFIX)"
