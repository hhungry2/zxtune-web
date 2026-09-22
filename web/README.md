# ZXTune Web — メインサイト

カッコいいデザインのメインサイト（静的サイト）です。

## 構成

```
web/
  index.html      — ランディング + Webプレイヤー埋め込み + プレイヤー紹介 + フォーマットプレビュー
  player.html     — フルWebプレイヤー（ZXTune の wasm エンジンで実再生 + WebAudio可視化）
  players.html    — プレイヤー詳細ガイド（Web / QT / Android / CLI の徹底解説）
  formats.html    — フォーマット図鑑（一覧・検索・カテゴリフィルタ）
  formats/*.html  — 各フォーマットの解説ページ（56フォーマット + 7カテゴリ）
  css/style.css   — Neo Chiptune テーマ（ダーク + ネオン + グリッド）
  js/
    formats-data.js — 107フォーマットのDB
    app.js          — ヒーローCanvas、カテゴリ描画
    player.js       — wasm エンジンのUI側（再生/シーク/ミュート/可視化/Drop）
    formats.js      — フィルタリング
```

## デザイン

- **テーマ**: Neo Chiptune — ダーク (#070A12) + シアン (#00FFD1) / マゼンタ (#FF3B82) / バイオレット (#7C5CFF)
- **タイポ**: Space Grotesk + JetBrains Mono + Noto Sans JP
- **エフェクト**: グリッド、グロー、ノイズ、スキャンライン、ガラスモーフィズム
- **レスポンシブ**: 1280px / 1024px / 680px ブレークポイント

## Webプレイヤーの仕組み（説明）

- **WASMコア**: C++のZXTuneコアをEmscriptenでビルド、AudioWorkletで48kHz合成
- **透過展開**: ZIP/RAR/7z/TRD/SCL/FDIをブラウザ内で展開
- **可視化**: AnalyserNode→ スペクトラム / 波形、チャンネル別ミュート
- **操作**: Space / ←→ / M / L / N/P、ドラッグ＆ドロップ

## プレイヤー

- **ZXTune Web** — ブラウザ、PWA、URL共有
- **ZXTune QT** — デスクトップ (Win/Linux/macOS)、プレイリスト/変換/プラグイン
- **ZXTune Android** — モバイル、11+オンラインカタログ、ウィジェット/着信音
- **zxtune123** — CLI、バッチ、ベンチ

## エンジン

再生エンジン（`player.mjs` / `zxtune-engine.mjs` / `zxtune-processor.js` / `zxtune.mjs` / `zxtune.wasm` / `tunes/`）は
`web` ブランチの `site/build.sh` が作る `site/dist` のもので、このサイトには含めていません。
GitHub Pages ではエンジンをルートに、このサイトを `site/` に置くので、`player.js` は既定で一つ上 (`..`) から読み込みます。
別の場所に置くときは `<html data-engine="パス">` で指定します。

チャンネルミュートは `zxtune.core.channels_mask`（ビット n = チャンネル n を消音）で、A/B/C の対応は AY 系のものです。
補間は `zxtune.core.{aym,saa,sid,dac}.interpolation`、AYM レイアウトは `zxtune.core.aym.layout`、AY/YM チップは `zxtune.core.aym.type` に渡します（VTX ファイルはファイル内の指定が優先）。DC除去フィルタはエンジンではなくページ側の一次 DC ブロッカー（IIRFilterNode、約5Hz）です。選択はブラウザに保存します。

## 起動

ローカルでは `site/dist` をルートにして、その下の `site/` にこのフォルダを置いて配信します。

```sh
cp -r web site/dist/site
python3 -m http.server 8000 --directory site/dist
# → http://localhost:8000/site/
```

## URL読み込み / 共有リンク / XSPF

- **URLから読み込み** はブラウザから直接 `fetch` します。読めるのは CORS を許可しているサーバーだけです
  (raw.githubusercontent.com、api.modarchive.org など)。github.com のファイルページと
  modarchive.org のモジュールページは、読み込める URL に書き換えてから取得します。
  zxtunes.com や HVSC のサイトは CORS を許可していないので読めません。中継サーバーは使いません。
- **共有リンク**: `player.html?url=<URL>` を開くと、その曲をプレイリストに加えて選択します
  (再生はブラウザの制限でクリック待ち)。
- **XSPF保存 / 読み込み** は zxtune-qt と同じ形式 (playlist version 1、文字列はパーセントエンコード) です。
  サブパスは ZXTune と同じく、URL なら `#` の後、ファイルなら `?` の後に置きます。
  ローカルファイルは場所が分からないため、書き出しにはファイル名だけが入ります。読み込むときは、
  XSPF と一緒に選んだファイルからファイル名で探します。URL で開いた XSPF の相対パスは、XSPF の URL を基準に解決します。

## メディアキー / オフライン

- 出力は MediaStream 経由で `<audio>` 要素から鳴らします。ブラウザはメディア要素を再生しているページにだけ、
  メディアキー・ロック画面・OS のメディア操作を渡すためです。操作は Media Session API で受けます。
- `manifest.json` と、Pages のルートに置く Service Worker (`sw.js`、`web` ブランチの `site/` にあります) で
  PWA としてインストールできます。Service Worker はネットワーク優先で、取れないときだけキャッシュから返すので、
  公開した更新は次の読み込みで反映され、一度開いたページと曲はオフラインでも再生できます。
  エンジンの worker と wasm も管理下に入るよう、スコープはこのフォルダではなくルートです。
