# 0.4.0 verification note

The speed/progress changes add no new browser API. The release re-tests shared and
unshared WASM32/WASM64 plus capability-negation and I/O-broker protocols using actual
WASM in Node. This is not a new Firefox/Chromium conformance test or a deployment to
the user's live site. Historical browser attempts remain under
`reference/0.3.0/results/`; the following describes the inherited compatibility design.

# Browser/static-host compatibility, 0.3.0

## What was actually tested

`reference/0.3.0/results/browser-tests.json` records the real attempted browser matrix. Firefox failed
to launch because the Playwright Firefox binary was absent. Chromium launched, then
its first localhost navigation failed with `net::ERR_BLOCKED_BY_ADMINISTRATOR`. These
are **not passing browser tests**. No attempt was made to bypass that policy.

The completed Node suite executes all four actual compiled WASM binaries and real
worker threads, while replacing OPFS with a filesystem adapter. It checks absence of
isolation and of SharedArrayBuffer, simulated missing memory64, unsupported concurrent
file handles, storage denial, strict fallback policies, resume across modes and exact
algebra outputs. `static-host-unit-tests.json` tests the service-worker protocol with
mocks; it does not establish a Firefox navigation result.

`tests/test_browsers.py` is an executable, fail-on-error matrix. It serves a real project
subpath under two local HTTP origins: one with isolation headers and one without. It
uses actual browser workers/OPFS, checks the single-worker fallback, forced shared
execution, portable OPFS, memory64 or declared fallback, long words, fragment preservation,
project service-worker activation and absence of control on a sibling path. A missing
browser is a failure, not a skip marked passed. The CI workflow runs Firefox and Chromium
separately and uploads their reports. This workflow has not been executed remotely here.

## Capability ladder

1. `execution:auto` tests isolation and shared WASM construction. If unavailable, it
   loads `fomkyr32-single.wasm` or `fomkyr64-single.wasm`; merely setting workers=1 on a
   shared-memory binary would not remove the isolation requirement.
2. WASM32 is chosen for budgets in its range. Larger requests use memory64. A failed
   memory64 memory/module initialization falls back to WASM32 unless strict settings
   prohibit it. Effective memory is reported, not silently left at the requested size.
3. With OPFS and multiple lanes, direct mode probes *two simultaneous* unsafe handles.
   On failure it uses `io-worker.js`: one normal exclusive handle, fixed 64 KiB mailboxes,
   and shared atomic request/response signaling. Compute workers retain parallelism.
4. With one lane, the compute coordinator can use an exclusive OPFS handle itself.
5. If OPFS permission/API/initialization is unavailable, automatic storage mode can use
   bounded RAM with a warning. `storageFallback:false` or `resume:true` rejects this.
   A busy existing cache is never evaded by silently switching storage.

Mailbox storage is outside the kernel allocator and is explicitly reported. The owner
services only I/O; serial file access is a possible bottleneck. Reducer caches avoid
repeated reads, but no browser speedup factor is asserted for this path.

## GitHub Pages/static publishing

Run the installer against a local George checkout and publish its `web/` tree using the
existing project workflow. Do not publish only the C sources or only one WASM variant.
Keep modules and their generated `build-info.js` together: cached binaries are checked
against SHA256. The installer adds `.nojekyll`; no special server executable is required.

All runtime URLs are resolved relative to modules. A project URL such as `/george/` is
supported by construction, not replaced with hardcoded root `/engine/` paths. Serve over
HTTPS (or localhost in development). Do not launch with `file://`.

For a host with configurable headers, the conventional isolation setup is:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The permissions policy must not deny cross-origin isolation. Cross-origin resources must
meet their CORS/CORP requirements. Shared memory is not enabled by an HTML meta tag.

For a static host without custom response headers, keep George's existing isolation
bootstrap where present. The additional `fomkyr-isolation-worker.js` is an opt-in helper
at the project root. It adds the same isolation headers to same-origin responses, does
not cache algebra data, and does not intercept cross-origin requests. Registration is
project-scoped and refuses to replace another controlling worker. Activation has a
10-second timeout; automatic reload is attempted at most once per session/scope. The
URL fragment is not rewritten. The automatic compute fallback remains usable if the
browser does not grant isolation, service workers are blocked or the page is embedded
in an unsuitable context.

The worker cannot change policy set by an embedding page or browser administrator.
It is not a guarantee that every browser/profile will grant isolation on every static
host. The runtime status must actually say `shared`, not merely “service worker installed.”
Save unsaved input before requesting a reload.

## Storage and cancellation

OPFS cache keys include presentation/order/field, not number of lanes, bitness or target
degree. A run can move from single-worker/32-bit to shared/64-bit without recomputing a
valid stored prefix. ABI-2 short-word records are read by ABI 3; the reverse is unsupported.
Private browsing, storage eviction, quota and user deletion can remove data. A successful
`persist()` request is neither an export nor an irrevocable guarantee.

Shared-mode cancellation uses an atomic flag. Unshared-mode cancellation is delivered
between coordinator batches/degrees; the C clock deadline also bounds a long synchronous
reduction. A manual cancellation message cannot preempt an arbitrary unshared synchronous
C call immediately. George retains its termination fallback; the last flushed degree
checkpoint, not the incomplete current degree, is the recovery point.

## Primary references consulted

- MDN, crossOriginIsolated:
  https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated
- MDN, createSyncAccessHandle; dedicated-worker and locking requirements:
  https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle
- MDN, WebAssembly.Memory constructor:
  https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory/Memory
- SpiderMonkey, memory64 costs and capabilities:
  https://spidermonkey.dev/blog/2025/01/15/is-memory64-actually-worth-using.html
- George source shapes inspected on 2026-10-02:
  https://github.com/CKPEIIKA/george/tree/main/web

Source documentation is not substituted for an actual browser test report.
