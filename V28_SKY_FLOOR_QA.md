# v28 ゾーン別床面・スカイボックス QA

**対象:** STAR FOX — SKYBLAZER SQUADRON  
**更新日:** 2026-08-27  
**判定:** 合格

本更新は、v27で分離した岩壁テクスチャに加えて、**床面と遠景スカイボックスを四ゾーンで個別化**するものです。CC0 1.0が明示されたPoly Haven素材を1K解像度で採用し、連続するレールシューティングの速度感を損なわないよう、床面は高反復の軽量マテリアル、空は二重ドーム上のequirectangular HDRIとして実装しました。

| ゾーン | 床面の個別表現 | スカイボックス | 実装上の配慮 |
|---|---|---|---|
| AZURE SEA | 青灰色の波筋と泡をもつ専用CanvasTexture水面 | Small Harbour Sunset 1K HDR | 動く頂点波と夕陽の水上視認性を維持 |
| CASCADE GORGE | 淡青色の細波をもつ専用CanvasTexture河川。Rocky Terrain 03を乾いた地形素材として同梱 | Valley Of Desolation 1K HDR | 水面のまぶしさを抑え、滝・岩壁を識別可能に維持 |
| EMBER CANYON | Dark Rockの1K Diffuse/Normalを高反復で使用 | Industrial Sunset 02 (Pure Sky) 1K HDR | 黒い火山床と熾火の赤紫照明を分離 |
| DUNE SEA | Sand 01の1K Diffuse/Normalを高反復で使用 | Goegap 1K HDR | 砂紋の密度を上げつつ安全回廊の輪郭を保持 |

## 実装内容

`src/world/sky.js`は`RGBELoader`で4本の1K HDRIを読み込み、既存のグラデーション空、雲、二重ドームのクロスフェードを維持したままゾーン別に表示する。各HDRIは背景専用とし、物理反射環境マップには使用しない。

初回の実機検証では、低機能WebGLドライバーがFloatType HDRIから生成したPMREM環境マップに対して、外部モデルの物理マテリアルでシェーダー検証エラーを出した。このため`skyboxOnly`フラグを追加し、`Game._applyEnv()`はHDRIをPMREM変換せず、背景ドームだけに表示するよう修正した。これは背景の品質を維持しながら、外部GLBと低機能ドライバーの互換性を確保する措置である。

`src/world/terrain.js`は水面用の`WATER_MATS`、地表用の`FLOOR_MATS`、岩壁用の`CLIFF_MATS`を分離した。`setZone()`が現在ゾーンに応じて水面、地表、岩壁を同時に切り替える。全床面は障害物配列へ登録されず、アンダーレイにも`noCollide`を明示したため、飛行回廊と衝突公平性は変わらない。

## 検証結果

| 検証項目 | 結果 |
|---|---|
| HDRIロード | `sky_sea`、`sky_day`、`sky_sunset`、`sky_desert`の全4本で1,024×512、FloatTypeデータの読込を確認 |
| 海面 | CanvasTextureの読込を確認。タイトル画面で青灰色の波筋・泡表現を確認 |
| CASCADE GORGE | Wave 4で`sky_day`、河川用水面マテリアル、1,024×512 HDRIの選択を確認 |
| EMBER CANYON | Wave 7で`sky_sunset`、火山床面、アンダーレイの地表テクスチャ接続を確認 |
| DUNE SEA | Wave 10で`sky_desert`、Sand 01床面Diffuse/Normal、アンダーレイ接続を確認 |
| 回廊安全性 | 水面更新後、砂漠で水面非表示・床面表示・アンダーレイの`noCollide`を確認 |
| PMREM互換性 | 背景用HDRIで`skyboxOnly: true`、`scene.environment: null`を確認。修正後ログに新規シェーダー警告・例外なし |
| 構文 | `src/**/*.js`の全22 ES Moduleが構文検査に成功 |

## 素材とライセンス

すべてCC0 1.0である。[1] [2] [3] [4] [5] [6]

| ファイル群 | 出典 | 用途 |
|---|---|---|
| `assets/skyboxes/*.hdr` | Poly Haven HDRIs | 海・峡谷・火山・砂漠の個別equirectangular空 |
| `assets/textures/zone_floors/gorge/*` | Poly Haven Rocky Terrain 03 | 峡谷の乾いた地形素材 |
| `assets/textures/zone_floors/dune/*` | Poly Haven Sand 01 | 砂漠の床面Diffuse/Normal |

詳細な出典、取得URL、クレジットは`ASSET_SOURCES_V26.md`および`assets/CREDITS_ASSETPACK.txt`に追記済みである。

## 参考資料

[1]: https://polyhaven.com/a/small_harbour_sunset "Poly Haven — Small Harbour Sunset"
[2]: https://polyhaven.com/a/valley_of_desolation "Poly Haven — Valley Of Desolation"
[3]: https://polyhaven.com/a/industrial_sunset_02_puresky "Poly Haven — Industrial Sunset 02 (Pure Sky)"
[4]: https://polyhaven.com/a/goegap "Poly Haven — Goegap"
[5]: https://polyhaven.com/a/rocky_terrain_03 "Poly Haven — Rocky Terrain 03"
[6]: https://polyhaven.com/a/sand_01 "Poly Haven — Sand 01"
