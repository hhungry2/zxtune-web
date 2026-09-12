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

Not implemented yet
-------------------

- `DetectModules` for containers holding several tracks (archives, ay files with
  multiple songs) - only the explicit `subpath` form is available
- spectrum analyzer (`Player::Analyze` in the jni layer)
- global options accessor
