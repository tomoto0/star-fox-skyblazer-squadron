# セルルック3Dレールシューティング向け CC0 アセット集

**作成日：2026年7月21日**

本フォルダーには、添付された参考画像に見られる明るいセルルックの3Dレールシューティングに使いやすい、**宇宙戦闘機・敵タレット・宇宙基地・岩場／草地の自然物・空背景**を収録しています。すべて、ゲーム制作で扱いやすい`glTF`／`GLB`、`FBX`、`OBJ`のいずれかを含み、背景は`HDR`環境マップとトーンマップ済みJPEGで用意しています。

> **重要**：この収集物には、Nintendoおよび『Star Fox』に固有の機体、キャラクター、ロゴ、UI、テクスチャは一切含まれません。既存作品を直接再現せず、ジャンルに合う**独自デザインのステージ／機体**を制作するための汎用素材セットです。

## 収録内容

| 区分 | 収録物 | 推奨用途 | 主形式 | ライセンス |
|---|---:|---|---|---|
| 宇宙基地・敵・小物 | Kenney Space Kit：153モデル | タレット、ハンガー、敵施設、宇宙港、岩、遠景物 | GLB / FBX / OBJ | CC0 1.0 |
| 戦闘機 | Quaternius Ultimate Spaceships：11機種、各色バリエーション | プレイヤー機のベース、僚機、敵戦闘機 | glTF / FBX / OBJ / Blend | CC0 1.0 |
| 自然環境 | Quaternius Stylized Nature MegaKit（Standard）：68種以上のglTFを含む | 渓谷、峡谷、水辺、草地、岩場、背景植生 | glTF / FBX / OBJ | CC0 1.0 |
| HDRI背景 | Poly Haven：3シーン、HDRと確認用JPEG | 昼空、夕景、砂漠・峡谷ステージのスカイボックス／IBL | HDR / JPG | CC0 1.0 |

## フォルダー構成

```text
starfox_free_assets/
├── README.md
├── LICENSES/                         # 同梱ライセンス文書の複製
├── models/
│   ├── kenney_space_kit/             # 153 GLB / 153 FBX / 153 OBJ
│   ├── quaternius_ultimate_spaceships/
│   └── quaternius_stylized_nature_megakit/
├── backgrounds/
│   └── polyhaven/                    # 2K HDRIとトーンマップ済みJPEG
└── docs/
    ├── polyhaven_download_manifest.json
    ├── SHA256SUMS.txt
    └── asset_research_notes.md
```

## すぐ使える推奨アセット

以下は、添付イメージのステージ構成に合わせた初期選定です。`glTF`／`GLB`版を使えば、Blender、Godot、Three.js、Unity、Unreal Engineなどで扱いやすくなります。外部テクスチャを参照する`glTF`は、関連するテクスチャファイルを同じパッケージ内に残したままインポートしてください。

| 役割 | 推奨ファイル（本フォルダーからの相対パス） | 活用案 |
|---|---|---|
| プレイヤー機の原型 | `models/quaternius_ultimate_spaceships/Ultimate Spaceships - May 2021/Spitfire/glTF/Spitfire.gltf` | シルエットを独自化し、発光エンジン・翼端・デカールを追加するベース機として使う。 |
| 高速型の敵機／僚機 | `models/quaternius_ultimate_spaceships/Ultimate Spaceships - May 2021/Striker/glTF/Striker.gltf` | 色替えと縮尺差で敵編隊と僚機の役割を分ける。 |
| 敵タレット | `models/kenney_space_kit/Models/GLTF format/turret_double.glb` | 渓谷の岩、施設外壁、空中プラットフォーム上に配置する。 |
| 宇宙港／ボス施設 | `models/kenney_space_kit/Models/GLTF format/hangar_largeA.glb` | チュートリアル終端、ボス前のゲート、宇宙基地ステージの遠景に使う。 |
| 岩場・破壊物 | `models/kenney_space_kit/Models/GLTF format/rock_largeA.glb` | 小型岩と組み合わせ、通過コースの障害物や爆発演出用に使う。 |
| セルルック渓谷 | `models/quaternius_stylized_nature_megakit/glTF/Rock_Medium_1.gltf` | 3〜5倍のランダム拡縮・回転でクラスター配置する。 |
| 緑地・滝周辺の遠景 | `models/quaternius_stylized_nature_megakit/glTF/CommonTree_3.gltf`、`Pine_3.gltf` | 低密度の遠景群と、コース脇の近景群を別レイヤーにする。 |

## 背景（HDRI）選定

| ファイルID | 主な用途 | 収録ファイル | 推奨設定 |
|---|---|---|---|
| `kloofendal_48d_partly_cloudy_puresky` | 青空・白雲・草地ステージ | `*_2k.hdr`、`*_tonemapped.jpg` | 明るい昼ステージのスカイボックスと環境照明。露出をやや下げ、機体の発光を目立たせる。 |
| `qwantani_sunset_puresky` | 水辺・夕景・追跡ステージ | `*_2k.hdr`、`*_tonemapped.jpg` | 夕日色を環境光に使い、機体の排気を寒色にして視認性を確保する。 |
| `valley_of_desolation` | 砂漠・峡谷・岩壁ステージ | `*_2k.hdr`、`*_tonemapped.jpg` | 岩場モデルと合わせ、遠景の色温度を少し青寄りに補正してセルルックに寄せる。 |

## 導入手順

最初に、プロジェクトの静的アセット領域へ`models/`と`backgrounds/`をコピーしてください。ゲーム側で`glTF`／`GLB`を読み込む場合は、モデル本体だけではなく、同じパック内にある`.bin`やテクスチャPNGも同じ相対構造で配置することが重要です。Kenneyの`GLB`版は単体ファイルとして扱いやすいため、Three.jsやBabylon.jsのプロトタイプではこちらを優先できます。

背景には`backgrounds/polyhaven/*_2k.hdr`を環境マップとして設定し、表示用には同名の`*_tonemapped.jpg`を使う構成を推奨します。表示負荷を抑えたい場合は、HDRをIBL専用にし、JPGをスカイボックスや遠景ドームに設定してください。水面は別途プロジェクト側の反射／スクロール法線シェーダーで作ると、添付画像の高速飛行感に近づけやすくなります。
