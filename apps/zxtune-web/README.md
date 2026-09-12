ZXTune web
==========

WebAssembly build of the ZXTune core, exposed to javascript via embind.

The core is used exactly like on android: no audio backends, no file io, no
network, no threads. The page owns the audio clock and pulls rendered samples,
the wasm module only decodes.

Prerequisites
-------------

- [emsdk](https://emscripten.org/docs/getting_started/downloads.html) 4.0+ activated in the current shell
- `make`

Building
--------

```sh
source <emsdk>/emsdk_env.sh
make platform=emscripten -C apps/zxtune-web -j$(nproc)
```

Results are `bin/emscripten/release/zxtune.mjs` and `zxtune.wasm`. Add
`debug=1` for an unoptimized build.

To try the demo page, put both artifacts next to `html/index.html` and serve
the directory over http (module scripts do not load from `file://`):

```sh
make platform=emscripten -C apps/zxtune-web install DESTDIR=apps/zxtune-web/html
python3 -m http.server -d apps/zxtune-web/html
```

No `COOP`/`COEP` headers are required- the build uses neither pthreads nor
`SharedArrayBuffer`.

Javascript API
--------------

```js
import createZXTune from './zxtune.mjs';

const zxtune = await createZXTune();

// module content has to be placed into the wasm heap first
const data = zxtune._malloc(bytes.length);
zxtune.HEAPU8.set(bytes, data);
const track = zxtune.load(data, bytes.length, '' /* subpath in container */);
zxtune._free(data);

track.getDuration();                   // milliseconds
track.getProperty('Title', '');        // see src/module/attributes.h
const player = track.createPlayer(48000);
track.delete();

// renders samples*2 interleaved int16 values at the given heap offset,
// returns false when the module is over
const buffer = zxtune._malloc(4096 * 4);
player.render(buffer, 4096);
const pcm = zxtune.HEAP16.subarray(buffer >> 1, (buffer >> 1) + 4096 * 2);

player.getPosition();                  // milliseconds
player.seek(30000);
player.setProperty('zxtune.sound.loop', '1');
player.delete();
```

`load` throws on unsupported content; use `zxtune.getExceptionMessage(err)` to
get the text.

To list what is inside a container instead of opening one known entry:

```js
const { tracks, pictures } = zxtune.detect(data, bytes.length);
// tracks:   [{ subpath, type, title, author, program, durationMs }, ...]
// pictures: [{ subpath, data: Uint8Array }, ...]   cover art, png/jpeg
```

`detect` walks archives, disk images and snapshots recursively - a `.szx`
snapshot resolves to subpaths like `RAMP/+81920/+unHRUST1/+51/...`. It returns
empty arrays rather than throwing when nothing is playable. Pass a `subpath`
from the result straight back to `load`.

Some formats keep the bulk of a rip in a shared library file - the xsf family
ships one small file per track referencing a `.usflib` / `.2sflib` / ... . Ask
the track what it still needs, hand the files over, then play it:

```js
for (const name of track.getAdditionalFiles()) {      // [] for self-contained modules
  const extra = await load(name);                      // your own lookup
  const at = zxtune._malloc(extra.length);
  zxtune.HEAPU8.set(extra, at);
  track.resolveAdditionalFile(name, at, extra.length);
  zxtune._free(at);
}
```

Resolving can reveal further dependencies, so re-check `getAdditionalFiles()`
until it comes back empty.

For a visualizer, ask the player for a spectrum. It writes one byte per band,
each `0..100`:

```js
const levels = zxtune._malloc(32);
player.analyze(levels, 32);                       // wakes the analyzer up
const bands = zxtune.HEAPU8.subarray(levels, levels + 32);
```

The fft only runs while javascript keeps calling `analyze`; stop asking and
rendering goes back to costing nothing extra. Note this is the decoder's own
spectrum - for a visualizer driven by what actually reaches the speakers, a
WebAudio `AnalyserNode` on the output node is cheaper, since it runs natively.

Library-wide parameters, shared by every player created afterwards:

```js
zxtune.setOption('zxtune.core.aym.interpolation', 'lq');
zxtune.setIntOption('zxtune.sound.loop', 1);
zxtune.getOption('name', 'default');
zxtune.getIntOption('name', 0);
```

Per-player parameters go through `player.setProperty` / `setIntProperty`.
Names live in `src/sound/sound_parameters.h` and `src/core/core_parameters.h`.

Not implemented yet
-------------------

- playback of an actual multi-file rip is untested; only the enumerate and
  resolve mechanics are covered, against synthesized fixtures
