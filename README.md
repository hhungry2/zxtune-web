# ZXTune Web Player 🎵

> WebAssembly (WASM) port of the **ZXTune** chiptune player engine, bringing 60+ vintage audio and tracker formats natively to modern web browsers.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE.md)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-WASM-purple.svg)](https://webassembly.org/)
[![Live Player](https://img.shields.io/badge/Live_Player-zxtune.com-brightgreen.svg)](https://zxtune.com/)

[English](#english) | [日本語 (Japanese)](#日本語-japanese)

---

<a name="english"></a>
## English

**ZXTune Web** is a WebAssembly port of the cross-platform chiptune player [ZXTune](https://github.com/vitamin-caig/zxtune). By compiling the core C++ decoding engines using Emscripten, it delivers high-performance, glitch-free chiptune playback directly inside the browser using Web Audio and `AudioWorklet`.

No plugins, extensions, or native client installations are required.

### 🌐 Live Player & Demos

- **Official Web Player**: [zxtune.com](https://zxtune.com/) (Dedicated player at [zxtune.com/player.html](https://zxtune.com/player.html))
- **Formats Catalog**: [zxtune.com/formats.html](https://zxtune.com/formats.html) (Detailed guide to 60+ supported formats and chipsets)
- **GitHub Pages Demo**: [hhungry2.github.io/zxtune-web](https://hhungry2.github.io/zxtune-web/)

---

### ✨ Key Features

- **60+ Chiptune & Tracker Formats Supported**:
  - **ZX Spectrum**: PT3, PT2, PT1, STC, STP, ASC, PSC, VTX, FLS, SZX, TRD, etc.
  - **Nintendo & Game Boy**: NSF, NSFE, GBS, SPC (SNES), GSF (GBA)
  - **Commodore 64 & Amiga**: SID, MOD, XM, S3M, IT
  - **FM Sound & Arcade Systems**: YM2149 / AY-3-8910, SAA1099, VGM, etc.
  - **Multi-File Rips**: Supports multi-file formats such as the XSF family (`.usf`, `.2sf`, etc.) with dynamic on-demand `.usflib` / `.2sflib` dependency resolution.
- **In-Browser Transparent Archive Extraction**:
  - Unpacks archives and disk images (`.zip`, `.rar`, `.7z`, `.trd`, `.scl`, `.fdi`, `.szx`, etc.) entirely client-side.
  - Recursively scans containers to detect all playable tracks and embedded cover images.
- **AudioWorklet & Web Audio Pipeline**:
  - Audio clock and synthesis are managed by the browser via `AudioWorkletNode`, while the WASM module handles pure sample decoding.
  - Runs without `pthreads` or `SharedArrayBuffer` — no special cross-origin isolation headers (`COOP`/`COEP`) required.
  - Works smoothly across all modern desktop and mobile browsers.
  - Full PWA & Service Worker offline support.
  - Media Session API integration (hardware media keys, OS notifications, lock-screen playback controls).
- **Sound Engine Customization**:
  - **Chip Models**: Switch between AY-3-8910 and YM2149F volume curves and envelope behaviors.
  - **Stereo Layouts**: Configurable channel routing (`ABC`, `ACB`, `BAC`, `BCA`, `CAB`, `CBA`, and `Mono`).
  - **Resampling Interpolation**: Select None, Low, or High quality interpolation for AYM, SAA, SID, and DAC.
  - **DC-Offset Blocker**: Built-in high-pass IIR filter for pure AC audio output.
  - **Spectrum Visualizer & Channel Muting**: 32-band real-time spectrum analysis and per-channel mute/solo masks (`zxtune.core.channels_mask`).
- **Real-Time Tracker State Snapshots**:
  - Inspect current decoder state: order-list index, pattern index, line/row, tempo, tick quirk, and active channel count.
  - Enables rhythm games (such as Chip Beat), interactive tracker tables, and falling-note visualizers.
- **URL Streaming & Playlists**:
  - Stream directly from CORS-enabled servers (ModArchive, raw GitHub, etc.) with shareable link generation (`player.html?url=...`).
  - Import and export XSPF playlists compatible with `zxtune-qt`.

---

### 📦 Building from Source

#### Prerequisites
- [Emscripten SDK (emsdk)](https://emscripten.org/) 4.0+ activated in your current shell
- GNU `make`

#### Compilation

```sh
# 1. Activate Emscripten environment
source <emsdk_path>/emsdk_env.sh

# 2. Build the WebAssembly player module
make platform=emscripten -C apps/zxtune-web -j$(nproc)

# Compiled artifacts will be placed in:
# - bin/emscripten/release/zxtune.mjs
# - bin/emscripten/release/zxtune.wasm
```

Add `debug=1` to the `make` command if you need an unoptimized debug build.

#### Running Local Test Server

```sh
# Install artifacts into the html test runner directory:
make platform=emscripten -C apps/zxtune-web install DESTDIR=apps/zxtune-web/html

# Serve locally:
python3 -m http.server -d apps/zxtune-web/html
# Open http://localhost:8000
```

---

### 💻 JavaScript API Usage

```javascript
import createZXTune from './zxtune.mjs';

// 1. Initialize WASM runtime
const zxtune = await createZXTune();

// 2. Pass track bytes into WASM memory heap
const fileBytes = new Uint8Array(await file.arrayBuffer());
const dataPtr = zxtune._malloc(fileBytes.length);
zxtune.HEAPU8.set(fileBytes, dataPtr);

// 3. Detect tracks in archives or load module directly
// const { tracks, pictures } = zxtune.detect(dataPtr, fileBytes.length);
const track = zxtune.load(dataPtr, fileBytes.length, '' /* subpath inside container */);
zxtune._free(dataPtr);

console.log('Title:', track.getProperty('Title', 'Unknown'));
console.log('Duration:', track.getDuration(), 'ms');

// 4. Resolve multi-file dependencies if needed (e.g. .usflib)
for (const neededFile of track.getAdditionalFiles()) {
  const extraBytes = await fetchDependency(neededFile);
  const extraPtr = zxtune._malloc(extraBytes.length);
  zxtune.HEAPU8.set(extraBytes, extraPtr);
  track.resolveAdditionalFile(neededFile, extraPtr, extraBytes.length);
  zxtune._free(extraPtr);
}

// 5. Create player at desired sample rate (e.g. 48000 Hz)
const player = track.createPlayer(48000);
track.delete();

// 6. Render interleaved 16-bit stereo PCM samples
const samplesPerFrame = 4096;
const bufferPtr = zxtune._malloc(samplesPerFrame * 4); // 2 channels * 2 bytes
const hasMore = player.render(bufferPtr, samplesPerFrame);
const pcm = zxtune.HEAP16.subarray(bufferPtr >> 1, (bufferPtr >> 1) + samplesPerFrame * 2);

// 7. Read real-time tracker state snapshot
const state = player.state();
// Returns: { position, pattern, line, tempo, channels, quirk, timeMs } or null

// 8. Visualizer & Settings
const levelsPtr = zxtune._malloc(32);
player.analyze(levelsPtr, 32); // 32-band spectrum analysis (0-100)
const spectrum = zxtune.HEAPU8.subarray(levelsPtr, levelsPtr + 32);

player.setProperty('zxtune.core.channels_mask', '1'); // mute channel 0
player.setProperty('zxtune.sound.loop', '1');         // enable loop playback

// Clean up
zxtune._free(levelsPtr);
zxtune._free(bufferPtr);
player.delete();
```

---

<a name="日本語-japanese"></a>
## 日本語 (Japanese)

**ZXTune Web** は、名作クロスプラットフォーム・チップチューンプレイヤー [ZXTune](https://github.com/vitamin-caig/zxtune) の C++ 再生コアを WebAssembly (WASM) に移植し、モダンブラウザ上でプラグインなしに 60 種類以上のレトロ音源・トラッカー曲をネイティブ再生可能にした Web Player プロジェクトです。

### 🌐 公開サイト & デモ

- **本番 Web プレイヤー**: [zxtune.com](https://zxtune.com/)（プレイヤー本体: [zxtune.com/player.html](https://zxtune.com/player.html)）
- **対応フォーマット図鑑**: [zxtune.com/formats.html](https://zxtune.com/formats.html)（60 形式以上の詳細解説・チップ情報）
- **GitHub Pages デモ**: [hhungry2.github.io/zxtune-web](https://hhungry2.github.io/zxtune-web/)

---

### ✨ 主な機能・特徴

- **60種類以上のチップチューン・トラッカー形式に対応**:
  - **ZX Spectrum**: PT3, PT2, PT1, STC, STP, ASC, PSC, VTX, FLS, SZX, TRD 等
  - **Nintendo / ゲームボーイ**: NSF, NSFE, GBS, SPC (スーパーファミコン), GSF (GBA)
  - **コモドール 64 / Amiga**: SID, MOD, XM, S3M, IT
  - **FM音源 / アーケード**: YM2149, AY-3-8910, SAA1099, VGM 等
  - **マルチファイル音源**: `.usflib` や `.2sflib` などのライブラリファイルを参照する XSF 系音源の依存ファイル自動解決に対応。
- **ブラウザ内アーカイブ透過展開**:
  - ZIP, RAR, 7z, TRD, SCL, FDI などの圧縮ファイルやディスクイメージをクライアント側（ブラウザ内）で自動展開。
  - 内包する楽曲一覧や埋め込みカバーアートを再帰的に検出・再生。
- **Web Audio / AudioWorklet 最適化**:
  - 音声クロック・出力はブラウザの `AudioWorkletNode` が担当し、WASM は純粋な PCM デコード処理に専念。
  - `SharedArrayBuffer` や `pthreads` を使用しない構成のため、COOP/COEP（クロスオリジン分離ヘッダー）の制限を受けずに全ブラウザで手軽に動作。
  - PWA & Service Worker によるオフライン再生対応。
  - Media Session API 対応（OS のメディア通知、キーボードのメディアキー、ロック画面操作）。
- **きめ細やかな音響・音源設定**:
  - **チップモデル選択**: AY-3-8910 と YM2149F（音量カーブやエンベロープ特性）の切り替え。
  - **ステレオパンニング**: `ABC`, `ACB`, `BAC`, `BCA`, `CAB`, `CBA`, `Mono` のレイアウト変更。
  - **リサンプリング補間**: AYM, SAA, SID, DAC の補間品質（なし、低品質、高品質）を選択可能。
  - **DC除去フィルタ**: 音源特有の直流バイアスを除去する IIR フィルタ。
  - **スペクトラム解析 & チャンネル制御**: 32 バンド FFT 解析とチャンネル単位のミュート / ソロ機能。
- **トラッカーステートのリアルタイム取得**:
  - 再生位置（オーダー番号、パターン番号、行/Row、テンポ、アクティブチャンネル数）をリアルタイムに取得可能。
  - 音ゲー（Arcade / Chip Beat）やピアノロール表示との完全同期を実現。
- **URLストリーミング & XSPFプレイリスト**:
  - CORS 対応サーバー上の音源 URL を直接再生、共有リンク生成（`player.html?url=...`）。
  - デスクトップ版 `zxtune-qt` 互換の XSPF プレイリストの読み込み・書き出しに対応。

---

### 🛠️ ビルド手順

```sh
# 1. Emscripten SDK を有効化
source <emsdkのパス>/emsdk_env.sh

# 2. WebAssembly モジュールのビルド
make platform=emscripten -C apps/zxtune-web -j$(nproc)

# 生成される成果物:
# - bin/emscripten/release/zxtune.mjs
# - bin/emscripten/release/zxtune.wasm
```

---

### 📄 ライセンス & 謝辞 (License & Credits)

- **Original ZXTune**: Copyright (c) Vitamin/CAIG ([Official site](https://zxtune.ru) / [GitHub](https://github.com/vitamin-caig/zxtune))
- **WebAssembly Port & Web Player**: hhungry2 ([GitHub: hhungry2/zxtune-web](https://github.com/hhungry2/zxtune-web))
- **License**: GNU General Public License v3 ([GPL-3.0](LICENSE.md))
