# v26 追加アセット候補・出典記録

2026-08-27に、ゲームの環境、通信演出、UI、音響を強化するため、以下のライセンスが明確な素材を選定・取得した。権利関係が不明な固有ゲーム素材は導入しない。

| 用途 | 素材 | 配布元 | ライセンス | 採用方針 |
|---|---|---|---|---|
| 岩壁・崖の表面 | Coastal Cliff 04 の 1K Diffuse / Normal(GL) / ARM テクスチャ | [Poly Haven](https://polyhaven.com/a/coastal_cliff_04) | CC0 1.0 | 既存の安全回廊を維持したプロシージャルな崖・浮島へ、高周波の岩肌ディテールとして使用する。元モデルは3M trisのため、実行負荷に配慮してテクスチャのみを採用する。 |
| 通信ボイス | Voiceover Pack の男女 OGG（`mission_completed`、`objective_achieved`、`war_watch_my_back`、`war_cover_me`、`war_target_engaged`、`war_target_destroyed`） | [OpenGameArt / Kenney](https://opengameart.org/content/voiceover-pack-40-lines) | CC0 1.0 | 固有キャラクターの台詞代替ではなく、作戦管制・通信確認・目標通知として短く重ねる。 |
| 戦闘・警告SE | 60 CC0 Sci-Fi SFX | [OpenGameArt / rubberduck](https://opengameart.org/content/60-cc0-sci-fi-sfx) | CC0 1.0 | 実ファイルの音質・用途を聴取してから、ロック、警告、重火器、環境向けの少数を採用する。 |
| HUDカットイン・通信フレーム | UI Pack - Sci-Fi（130 PNG/SVG要素） | [Kenney](https://kenney.nl/assets/ui-pack-sci-fi) | CC0 1.0 | 既存の可読性を維持しつつ、通信カットイン枠、HUDセグメント、ロック表示の装飾に使用する。 |

## ダウンロード済みの統合作業領域

以下の公式・配布元URLから、検証目的で一時作業領域 `/tmp/starfox-asset-stage-20260827/` へ取得済みである。

```text
https://opengameart.org/sites/default/files/Voiceover%20Pack.zip
https://opengameart.org/sites/default/files/60-sci-fi-sfx_0.zip
https://kenney.nl/media/pages/assets/ui-pack-sci-fi/b67c2acd31-1724181109/kenney_ui-pack-space-expansion.zip
https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/coastal_cliff_04/coastal_cliff_04_diff_1k.jpg
https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/coastal_cliff_04/coastal_cliff_04_nor_gl_1k.jpg
https://dl.polyhaven.org/file/ph-assets/Models/jpg/1k/coastal_cliff_04/coastal_cliff_04_arm_1k.jpg
```

取得後の展開サイズは、Voiceover Pack 約4.1 MB、60 CC0 Sci-Fi SFX 約18 MB、Kenney UI Pack - Sci-Fi 約5.2 MB、岩壁テクスチャ約2.7 MBである。ゲームへは、用途と負荷が確定した少数ファイルのみをコピーする。

> Poly Haven は Coastal Cliff 04 を CC0 と明記している。Kenney の Sci-Fi UI Pack は CC0で130要素、Voiceover PackもCC0、OpenGameArtの60 Sci-Fi SFXはCC0として配布されていることを各配布ページで確認した。

## v27 ゾーン別岩壁テクスチャ

| ゾーン | 素材 | 出典 | ライセンス | 統合内容 |
|---|---|---|---|---|
| AZURE SEA | Coastal Cliff 04 | https://polyhaven.com/a/coastal_cliff_04 | CC0 1.0 | 湿潤な海食岩。既存v26の1K Diffuse/Normal(GL)を継続使用。 |
| CASCADE GORGE | Cliff Side | https://polyhaven.com/a/cliff_side | CC0 1.0 | 侵食されたオレンジ系堆積層。1K Diffuse/Normal(GL)を`assets/textures/zone_cliffs/gorge/`へ取得。 |
| EMBER CANYON | Dark Rock | https://polyhaven.com/a/dark_rock | CC0 1.0 | 深い割れ目を持つ暗色火山岩。1K Diffuse/Normal(GL)を`assets/textures/zone_cliffs/ember/`へ取得。 |
| DUNE SEA | Rocky Trail | https://polyhaven.com/a/rocky_trail | CC0 1.0 | 風化した礫・岩・暖色土壌。1K Diffuse/Normal(GL)を`assets/textures/zone_cliffs/dune/`へ取得。 |

`src/world/terrain.js`の`CLIFF_MATS`は、各ゾーンに固有のDiffuse/Normalマップ、リピート密度、明度、コントラスト、彩度、法線強度を持つ。`setZone()`が現在のゾーン材質を選択し、`buttressedCliff()`と`riftIslet()`へ明示的に渡すため、同じ岩壁テクスチャが全ゾーンへ流用されない。

直接の取得元:

```text
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/cliff_side/cliff_side_diff_1k.jpg
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/cliff_side/cliff_side_nor_gl_1k.jpg
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dark_rock/dark_rock_diff_1k.jpg
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dark_rock/dark_rock_nor_gl_1k.jpg
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rocky_trail/rocky_trail_diff_1k.jpg
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rocky_trail/rocky_trail_nor_gl_1k.jpg
```

## v28 ゾーン別スカイボックスと床面

| ゾーン | スカイボックス | 床面 | 出典・ライセンス |
|---|---|---|---|
| AZURE SEA | Small Harbour Sunset 1K HDR | 専用の青灰色・泡模様CanvasTexture水面 | Skybox: https://polyhaven.com/a/small_harbour_sunset, CC0 1.0 |
| CASCADE GORGE | Valley Of Desolation 1K HDR | 専用の淡青色・細波CanvasTexture河川。Rocky Terrain 03は乾いた地形素材として同梱 | Skybox: https://polyhaven.com/a/valley_of_desolation, floor source: https://polyhaven.com/a/rocky_terrain_03, CC0 1.0 |
| EMBER CANYON | Industrial Sunset 02 (Pure Sky) 1K HDR | Dark Rockの1K Diffuse/Normalを高頻度設定で使用 | Skybox: https://polyhaven.com/a/industrial_sunset_02_puresky, floor source: https://polyhaven.com/a/dark_rock, CC0 1.0 |
| DUNE SEA | Goegap 1K HDR | Sand 01の1K Diffuse/Normalを高頻度設定で使用 | Skybox: https://polyhaven.com/a/goegap, floor source: https://polyhaven.com/a/sand_01, CC0 1.0 |

`src/world/sky.js`では`RGBELoader`により4本の1K equirectangular HDRIを読み込み、既存の二重ドーム上でクロスフェードする。`src/world/terrain.js`では`WATER_MATS`、`FLOOR_MATS`、既存の`CLIFF_MATS`を分離し、`setZone()`で水面・床面・岩壁を同時にゾーン切替する。床面と水面は`noCollide`のままであり、既存の飛行回廊および障害物判定を変更しない。

直接の取得元:

```text
https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/small_harbour_sunset_1k.hdr
https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/valley_of_desolation_1k.hdr
https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_sunset_02_puresky_1k.hdr
https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/goegap_1k.hdr
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rocky_terrain_03/rocky_terrain_03_diff_1k.jpg
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rocky_terrain_03/rocky_terrain_03_nor_gl_1k.jpg
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/sand_01/sand_01_diff_1k.jpg
https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/sand_01/sand_01_nor_gl_1k.jpg
```
