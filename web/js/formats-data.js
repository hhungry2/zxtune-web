// ZXTune formats database — curated for web display
window.ZXTUNE_FORMATS = [
  // AYM — ZX Spectrum / AY-3-8910
  {id:"pt3", ext:".pt3", name:"VortexTracker II", aka:"PT3", cat:"aym", chip:"AY-3-8910", platform:"ZX Spectrum", year:"2004", desc:"ZX Spectrumで最も普及したトラッカー。6ch相当の洗練されたエフェクトと楽器定義を持つデファクトスタンダード。", long:"Vladimir Bulbuk (Factor6) 製 VortexTracker II によるフォーマット。パターン＋オーナメント＋サンプル構造で、コンパクトながら豊かな表現力を実現。ZXTuneは全バージョンのPT3を高精度に再生。", exts:[".pt3",".pt2"], features:["3ch AY + エフェクト","コンパイル済みプレイヤ内蔵可能","ループ/ポジション制御"]},
  {id:"pt2", ext:".pt2", name:"Pro Tracker v2", aka:"PT2", cat:"aym", chip:"AY-3-8910", platform:"ZX Spectrum", year:"1999", desc:"Pro Tracker 2 系の古典的かつ軽量なZXフォーマット。", long:"早期のPro Tracker系。シンプルなコマンド体系で多くの名曲が残る。", exts:[".pt2"], features:["軽量","PT3の前身"]},
  {id:"pt1", ext:".pt1", name:"Pro Tracker v1", aka:"PT1", cat:"aym", chip:"AY-3-8910", platform:"ZX Spectrum", year:"1995", desc:"初期Pro Tracker。ZXデモシーン黎明期のサウンド。", long:"初期バージョン。少ないメモリで動作するミニマル設計。", exts:[".pt1"], features:["オリジナルPT"]},
  {id:"asc", ext:".asc", name:"ASC Sound Master", aka:"ASC", cat:"aym", chip:"AY-3-8910", platform:"ZX Spectrum", year:"1998", desc:"ASC Sound Master 専用フォーマット。高速でタイトなサウンド。", long:"Andrey Chernov 製。パターン圧縮と高速プレイヤが特徴。", exts:[".asc"], features:["高速プレイヤ","1-2KB程度"]},
  {id:"stc", ext:".stc", name:"Sound Tracker", aka:"STC", cat:"aym", chip:"AY-3-8910", platform:"ZX Spectrum", year:"1996", desc:"Sound Tracker (BSC) ファミリー。PT系と並ぶ二大勢力。", long:"Sound Tracker v1.x / STC / STP / ST1 など派生多数。", exts:[".stc",".stp",".st1"], features:["オーナメント対応","多彩なエフェクト"]},
  {id:"st3", ext:".st3", name:"Sound Tracker Pro III", aka:"ST3", cat:"aym", chip:"AY-3-8910", platform:"ZX Spectrum", year:"2001", desc:"STPの上位版。サンプルとオーナメントを拡張。", long:"より複雑な楽器定義で表現力向上。コンパイル版も存在。", exts:[".st3"], features:["拡張楽器","コンパイル対応"]},
  {id:"sqt", ext:".sqt", name:"SQ-Tracker", aka:"SQT", cat:"aym", chip:"AY-3-8910", platform:"ZX Spectrum", year:"2000", desc:"SQ-Tracker / SQ Digital のコンパイル系。", long:"高速化されたプレイヤでゲーム内BGMにも利用。", exts:[".sqt"], features:["コンパイル済み","軽量"]},
  {id:"psg", ext:".psg", name:"PSG", aka:"PSG", cat:"aym", chip:"AY-3-8910", platform:"ZX Spectrum", year:"1990", desc:"レジスタダンプ型のストリームフォーマット。エミュレーション忠実。", long:"AYレジスタへの書き込みをフレーム毎に記録。エミュレータ出力をそのまま保存。", exts:[".psg"], features:["レジスタログ","可逆"]},
  {id:"ym", ext:".ym", name:"YM / VTX", aka:"YM", cat:"aym", chip:"AY-3-8910 / YM2149", platform:"Atari ST / ZX", year:"1998", desc:"Atari ST由来のAYレジスタダンプ。VTXは圧縮版。", long:"Leonard/Overscan のYMフォーマットと、VeliantによるVTX圧縮。正確なタイミング再現。", exts:[".ym",".vtx"], features:["ST互換","LHA圧縮(VTX)"]},
  {id:"ayc", ext:".ayc", name:"CPC AYC", aka:"AYC", cat:"aym", chip:"AY-3-8910", platform:"Amstrad CPC", year:"2002", desc:"Amstrad CPC 用 AYC コンテナ。", long:"CPCのAY音楽をアーカイブ。", exts:[".ayc"], features:["CPC"]},
  {id:"turbosound", ext:".ts", name:"TurboSound", aka:"TS", cat:"aym", chip:"2×AY-3-8910", platform:"ZX Spectrum", year:"2003", desc:"AYを2基搭載する拡張 TurboSound の6chフォーマット。", long:"ZX Evolution / Pentagon 1024 などで6chステレオを実現。FM的な厚み。", exts:[".ts",".pt3"], features:["6ch","ステレオ"]},
  {id:"ay", ext:".ay", name:"AY / EMUL", aka:"AY", cat:"aym", chip:"AY + Z80", platform:"ZX Spectrum", year:"1999", desc:"Z80コードを内蔵するエミュレーションフォーマット。任意のプレイヤを同梱可能。", long:"ZX上で動作するプレイヤコードをそのまま収録。最も汎用的だがエミュレーション負荷は高め。", exts:[".ay",".emul"], features:["Z80エミュレーション","任意プレイヤ"]},
  {id:"ftc", ext:".ftc", name:"Fast Tracker", aka:"FTC", cat:"aym", chip:"AY", platform:"ZX Spectrum", year:"1999", desc:"Fast Tracker のコンパクトフォーマット。", long:"最小構成の高速トラッカー。", exts:[".ftc"], features:["高速"]},
  {id:"gtr", ext:".gtr", name:"Global Tracker", aka:"GTR", cat:"aym", chip:"AY", platform:"ZX Spectrum", year:"2000", desc:"Global Tracker v1.x。ユニークなエフェクト体系。", long:"派手なピッチエフェクトが特徴。", exts:[".gtr"], features:["特殊エフェクト"]},
  {id:"psc", ext:".psc", name:"Pro Sound Creator", aka:"PSC", cat:"aym", chip:"AY", platform:"ZX Spectrum", year:"1997", desc:"Pro Sound Creator シリーズ。", long:"ゲーム音楽で多用された。", exts:[".psc"], features:["ゲーム向け"]},

  // Digital trackers
  {id:"dst", ext:".dst", name:"Digital Studio", aka:"DST", cat:"digital", chip:"Beep/Digital", platform:"ZX Spectrum", year:"1998", desc:"サンプルベースのデジタルトラッカー。ZXでPCMを鳴らす。", long:"1bit DACやPWMでサンプル再生。ビープ音を超えた表現。", exts:[".dst"], features:["サンプル","PCM"]},
  {id:"dmm", ext:".dmm", name:"Digital Music Maker", aka:"DMM", cat:"digital", chip:"Digital", platform:"ZX Spectrum", year:"1997", desc:"Digital Studioの兄弟フォーマット。", long:"パターン＋サンプルのモジュール。", exts:[".dmm"], features:["サンプル"]},
  {id:"pdt", ext:".pdt", name:"ProDigi Tracker", aka:"PDT", cat:"digital", chip:"Digital", platform:"ZX Spectrum", year:"1996", desc:"初期のデジタルトラッカー。", long:"メタル系サウンドに強み。", exts:[".pdt"], features:["サンプル"]},
  {id:"sqd", ext:".sqd", name:"SQ Digital Tracker", aka:"SQD", cat:"digital", chip:"Digital", platform:"ZX Spectrum", year:"1994", desc:"SQ-Trackerのデジタル版。", long:"サンプル再生に特化。", exts:[".sqd"], features:["サンプル"]},
  {id:"str", ext:".str", name:"Sample Tracker", aka:"STR", cat:"digital", chip:"Digital", platform:"ZX Spectrum", year:"1996", desc:"シンプルなサンプラー。", long:"軽量デジタル。", exts:[".str"], features:["サンプル"]},
  {id:"et1", ext:".et1", name:"Extreme Tracker v1", aka:"ET1", cat:"digital", chip:"Digital", platform:"ZX Spectrum", year:"1995", desc:"Extreme Tracker 初期。", long:"ユニークなエフェクト。", exts:[".et1"], features:["デジタル"]},
  {id:"chi", ext:".chi", name:"Chip Tracker", aka:"CHI", cat:"digital", chip:"AY+Digital", platform:"ZX Spectrum", year:"1996", desc:"AYとデジタルをミックスしたハイブリッド。", long:"両方の利点を組み合わせたトラッカー。", exts:[".chi"], features:["ハイブリッド"]},
  {id:"v2m", ext:".v2m", name:"Farbrausch V2", aka:"V2M", cat:"digital", chip:"Synth", platform:"PC", year:"2005", desc:"64k intro向けのプロシージャルシンセ。極小サイズで豊かなサウンド。", long:"FarbrauschによるV2シンセ。波形を合成で生成するためファイルは数KB。", exts:[".v2m"], features:["プロシージャル","64k intro"]},

  // FM
  {id:"tfc", ext:".tfc", name:"TurboFM Compiled", aka:"TFC", cat:"fm", chip:"YM2203 / FM", platform:"ZX Spectrum", year:"2005", desc:"TurboFM (FM音源付きTurboSound) 用のコンパイル済みフォーマット。", long:"AY×2 + YM2203 FM 3ch + リズム。FMの重厚さが加わる。", exts:[".tfc"], features:["FM 6ch+","コンパイル"]},
  {id:"tfd", ext:".tfd", name:"TurboFM Dump", aka:"TFD", cat:"fm", chip:"YM2203", platform:"ZX Spectrum", year:"2005", desc:"TurboFMのレジスタダンプ。", long:"TFCのソースとなるダンプ形式。", exts:[".tfd"], features:["FMダンプ"]},
  {id:"tfm", ext:".tfm", name:"TFM Music Maker", aka:"TFM", cat:"fm", chip:"YM2203", platform:"ZX Spectrum", year:"2008", desc:"TFM Music Maker 1.x/1.3+ のネイティブフォーマット。", long:"FM音源をフルに使うZXトラッカー。チップチューンとFMの融合。", exts:[".tfm"], features:["FMエディタ"]},
  {id:"etracker", ext:".etc", name:"E-Tracker", aka:"ETC", cat:"fm", chip:"SAA1099", platform:"SAM Coupé", year:"1991", desc:"SAM Coupé の SAA1099 サウンドチップ用トラッカー。", long:"6ch SAA1099 を駆動。英国シーンで人気。", exts:[".etc",".saa"], features:["SAA1099","6ch"]},

  // Console / Emulation
  {id:"spc", ext:".spc", name:"SNES SPC700", aka:"SPC", cat:"console", chip:"SPC700 + DSP", platform:"Super Nintendo", year:"1994", desc:"SFC/SNESのサウンドCPUダンプ。任天堂の名作サウンドを完全再現。", long:"700番台サウンドCPUのRAMダンプ。DSPエコーやBRRサンプルも含む。", exts:[".spc"], features:["SFC","BRR","エコー"]},
  {id:"nsf", ext:".nsf", name:"NES Sound Format", aka:"NSF", cat:"console", chip:"2A03 + 拡張", platform:"Nintendo Entertainment System", year:"1998", desc:"ファミコン/FamicomのサウンドROM。拡張音源にも対応。", long:"6502コードを内蔵。VRC6/VRC7/FDS/MMC5/N163対応。ZXTuneは全拡張チップをエミュレート。", exts:[".nsf"], features:["6502","拡張音源"]},
  {id:"nsfe", ext:".nsfe", name:"Extended NSF", aka:"NSFe", cat:"console", chip:"2A03+", platform:"NES", year:"2002", desc:"NSFにメタデータを追加した拡張版。", long:"曲名や作者情報を保持。", exts:[".nsfe"], features:["メタデータ"]},
  {id:"gbs", ext:".gbs", name:"GameBoy Sound", aka:"GBS", cat:"console", chip:"LR35902", platform:"Game Boy", year:"1999", desc:"ゲームボーイのサウンドダンプ。", long:"DMG/CGBの4chサウンド。", exts:[".gbs"], features:["GB"]},
  {id:"hes", ext:".hes", name:"PC Engine HES", aka:"HES", cat:"console", chip:"HuC6280", platform:"PC Engine", year:"2000", desc:"PCエンジンのHuC6280音源フォーマット。", long:"6chウェーブテーブル音源。", exts:[".hes"], features:["HuC6280"]},
  {id:"sid", ext:".sid", name:"Commodore 64 SID", aka:"SID", cat:"console", chip:"MOS6581", platform:"Commodore 64", year:"1999", desc:"C64の伝説的SIDチップ。フィルタとリング変調が特徴。", long:"MOS6581/8580 を完全エミュレート。HVSC数万曲を網羅。", exts:[".sid",".psid",".rsid"], features:["SIDフィルタ","3ch"]},
  {id:"sap", ext:".sap", name:"Atari SAP", aka:"SAP", cat:"console", chip:"POKEY", platform:"Atari 8-bit", year:"2000", desc:"Atari 8-bit のPOKEYサウンド。", long:"4ch POKEY + 6502エミュレーション。RMTトラッカーにも対応。", exts:[".sap"], features:["POKEY"]},
  {id:"kss", ext:".kss", name:"KSS / KSSX", aka:"KSS", cat:"console", chip:"SCC + OPLL", platform:"MSX", year:"1999", desc:"MSXのKSSフォーマット。SCC等の拡張音源対応。", long:"Z80 + サウンドチップエミュレーション。", exts:[".kss",".kssx"], features:["MSX"]},
  {id:"psf", ext:".psf", name:"PlayStation Sound Format", aka:"PSF", cat:"console", chip:"SPU/PS1", platform:"PlayStation", year:"2001", desc:"PS1のPSF/PSF2/SSF/DSF/USF ファミリー。", long:"MIPS + SPUエミュレーション。PS1/PS2/サターン/DC/N64/USFを統一的に扱う。", exts:[".psf",".psf2",".ssf",".dsf",".usf",".2sf"], features:["PS1/PS2","MIPS"]},
  {id:"vgm", ext:".vgm", name:"Video Game Music", aka:"VGM", cat:"console", chip:"Multichip", platform:"Multi (Genesis等)", year:"2003", desc:"多チップ対応のログフォーマット。YM2612/SN76489など。", long:"メガドライブ/マスターシステム等のレジスタログ。アーカイブ VGMRips で大量配布。", exts:[".vgm",".vgz"], features:["ログ","多チップ"]},
  {id:"gym", ext:".gym", name:"Genesis YM2612", aka:"GYM", cat:"console", chip:"YM2612", platform:"Sega Genesis", year:"1999", desc:"メガドライブ YM2612 の初期ログフォーマット。", long:"VGMの前身。", exts:[".gym"], features:["YM2612"]},
  {id:"s98", ext:".s98", name:"Sound98", aka:"S98", cat:"console", chip:"OPN/OPM", platform:"PC-98 / Multi", year:"2005", desc:"NEC PC-98 由来のS98。OPN系チップのログ。", long:"PC-98のFM音源ログ。", exts:[".s98"], features:["OPN"]},

  // Packed / Compiled
  {id:"hrust", ext:".hrust", name:"Hrust", aka:"HRU", cat:"packed", chip:"-", platform:"ZX Spectrum", year:"1994", desc:"ZXで最も普及した圧縮。Hrust 1.x /2.x 系。", long:"多くのPT3/STCがHrust圧縮で配布。ZXTuneは自動展開。", exts:[".hrust"], features:["LZ系","自動解凍"]},
  {id:"hrum", ext:".hrum", name:"Hrum", aka:"HRM", cat:"packed", chip:"-", platform:"ZX Spectrum", year:"1996", desc:"Hrum v3.x 圧縮。", long:"Hrustの派生。", exts:[".hrum"], features:["圧縮"]},
  {id:"cc3", ext:".cc3", name:"CodeCruncher v3", aka:"CC3", cat:"packed", chip:"-", platform:"ZX Spectrum", year:"1993", desc:"CodeCruncher 3.x パッカー。", long:"実行形式の圧縮。", exts:[".cc3"], features:["パッカー"]},
  {id:"megalz", ext:".megalz", name:"MegaLZ", aka:"MGLZ", cat:"packed", chip:"-", platform:"ZX Spectrum", year:"1995", desc:"MegaLZ パッカー。", long:"高速展開。", exts:[".megalz"], features:["パッカー"]},
  {id:"lzs", ext:".lzs", name:"LZS / ASC LZS", aka:"LZS", cat:"packed", chip:"-", platform:"ZX Spectrum", year:"1996", desc:"ASC LZS Pack 等。", long:"レトロパッカー群。", exts:[".lzs"], features:["圧縮"]},
  {id:"trush", ext:".trush", name:"Trush", aka:"TRS", cat:"packed", chip:"-", platform:"ZX Spectrum", year:"1994", desc:"Trush Compressor。", long:"軽量パッカー。", exts:[".trush"], features:["パッカー"]},
  {id:"dsq", ext:".dsq", name:"DataSqueezer", aka:"DSQ", cat:"packed", chip:"-", platform:"ZX Spectrum", year:"1993", desc:"DataSqueezer v4.x。", long:"初期のZXパッカー。", exts:[".dsq"], features:["圧縮"]},
  {id:"z80", ext:".z80", name:"Z80 Snapshot", aka:"Z80", cat:"packed", chip:"-", platform:"ZX Spectrum", year:"1990", desc:"ZX Spectrum スナップショット。メモリとレジスタを保存。", long:"Z80 v1.45/2.x/3.x。エミュレータの状態保存。音楽抽出にも利用。", exts:[".z80",".sna"], features:["スナップショット"]},

  // Archived / Disk
  {id:"trd", ext:".trd", name:"TR-DOS Disk", aka:"TRD", cat:"archived", chip:"-", platform:"ZX Spectrum", year:"1990", desc:"ZX Spectrum TR-DOS フロッピーディスクイメージ。640KB。", long:"Beta Disk/TR-DOSの標準。SCLと並ぶZXの定番。", exts:[".trd"], features:["ディスク"]},
  {id:"scl", ext:".scl", name:"SCL", aka:"SCL", cat:"archived", chip:"-", platform:"ZX Spectrum", year:"1995", desc:"SCL (Sinclair) ディスクイメージの簡易版。", long:"TRDよりコンパクト。", exts:[".scl"], features:["ディスク"]},
  {id:"fdi", ext:".fdi", name:"FDI / TD0", aka:"FDI", cat:"archived", chip:"-", platform:"Multi", year:"1994", desc:"Full Disk Image / TeleDisk などの汎用FDI。", long:"多機種のフロッピーイメージ。", exts:[".fdi",".td0"], features:["ディスク"]},
  {id:"zip", ext:".zip", name:"ZIP / 7zip / RAR", aka:"ZIP", cat:"archived", chip:"-", platform:"Generic", year:"1989", desc:"汎用アーカイブ。ZXTuneはネストも自動展開。", long:"ZIP / RAR / 7zip / LHA / GZip を透過的に展開。中に10曲入っていても即再生。", exts:[".zip",".rar",".7z",".lha",".gz"], features:["アーカイブ","ネスト対応"]},
  {id:"zxzip", ext:".zxzip", name:"ZXZip", aka:"ZXZIP", cat:"archived", chip:"-", platform:"ZX Spectrum", year:"1996", desc:"ZXZip アーカイブ。", long:"ZX専用ZIP。", exts:[".zxzip"], features:["ZX"]},
  {id:"hobeta", ext:".hobeta", name:"Hobeta", aka:"HOB", cat:"archived", chip:"-", platform:"ZX Spectrum", year:"1992", desc:"Hobeta ファイルコンテナ。", long:"単一ファイル＋ヘッダ。", exts:[".$c",".$b"], features:["コンテナ"]},
  {id:"aym-arch", ext:".aym", name:"Multi-AY Container", aka:"AYM", cat:"archived", chip:"-", platform:"ZX Spectrum", year:"2001", desc:"複数AYトラックを束ねるマルチトラックコンテナ。", long:"コンピレーション用。", exts:[".aym"], features:["コンテナ"]},

  // Audio
  {id:"mp3", ext:".mp3", name:"MP3 / OGG / FLAC / WAV", aka:"MP3", cat:"audio", chip:"-", platform:"Generic", year:"1993", desc:"一般的なストリーミングオーディオも再生可能。", long:"MP3/OGG Vorbis/FLAC/WAV に対応。チップチューンのMP3録音もそのまま再生。", exts:[".mp3",".ogg",".flac",".wav"], features:["ストリーム","タグ対応"]},
  {id:"mod", ext:".mod", name:"ProTracker MOD / XM / S3M / IT", aka:"MOD", cat:"audio", chip:"Sample", platform:"PC/Amiga", year:"1987", desc:"サンプルベースのモジュール (openmpt経由)。", long:"Amiga MODから始まるトラッカーファミリー。 XM, S3M, IT, 669, FAR, ULT など数十種。", exts:[".mod",".xm",".s3m",".it",".669"], features:["サンプルモジュール","openmpt"]},
];

