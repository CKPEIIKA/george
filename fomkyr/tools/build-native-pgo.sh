#!/usr/bin/env bash
# Optional local profile-guided build. Profiles and training jobs stay ignored.
set -euo pipefail
fomkyr_root=$(cd "$(dirname "$0")/.." && pwd)
cd "$fomkyr_root"
fomkyr_output=${1:-dist/native-pgo}
mkdir -p "$fomkyr_output"
fomkyr_output=$(cd "$fomkyr_output" && pwd)
fomkyr_profiles="$fomkyr_output/profiles"
rm -rf -- "$fomkyr_profiles"
fomkyr_cc=${FOMKYR_PGO_CC:-gcc}
fomkyr_arch=${NATIVE_ARCH-native}
fomkyr_cflags=${CFLAGS:--O3 -flto -std=c11 -Wall -Wextra}
fomkyr_ldflags=${LDFLAGS:--flto -pthread}
make native NATIVE_PROFILE=lto "CC=$fomkyr_cc" "BUILD_DIR=$fomkyr_output" "NATIVE_ARCH=$fomkyr_arch" \
  "CFLAGS=$fomkyr_cflags -fprofile-generate=$fomkyr_profiles -fprofile-update=atomic" \
  "LDFLAGS=$fomkyr_ldflags -fprofile-generate=$fomkyr_profiles"
train() {
  "$fomkyr_output/fomkyr" -i "$2" -d "$3" -j 4 --memory 4G \
    --time-limit 120 --workdir "$fomkyr_output/training/$1" --fresh \
    --export --hilbert --quiet > "$fomkyr_output/training-$1.json"
}
train fk6 fixtures/fk6.json 8
train q-serre fixtures/published/affine-q-serre-q2.json 14
train weyl fixtures/homogenized-weyl.json 7
make native NATIVE_PROFILE=lto "CC=$fomkyr_cc" "BUILD_DIR=$fomkyr_output" "NATIVE_ARCH=$fomkyr_arch" \
  "CFLAGS=$fomkyr_cflags -fprofile-use=$fomkyr_profiles -fprofile-correction" \
  "LDFLAGS=$fomkyr_ldflags"
printf 'Profile-guided executable: %s/fomkyr\n' "$fomkyr_output"
