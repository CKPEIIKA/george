#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <ecl/ecl.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define GEORGE_EXPORT EMSCRIPTEN_KEEPALIVE
#ifndef GEORGE_ROOT
#define GEORGE_ROOT "/george"
#endif
#else
#define GEORGE_EXPORT
#ifndef GEORGE_ROOT
#define GEORGE_ROOT "."
#endif
#endif

static int initialized = 0;

static void set_bergman_environment(const char *root)
{
  char path[4096];

  setenv("bmroot", root, 1);
  snprintf(path, sizeof(path), "%s/src", root);
  setenv("bmsrc", path, 1);
  snprintf(path, sizeof(path), "%s/domains", root);
  setenv("bmdomains", path, 1);
  snprintf(path, sizeof(path), "%s/auxil", root);
  setenv("bmaux", path, 1);
  setenv("bmauxil", path, 1);
  snprintf(path, sizeof(path), "%s/lap/ecl", root);
  setenv("bmload", path, 1);
  snprintf(path, sizeof(path), "%s/bin/ecl", root);
  setenv("bmexe", path, 1);
  setenv("bmvers", "1.001", 1);
  chdir(path);
}

GEORGE_EXPORT int george_init(void)
{
  const char *root = GEORGE_ROOT;
#ifndef __EMSCRIPTEN__
  const char *override = getenv("GEORGE_BMROOT");
  if (override && *override) root = override;
#endif

  set_bergman_environment(root);
  ecl_set_option(ECL_OPT_FRAME_STACK_SIZE, 32768);
  ecl_set_option(ECL_OPT_BIND_STACK_SIZE, 65536);
  ecl_set_option(ECL_OPT_LISP_STACK_SIZE, 262144);
  char *argv[] = { (char *)"george", NULL };
  if (!cl_boot(1, argv)) return 1;

  cl_object boot = ecl_read_from_cstring("(load \"boot.lisp\")");
  cl_object result = cl_safe_eval(boot, ECL_NIL, ECL_NIL);
  if (result == ECL_NIL) return 2;

  result = cl_safe_eval(ecl_read_from_cstring("(GEORGE:INITIALIZE)"), ECL_NIL, ECL_NIL);
  if (result == ECL_NIL) return 3;

  initialized = 1;
  return 0;
}

GEORGE_EXPORT int george_eval(const char *source, int echo_values)
{
  if (!initialized) return 10;
  cl_object evaluate_text_function = ecl_read_from_cstring("GEORGE:EVALUATE-TEXT");
  cl_object text = ecl_make_simple_base_string(source, -1);
  cl_object echo = echo_values ? ECL_T : ECL_NIL;
  cl_object result = cl_funcall(3, evaluate_text_function, text, echo);
  fflush(NULL);
  return result == ECL_NIL ? 1 : 0;
}

#ifndef __EMSCRIPTEN__
int main(int argc, char **argv)
{
  if (argc != 2) { fprintf(stderr, "usage: george-ecl script.lisp\n"); return 2; }
  FILE *in = fopen(argv[1], "rb");
  if (!in) { perror(argv[1]); return 2; }
  fseek(in, 0, SEEK_END);
  long size = ftell(in);
  rewind(in);
  char *source = malloc(size + 1);
  if (!source || fread(source, 1, size, in) != (size_t)size) return 2;
  source[size] = 0;
  fclose(in);
  int status = george_init();
  if (!status) status = george_eval(source, 0);
  fflush(NULL);
  free(source);
  return status;
}
#endif
