CXX ?= g++
.DEFAULT_GOAL := all
CPPFLAGS := -Isrc
BASEFLAGS := -std=c++17 -O3 -flto -pthread -Wall -Wextra
CXXFLAGS ?= $(BASEFLAGS)
NATIVE ?= 0
ifeq ($(NATIVE),1)
CXXFLAGS += -march=native -mtune=native
endif
BIN := bin/kir-relative bin/libpair.so bin/libverify.so bin/libtriepair.so bin/libconvolve.so
PREFIX ?= $(HOME)/.local
DESTDIR ?=
.PHONY: all check native clean test install proof-tools
check:
	CXX="$(CXX)" bash tools/check-host.sh
all: $(BIN) bin/exact-quotient-audit
	python3 tools/record_build.py --compiler "$(CXX)" --flags "$(CXXFLAGS)"
native:
	$(MAKE) clean
	$(MAKE) NATIVE=1 all proof-tools
bin:
	mkdir -p $@
bin/kir-relative: src/module_builder.cpp src/common.hpp src/checkpoint_io.hpp | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $< -o $@
bin/libpair.so: src/pair_kernel.cpp src/minor_stream.inc | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -fPIC -shared $< -o $@
bin/libverify.so: src/prefix_verify.cpp | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -fPIC -shared $< -o $@
bin/libtriepair.so: src/trie_discovery.cpp src/pair_kernel.cpp src/minor_stream.inc | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -fPIC -shared $< -o $@
bin/libconvolve.so: src/group_convolution.cpp | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -fPIC -shared $< -o $@
proof-tools: bin/exact-quotient-audit
bin/exact-quotient-audit: src/exact_quotient_audit.cpp | bin
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) $< -lgmpxx -lgmp -o $@
test: all
	python3 -m unittest discover -s tests -v
clean:
	rm -f $(BIN) bin/exact-quotient-audit
install: all proof-tools
	python3 tools/install.py --prefix "$(DESTDIR)$(PREFIX)"
