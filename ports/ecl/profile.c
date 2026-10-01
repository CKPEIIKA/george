/* Optional measurement bridge. This file is absent from production builds. */
#include <stdint.h>
#include <ecl/gc/gc.h>
#include <emscripten/emscripten.h>

static GC_on_collection_event_proc previous_event;
static int active;
static size_t previous_bytes;
static uint64_t allocated_bytes;
static double collection_started;
static double collection_ms;
static GC_word initial_collection;

static void account_allocations(void)
{
  size_t current = GC_get_total_bytes();
  /* Sampling at collection boundaries handles a wrapping wasm32 counter. */
  allocated_bytes += (size_t)(current - previous_bytes);
  previous_bytes = current;
}

static void GC_CALLBACK collection_event(GC_EventType event)
{
  if (event == GC_EVENT_START) {
    account_allocations();
    collection_started = emscripten_get_now();
  } else if (event == GC_EVENT_END) {
    collection_ms += emscripten_get_now() - collection_started;
    account_allocations();
  }
  if (previous_event) previous_event(event);
}

EMSCRIPTEN_KEEPALIVE void george_profile_start(void)
{
  if (active) GC_set_on_collection_event(previous_event);
  previous_event = GC_get_on_collection_event();
  previous_bytes = GC_get_total_bytes();
  allocated_bytes = 0;
  collection_ms = 0;
  initial_collection = GC_get_gc_no();
  GC_set_on_collection_event(collection_event);
  active = 1;
}

EMSCRIPTEN_KEEPALIVE void george_profile_stop(void)
{
  if (active) {
    account_allocations();
    GC_set_on_collection_event(previous_event);
    active = 0;
  }
}

EMSCRIPTEN_KEEPALIVE double george_profile_allocated_bytes(void)
{
  return (double)allocated_bytes;
}
EMSCRIPTEN_KEEPALIVE double george_profile_gc_ms(void)
{
  return collection_ms;
}
EMSCRIPTEN_KEEPALIVE double george_profile_collections(void)
{
  return (double)(GC_get_gc_no() - initial_collection);
}
EMSCRIPTEN_KEEPALIVE double george_profile_heap_bytes(void)
{
  return (double)GC_get_heap_size();
}
EMSCRIPTEN_KEEPALIVE double george_profile_free_bytes(void)
{
  return (double)GC_get_free_bytes();
}
