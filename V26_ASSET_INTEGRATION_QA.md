# v26 アセット・環境表現統合 QA

**対象:** STAR FOX — SKYBLAZER SQUADRON  
**記録日:** 2026-08-27  
**結果:** 合格

本更新では、権利関係が不明な既存ゲーム由来素材を避け、**CC0 1.0として明示されたWeb素材のみ**を追加した。各素材は、元の形式をそのまま画面へ貼るのではなく、既存のThree.js環境、通信演出、HUDへ用途を限定して統合している。出典とライセンスは`assets/CREDITS_ASSETPACK.txt`と`ASSET_SOURCES_V26.md`へ追記済みである。

| 領域 | 導入・改善内容 | 実装箇所 | 検証結果 |
|---|---|---|---|
| 岩壁・崖 | Poly HavenのCoastal Cliff 04から1K Diffuse/Normal(GL)を採用。多層の地層、張り出し棚、崩積岩をもつ「buttressed cliff」へ適用 | `src/world/terrain.js` | 画像2枚のロードと地形プール生成を確認 |
| 浮遊島 | 断層化した腹部、広い頂部、浮遊破片、弱い発光結晶を持つRift Isletを追加 | `src/world/terrain.js` | Wave 15 / DUNE SEAで10個の島を生成確認 |
| 海・峡谷・火山・砂漠 | 遠景の単純な岩柱・メサを複雑な多層崖へ置換。後半EMBER/DUNEに浮遊島レイヤーを追加 | `src/world/terrain.js` | 安全回廊外・`noCollide`の配置を確認 |
| 通信ボイス | 救援要請、僚機の一斉攻撃、救援成功、Wave進行、任務完了へ短いCC0音声を統合 | `src/core/audio.js`、`src/entities/wingmates.js`、`src/game/game.js` | ボイス6本のロードとイベントフックを確認 |
| カットイン/HUD | Kenney Sci-Fi UIの青・琥珀フレームを通信肖像と本文パネルへ統合。司令通信と僚機通信を色で区別 | `src/ui/hud.js`、`css/style.css` | `REX`通信時に`command-comms`クラスが有効になることを確認 |
| エンディング音楽 | Victoryトラック開始直後に停止していた呼び出しを修正 | `src/game/game.js` | 勝利時はBGMと任務完了音声を両立するコードパスへ修正 |

## 1. Web素材とライセンス

> **採用原則:** 固有IPの機体、人物、台詞、UIをWebから流用せず、ライセンスと再利用範囲が明示された汎用ゲーム素材だけを用いる。

Poly HavenのCoastal Cliff 04はCC0として公開されている高精細な岩壁スキャンである。[1] 元モデルは約300万ポリゴンのため、レールシューティングの連続チャンクへモデル本体を直接積むのではなく、1K Diffuse/Normalマップだけを使用した。これにより、同じ軽量なプロシージャル岩のシルエットに岩肌の細部を付与し、描画コストを抑えている。

通信にはKenneyのVoiceover Packから6つの短い一般的な作戦音声を採用した。配布ページはCC0を明示し、商用利用を含むゲーム組込みが可能である。[2] UIについてもKenneyのSci-Fi UI Packから、青・琥珀のフレームPNGのみを採用した。同パックは130要素を含むCC0素材として公開されている。[3] なお、OpenGameArtの60 CC0 Sci-Fi SFXも確認したが、本バージョンで使用する音の意味を曖昧にしないため、実ファイルは製品ツリーへは追加していない。[4]

| 追加ファイル | 用途 | ライセンス |
|---|---|---|
| `assets/textures/coastal_cliff_04/diffuse.jpg` | 多層崖・浮遊島の岩肌カラー | CC0 1.0 |
| `assets/textures/coastal_cliff_04/normal_gl.jpg` | 岩肌の法線ディテール | CC0 1.0 |
| `assets/audio/voice/*.ogg` 6本 | 作戦通信の短い補強 | CC0 1.0 |
| `assets/ui/kenney-space/comms_frame_blue.png` | 僚機通信フレーム | CC0 1.0 |
| `assets/ui/kenney-space/comms_frame_amber.png` | 司令通信フレーム | CC0 1.0 |

## 2. 環境造形の改善

`buttressedCliff()`は、基部、3〜4段の斜めにずれた地層、侵食棚、足元の崩積岩で構成される。海の海食スタック、峡谷の外壁、火山の遠景シルエット、砂漠の大規模砂岩リッジへ適用し、円錐状の岩を規則的に並べた印象を除去した。

`riftIslet()`は、平らな浮島ではなく、太い岩盤の腹部、やや広い頂部、下向きに伸びる結晶状断層、周囲の小破片をもつ。EMBER CANYONのWave 11以降およびDUNE SEAのWave 15以降で、回廊の外側かつ上空へだけ配置される。各島は`noCollide`であり、既存のルートマーカー、障害物、安全マージンを妨げない。

## 3. 通信・UI・音響の改善

通信は画面上の台詞が主役であり、音声はイベントの理解を助ける短い補強である。音声は1.25秒の共通クールダウンを持つため、連続撃破や一斉攻撃で台詞が重なって聞き取れなくなることを防ぐ。危険時の僚機、僚機の支援射撃、救援成功、Wave移行、任務完了という、プレイヤーが状況を判断する必要があるイベントに限って再生する。

司令官、BOWIE、THORNEの通信は琥珀フレーム、僚機通信は青フレームで表示する。背景画像は低い不透明度の装飾レイヤーとしてのみ使い、本文・名前・肖像のコントラストとタップ領域を損なわない。

## 4. 検証記録

| テスト | 結果 |
|---|---|
| 追加アセットのHTTP配信 | 6ボイス、青/琥珀フレーム、Diff​​use/NormalがすべてHTTP 200 |
| ブラウザの実リソース | ボイス6、UIフレーム2、岩壁テクスチャ2のロードを確認 |
| Wave 15地形 | 状態`playing`、ゾーン`dune`、Rift Islet 10個、地形子オブジェクト284を確認 |
| 通信カットイン状態 | `REX`通信で`active: REX`、`command-comms: true`を確認 |
| 通常出撃 | Wave 1でHUD、僚機、背景地形、機体表示を確認 |
| JavaScript構文 | `src/**/*.js`の全22モジュールがES Module検査に成功 |
| 実行ログ | 最新ブラウザセッションで新規JavaScript例外・Three.js警告なし |

## 最終判定

**合格。** Web由来の追加素材は、CC0で明示されたものだけを用途限定で統合している。高ポリゴンの岩壁モデルをそのまま増やす代わりに、軽量なテクスチャと多層プロシージャル形状を組み合わせ、画面密度と性能を両立した。通信、UI、勝利演出も音声・フレーム・状態遷移が同期する。

## 参考資料

[1]: https://polyhaven.com/a/coastal_cliff_04 "Poly Haven — Coastal Cliff 04 (CC0)"
[2]: https://opengameart.org/content/voiceover-pack-40-lines "OpenGameArt — Voiceover Pack by Kenney (CC0)"
[3]: https://kenney.nl/assets/ui-pack-sci-fi "Kenney — UI Pack - Sci-Fi (CC0)"
[4]: https://opengameart.org/content/60-cc0-sci-fi-sfx "OpenGameArt — 60 CC0 Sci-Fi SFX by rubberduck"
