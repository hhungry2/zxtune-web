# Web Player: tracker state API

- Added synchronous `Player.state()` to the C++/embind WASM API.
- Returns a fresh `{position, pattern, line, tempo, channels, quirk, timeMs}` snapshot, or `null` when the renderer exposes no tracker state.
- Documented decoder buffering, unsupported formats, channel-count semantics, and the distinction from the browser worker wrapper.
- Added `apps/zxtune-web/test/state.mjs` covering snapshots, read-only behavior, row progression, seek reset, and non-tracker fallback.

## Validation

- Compiled the changed C++ binding with the existing WSL Emscripten SDK and linked it against the existing WSL core libraries. Output is isolated in this worktree's ignored `bin/emscripten/release/` directory; the existing WSL source and artifacts were not overwritten.
- The real-WASM state regression passed with `Speccy2.pt3` and `Love_Is_a_Shield.sid`.
- JavaScript syntax and `git diff --check` passed.
- Existing PT3 audio smoke test passed (one second rendered, nonzero PCM, decoder position 1000 ms).
- This is an API addition, not note extraction or a rhythm-game chart generator. The browser worker wrapper remains unchanged; `state()` is exposed on the WASM `Player`.

## Production deployment

- Published to `https://zxtune.com/` at the user's request. The site repository stores the new binary as `zxtune-state-v1.wasm`, referenced by the updated `zxtune.mjs`. The old `zxtune.wasm` remains available for cached loaders.
- Backed up the previous engine outside the web root. Uploaded the new WASM before atomically replacing the loader.
- Downloaded both published artifacts over HTTPS and passed the real-WASM state regression (PT3/SID) and PT3 audio smoke test again.
- Source changes and this log target this repository's `web` branch. Deployment artifacts are maintained separately in the private site repository.
