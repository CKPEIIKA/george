# Standalone C engine; optional WebAssembly distribution uses the same kernel.
.DEFAULT_GOAL := all
CC = cc
-include dist/native-config.mk
PREFIX ?= /usr/local
CFLAGS ?= -O3 -flto -std=c11 -Wall -Wextra
LDFLAGS ?= -flto -pthread
BUILD_DIR ?= dist
# Optional local tuning, e.g. NATIVE_ARCH=native; default builds stay portable.
NATIVE_ARCH ?=
NATIVE_PROFILE ?= lto
ARCHFLAGS = $(if $(NATIVE_ARCH),-march=$(NATIVE_ARCH))
HOST_CONFIG = $(wildcard dist/native-config.mk)
NATIVE = native/cli.c native/host.c native/support.c native/fixture.c
.PHONY: all check analyze native native-pgo wasm test install clean FORCE
all: native
check:
	bash tools/check-host.sh
analyze:
	python3 tools/analyze.py
native: $(BUILD_DIR)/fomkyr
native-pgo:
	FOMKYR_PGO_CC="$(CC)" NATIVE_ARCH="$(NATIVE_ARCH)" CFLAGS="$(CFLAGS)" LDFLAGS="$(LDFLAGS)" bash tools/build-native-pgo.sh
$(BUILD_DIR)/native-flags: FORCE
	@mkdir -p $(BUILD_DIR)
	@printf '%s\n' '$(CC)' '$(CFLAGS)' '$(ARCHFLAGS)' '$(LDFLAGS)' '$(PREFIX)' '$(NATIVE_PROFILE)' > $@.tmp
	@cmp -s $@.tmp $@ && rm $@.tmp || mv $@.tmp $@
ifeq ($(NATIVE_PROFILE),pgo)
$(BUILD_DIR)/fomkyr: src/kernel.c src/kernel.h $(wildcard src/*.inc src/*.h fk_gate/src/* fk_gate/profiles/*.h fk_gate/adapters/*.inc) $(NATIVE) $(wildcard native/*.h) tools/build-native-pgo.sh Makefile $(HOST_CONFIG) $(BUILD_DIR)/native-flags
	FOMKYR_PGO_CC="$(CC)" NATIVE_ARCH="$(NATIVE_ARCH)" CFLAGS="$(CFLAGS)" LDFLAGS="$(LDFLAGS)" bash tools/build-native-pgo.sh "$(BUILD_DIR)/native-pgo"
	cp "$(BUILD_DIR)/native-pgo/fomkyr" "$@"
else
$(BUILD_DIR)/kernel-native.o: src/kernel.c src/kernel.h $(wildcard src/*.inc src/*.h fk_gate/src/* fk_gate/profiles/*.h fk_gate/adapters/*.inc) Makefile $(HOST_CONFIG) $(BUILD_DIR)/native-flags
	$(CC) $(CFLAGS) $(ARCHFLAGS) -ffreestanding -fno-builtin -c src/kernel.c -o $@
$(BUILD_DIR)/fomkyr: $(BUILD_DIR)/kernel-native.o $(NATIVE) $(wildcard native/*.h) $(BUILD_DIR)/native-flags
	$(CC) $(CFLAGS) $(ARCHFLAGS) -DFOMKYR_DATADIR='"$(PREFIX)/share/fomkyr"' $(NATIVE) $(BUILD_DIR)/kernel-native.o $(LDFLAGS) -o $@
endif
wasm:
	bash tools/build.sh
install: native
	install -d $(DESTDIR)$(PREFIX)/bin $(DESTDIR)$(PREFIX)/share/fomkyr $(DESTDIR)$(PREFIX)/share/man/man1
	install -m 755 $(BUILD_DIR)/fomkyr $(DESTDIR)$(PREFIX)/bin/fomkyr
	cp -R web native $(DESTDIR)$(PREFIX)/share/fomkyr/
	cp package.json $(DESTDIR)$(PREFIX)/share/fomkyr/
	install -d $(DESTDIR)$(PREFIX)/share/fomkyr/tools $(DESTDIR)$(PREFIX)/share/fomkyr/fk_gate/profiles
	install -m 644 tools/verify-computation.py tools/export-verification.py $(DESTDIR)$(PREFIX)/share/fomkyr/tools/
	install -m 644 fk_gate/profiles/fk6-exact-through17.json fk_gate/profiles/fk6_q.h fk_gate/profiles/fk6_sectors.h fk_gate/profiles/proof-provenance.json $(DESTDIR)$(PREFIX)/share/fomkyr/fk_gate/profiles/
	install -m 644 LICENSE $(DESTDIR)$(PREFIX)/share/fomkyr/
	install -m 644 man/fomkyr.1 $(DESTDIR)$(PREFIX)/share/man/man1/fomkyr.1
clean:
	rm -f $(BUILD_DIR)/fomkyr $(BUILD_DIR)/kernel-native.o $(BUILD_DIR)/native-flags

# Independent streaming record/normalization precondition checker, not solver code.
.PHONY: audit-tools
audit-tools: $(BUILD_DIR)/packed-basis-audit
$(BUILD_DIR)/packed-basis-audit: tools/packed_basis_audit.c
	@mkdir -p $(BUILD_DIR)
	$(CC) -std=c11 -O2 -Wall -Wextra tools/packed_basis_audit.c -o $@
