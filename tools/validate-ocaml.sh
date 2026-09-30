#!/usr/bin/env bash
# Run all 24 upstream dune test aliases, not only Bergman's shared cases.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
source_dir=${OCAML_ALG_SOURCE:-$root/build/oracles/ocaml-alg}
revision=365708af85d2faa50250414247179b3bc2bd13df
if [[ ! -d "$source_dir/.git" ]]; then
  git clone https://github.com/smimram/ocaml-alg.git "$source_dir"
  git -C "$source_dir" checkout "$revision"
fi
[[ $(git -C "$source_dir" rev-parse HEAD) == "$revision" ]] || { echo 'Unexpected OCaml source revision' >&2; exit 1; }
if [[ -x "$root/build/oracles/root/usr/bin/ocamlc" ]]; then
  export PATH="$root/build/oracles/bin:$root/build/oracles/root/usr/bin:$PATH"
  export OCAMLLIB="$root/build/oracles/root/usr/lib/x86_64-linux-gnu/ocaml/5.3.0"
fi
mkdir -p "$root/build/validation/ocaml"
ocamlc -version
dune --version
dune runtest --force --root "$source_dir" test >"$root/build/validation/ocaml/upstream.log" 2>&1
printf 'All upstream dune test aliases passed.\n'
