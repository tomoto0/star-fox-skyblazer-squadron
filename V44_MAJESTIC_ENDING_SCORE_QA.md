# v44 荘厳なエンディング曲／最終スコア背景 QA

**対象:** STAR FOX — SKYBLAZER SQUADRON  
**更新日:** 2026-08-27  
**判定:** 実装・素材確認・デスクトップ／縦型表示確認 合格

## 目的

最終ボス撃破後のクリア演出を、単なる結果表示ではなく、艦隊が帰還へ向かう**荘厳な最終デブリーフィング**として強化した。既存の戦闘・ボス崩壊・僚機通信を維持し、デブリーフィングへ移る時点で専用のオーケストラ曲を再生する。最終スコア、撃墜数、命中率、解除情報、タイトル復帰案内は、生成した帰還背景の上で一画面に読めるように調整した。

## 音楽素材

エンディング専用曲として、Scott Buckley公式ライブラリから**「Age of Wonder」**のフルミックスMP3をダウンロードし、`assets/audio/music/ending_majestic.mp3`として追加した。公式ページでは、この曲を「勇気、忍耐、発見」を軸にした壮大で荘厳なオーケストラ曲であり、終盤を合唱、弦、金管の華やかなフィナーレで締める作品としている。[1]

| 項目 | 内容 |
|---|---|
| ファイル | `assets/audio/music/ending_majestic.mp3` |
| 作品名・作者 | *Age of Wonder* — Scott Buckley |
| 取得元 | Scott Buckley公式ライブラリのフルミックスMP3 [1] |
| 形式・長さ・容量 | MP3、350.981秒、14,041,578 bytes |
| ライセンス | Creative Commons Attribution 4.0 International（CC BY 4.0）[1] [2] |
| 必要な帰属表記 | `'Age of Wonder' by Scott Buckley - released under CC-BY 4.0. www.scottbuckley.com.au` |

> 本曲はCC BY 4.0のため、ゲームを公開・配布・動画化する場合は、上記の帰属表記をREADME、クレジット画面、配布ページ、動画説明欄など、利用形態に応じた分かりやすい箇所へ残す必要がある。[1] [2]

## 実装内容

`src/core/audio.js`へ`ending`トラックを追加し、ダウンロード音源が取得済みの場合はWeb Audioでループ再生するよう設定した。万一のネットワーク・デコード失敗時には、低速で広がりのある既存WebAudioシーケンスがフォールバックとして動作する。最終デブリーフィング開始時の`audio.playTrack('victory')`は、`audio.playTrack('ending')`へ置き換えた。

静的配信サーバーでは`.mp3`、`.ogg`、`.wav`に明示的な音声MIME型を追加し、音源を長期公開キャッシュの対象に含めた。これにより、エンディング曲を含む既存の外部音源がブラウザで適切なメディア資産として配信される。

## 最終スコア背景と画面設計

`assets/concept/ending_debrief.jpg`を生成し、1920×1080のprogressive JPEG、315,200 bytesへ最適化した。夕暮れの異星海、帰還する4機の編隊、崩壊しつつあるリフト要塞、金色の地平線を描き、中央には最終スコアを置くための暗く低密度な領域を確保している。第三者素材ではないため、この背景に外部クレジットは不要である。

`#ending-screen`には、背景画像の上に青黒い中央ビネット、左右の暗部、細いシアン／ゴールドの計器線を重ねた。`MISSION COMPLETE`は金色の大型スタンプ、統計パネルは青と金の縁取り、デブリーフィング曲を示す小見出しはシアンで表示する。背景の壮大さを残しながら、最終スコアの読みやすさを優先した。

| 表示要素 | 演出 |
|---|---|
| 背景 | 帰還編隊・夕景・崩壊した要塞。文字領域は暗いオーバーレイで保護。 |
| 曲名帯 | `HOMEWARD SIGNAL // ORCHESTRAL DEBRIEF`。荘厳な帰還演出の意図を補助する。 |
| ミッション完了 | 金色の大型スタンプと金色のグロー。 |
| 最終成績 | FINAL SCORE、HOSTILES DOWN、FLIGHT ACCURACYを一列の高コントラスト計器パネルに集約。 |
| 帰還メッセージ | 僚機4名とRexの通信を中央へ残し、物語的な余韻を維持。 |
| 解除・復帰案内 | AFTERBURNER+の解除状態とタイトル復帰操作を下部へ明示。 |

## 検証結果

デスクトップ1280×720と縦型モバイル390×844で、実際のクリア状態を再現した。テストではスコア48,750、撃墜128、命中率89%を設定し、`_victory()`からデブリーフィングへ遷移させた。画面の表示、数値、背景、タッチコントロールの非表示、音源ファイルのHTTP 200到達性を確認した。

| 検証項目 | 1280×720 | 390×844 |
|---|---:|---:|
| `ending-screen`の表示 | 合格 | 合格 |
| 帰還背景画像の適用 | 合格 | 合格 |
| スコア・撃墜数・命中率の表示 | `048750 / 128 / 89%` | `048750 / 128 / 89%` |
| タッチコントロールの終了時非表示 | 合格 | 合格 |
| エンディング曲ファイルのHTTP到達性 | HTTP 200、14,041,578 bytes | HTTP 200、14,041,578 bytes |
| JavaScript実行時エラー | なし | なし |
| 解除情報と復帰案内の画面内表示 | 合格 | 合格 |

デスクトップは当初、720px高の画面で解除情報と復帰案内が下端へ近づいたため、エンディング要素の余白、肖像の寸法、統計パネルの内側余白を小さくする専用規則を追加した。最終状態では、成績、エピローグ、解除情報、`PRESS ENTER TO RETURN TO TITLE`まで同一画面に収まる。

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `assets/audio/music/ending_majestic.mp3` | 公式配布のCC BY 4.0エンディング曲を追加。 |
| `assets/concept/ending_debrief.jpg` | 生成・最適化した最終スコア背景を追加。 |
| `tools/optimize_ending_image.py` | 背景JPEGを1920×1080・900KB未満へ再生成する手順を追加。 |
| `src/core/audio.js` | `ending`トラック、外部音源URL、WebAudioフォールバックを追加。 |
| `src/game/game.js` | 最終デブリーフィング時に`ending`トラックを再生するよう変更。 |
| `index.html` | エンディング曲を示すデブリーフィング帯を追加。 |
| `css/style.css` | 帰還背景、可読性オーバーレイ、スコアパネル、720px高画面のコンパクト規則を追加。 |
| `server.mjs` | 音声MIME型と音源の公開キャッシュ対象を追加。 |
| `assets/CREDITS_ASSETPACK.txt` | 音源の出典、ライセンス、必要な帰属表記を追記。 |

## References

[1]: https://www.scottbuckley.com.au/library/age-of-wonder/ "Age of Wonder — Scott Buckley"
[2]: https://creativecommons.org/licenses/by/4.0/ "Creative Commons Attribution 4.0 International"
