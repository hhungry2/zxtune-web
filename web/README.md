# ZXTune Web — メインサイト

カッコいいデザインのメインサイト（静的サイト）です。

## 構成

```
web/
  index.html      — ランディング + Webプレイヤー埋め込み + プレイヤー紹介 + フォーマットプレビュー
  player.html     — フルWebプレイヤー（WASM想定、現在はモック + WebAudio可視化）
  players.html    — プレイヤー詳細ガイド（Web / QT / Android / CLI の徹底解説）
  formats.html    — フォーマット図鑑（一覧・検索・カテゴリフィルタ）
  formats/*.html  — 各フォーマットの解説ページ（56フォーマット + 7カテゴリ）
  css/style.css   — Neo Chiptune テーマ（ダーク + ネオン + グリッド）
  js/
    formats-data.js — 107フォーマットのDB
    app.js          — ヒーローCanvas、カテゴリ描画
    player.js       — WebAudioプレイヤー（再生/シーク/可視化/Drop）
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

## 起動

```sh
python3 -m http.server 8000 --directory web --bind 0.0.0.0
# → http://localhost:8000/
```

## 今後の拡張

- WASMビルドを `web/wasm/` に配置して `player.js` のモックを置換
- `zxtunes.com` / HVSC の直リンク再生
- XSPF エクスポート、メディアセッション API