window.FORMAT_CATS = [
  {id:"aym", label:"AY/YM — ZX Spectrum", icon:"🎹", color:"#00FFD1", desc:"ZX Spectrum / CPC / Atari ST のAY-3-8910 / YM2149ファミリー。PT3, STC, ASC, YM, TurboSoundなど。"},
  {id:"digital", label:"デジタルトラッカー", icon:"🥁", color:"#FFD60A", desc:"サンプル・PCMをZXで鳴らすデジタル系。DST, DMM, PDT, V2M (Farbrausch) など。"},
  {id:"fm", label:"FM音源", icon:"🎛️", color:"#FF3B82", desc:"YM2203 / SAA1099 などのFM。TurboFM (TFC/TFD/TFM), E-Tracker。"},
  {id:"console", label:"コンソール/エミュレーション", icon:"🎮", color:"#7C5CFF", desc:"SPC (SFC), NSF (FC), GBS (GB), SID (C64), SAP (Atari), PSF (PS1/2), VGM 等。"},
  {id:"packed", label:"パック/圧縮", icon:"📦", color:"#00E5FF", desc:"Hrust, Hrum, CodeCruncher, MegaLZ, LZS, Trush など。自動展開。"},
  {id:"archived", label:"アーカイブ/ディスク", icon:"💾", color:"#FF8A00", desc:"TRD, SCL, FDI, ZIP, RAR, 7zip, Hobeta など。ネスト対応。"},
  {id:"audio", label:"ストリーム/モジュール", icon:"🎧", color:"#00FF88", desc:"MP3, OGG, FLAC, WAV, MOD/XM/S3M/IT (openmpt)。"},
];
