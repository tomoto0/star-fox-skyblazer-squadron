# v51 Sky Talon — CC0航空機敵機の統合QA

**対象:** STAR FOX — SKYBLAZER SQUADRON  
**更新日:** 2026-08-28  
**判定:** 合格

## 概要

新規AI敵機 **Sky Talon** を追加した。ベースモデルには、OpenGameArtでiPoly3Dが公開した「Lowpoly light plane」を使用している。配布ページはCC0を表示し、利用条件を「CC0 do whatever you want」と記載しているため、ゲーム内での変換・改変・配布が可能である。[1]

> 元モデルは、低翼・胴体・尾翼を持つ一般航空機のシルエットである。既存の宇宙機型敵とは異なる形状を活かし、低空を横切る高速迎撃機として実装した。

## アセットの処理

| 項目 | 内容 |
|---|---|
| 取得元 | [OpenGameArt — Lowpoly light plane][1] |
| 作者 | iPoly3D |
| ライセンス | [CC0 1.0 Universal][2] |
| 原形式 | Blender 2.83の`.blend`、配布ページ記載847.3 KB |
| 変換形式 | GLB（Blender 4.0.2でメッシュのみをエクスポート） |
| 導入パス | `assets/models/external/sky_talon.glb` |
| 導入サイズ | 66,596 bytes |
| ポリゴン数 | 446（元の2メッシュ） |
| SHA-256 | `93eeabb94d606899da7663917a3388b831c11c9a37892c5f4affb45d3018ccd6` |

カメラ、照明、アニメーションなどの作者用データはGLBに含めず、ブラウザで不要なデータを持ち込まないようにした。ライセンスの詳細、取得元、変換記録は`THIRD_PARTY_ASSETS.md`にも保持している。

## ゲームへの統合

| 領域 | 実装 |
|---|---|
| モデル定義 | `src/entities/shipFactory.js`へ`skytalon`を追加し、既存の`GLTFLoader`でGLBをロードする。モデルの正規化、フォグ、両面描画、フィルライト、戦闘フレームを既存仕様に従わせた。 |
| 敵軍としての視認性 | 元モデルの青い塗装を敵軍色の暖色装甲へ72%ブレンドし、プレイヤー・僚機の配色と区別した。アンバーの発光を設定した。 |
| 戦闘性能 | HP 11、半径3.9、スコア190。高速バンク飛行と2発の精密ボルトを持つ。既存の戦闘機AIを基に、横移動・上下移動をやや速く、射撃間隔は長くして公平性を保つ。 |
| HUD・僚機 | ELITE分類、ロックオン、僚機の標的選択、既存の戦闘フレームに登録した。読み込み完了前は既存の`buildStrafer`をフォールバックとして使用する。 |
| Wave | Ember CanyonのWave 7・8に2機編隊として配置し、通常のランダム増援ではWave 7以降に出現可能とした。 |

## 検証結果

| 検証項目 | 結果 |
|---|---|
| 全ESモジュールの構文 | 合格。対象の全モジュールが`node --check`を通過。 |
| GLB配信 | 合格。`/assets/models/external/sky_talon.glb`はHTTP 200、66,596 bytesで取得できる。 |
| 関連ソース配信 | 合格。`shipFactory.js`、`enemies.js`、`waves.js`はHTTP 200で取得できる。 |
| 実ロード | 合格。火山帯のWave 7で`skytalon`を生成し、GLB由来のモデル、戦闘フレーム、ELITEマーカーが存在することを確認。 |
| AI挙動 | 合格。高速バンク移動、標的追尾、2発のボルト射撃が既存の敵機更新系へ接続される。 |
| デスクトップ描画 | 合格。1280×720相当で航空機シルエット、敵軍色、火山帯の背景、HUDが同時に描画される。 |
| モバイル幅 | 合格。390×844相当でWave 7を起動し、中央回廊・照準・HUDとの干渉や実行時例外がない。 |
| 実行時エラー | 合格。最終のヘッドレス実行で`Uncaught`、`Exception`、`SyntaxError`、`ReferenceError`、`TypeError`、ロード失敗は確認されなかった。 |

## 影響範囲

Sky Talonの追加は、敵機の種類、Wave構成、および後半のランダムな空中増援に限定される。プレイヤー機、僚機の基本挙動、地形コライダー、既存敵のHP・攻撃、ランキング保存形式は変更していない。軽量モデル（446ポリゴン、65 KB GLB）を使用し、読み込み後のテンプレート複製方式に沿っている。

## 参照

[1]: https://opengameart.org/content/lowpoly-light-plane "OpenGameArt — Lowpoly light plane by iPoly3D"
[2]: https://creativecommons.org/publicdomain/zero/1.0/ "Creative Commons Zero 1.0 Universal"
