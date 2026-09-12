#!/bin/sh
# Assembles the github pages payload into site/dist.
# Expects the wasm build to exist- run this first:
#   make platform=emscripten -C apps/zxtune-web -j$(nproc)
set -eu

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/.." && pwd)
bin=$root/bin/emscripten/release
dist=$here/dist

if [ ! -f "$bin/zxtune.wasm" ]; then
  echo "no build at $bin - run make platform=emscripten -C apps/zxtune-web" >&2
  exit 1
fi

rm -rf "$dist"
mkdir -p "$dist/tunes"

cp "$here/index.html" "$dist/"
cp "$bin/zxtune.mjs" "$bin/zxtune.wasm" "$dist/"

# One tune per sound chip, matching the rack in index.html.
samples=$root/samples/chiptunes
for tune in \
  AY-3-8910/pt3/Speccy2.pt3 \
  AY-3-8910/stc/TOXIC2.stc \
  AY-3-8910/ym/Kurztech.ym \
  MOS6581/sid/Love_Is_a_Shield.sid \
  RP2A0X/nsf/knifus.nsf \
  LR35902/gbs/sos.gbs \
  SPC700/spc/ala-16.spc \
  SAA1099/cop/carillon.cop \
  YM2203/tfe/disco.tfe
do
  cp "$samples/$tune" "$dist/tunes/"
done

# Pages would otherwise hand the whole tree to jekyll.
touch "$dist/.nojekyll"

du -sh "$dist"
ls "$dist"
