# 第三者3D素材のライセンス記録

## Lowpoly Light Plane

| 項目 | 内容 |
|---|---|
| 用途 | 新規AI敵機「Sky Talon」のベース航空機モデル |
| 作者 | iPoly3D |
| 配布元 | [OpenGameArt — Lowpoly light plane](https://opengameart.org/content/lowpoly-light-plane) |
| 配布ファイル | `lowpoly_plane_0.blend` |
| ライセンス | [Creative Commons Zero 1.0（CC0）](https://creativecommons.org/publicdomain/zero/1.0/) |
| 利用条件 | 配布ページには「CC0 do whatever you want」と明記されている。商用・非商用を問わず、ゲーム内への改変・再配布を含む利用が可能。 |
| ゲーム内の扱い | 元モデルをGLTF/GLBに変換し、既存の敵機ロード、戦闘フレーム、HUDマーカー、スポーン体系へ統合する。 |

## 選定理由

既存の敵機群が宇宙機中心であるのに対し、低翼・操縦席・尾翼を持つ軽航空機シルエットは、低空を高速で横切る**航空阻止・迎撃役**として直感的に判別できる。小規模なBlenderファイルであるため、WebGL用GLTFへの変換、スケール統一、既存の低ポリゴン表現への調整を行いやすい。

## 参照候補（不採用）

Poly Pizzaの「Airplane」はGLTF形式で入手できるが、Creative Commons Attribution 3.0であり、クレジット要件がある。今回の直接統合には、権利処理を簡潔に保てるCC0のOpenGameArt素材を採用した。

## Poly Pizza候補の確認

Poly Pizzaの「Airplane」は、ページ上で**OBJ/GLTF形式**および**Creative Commons Attribution 3.0**として表示される。ダウンロード操作は公開ページから可能だが、今回の候補素材はすでにCC0で利用条件が明快なOpenGameArtモデルを第一候補とする。CC BY素材を使用する場合は、配布元・作者・ライセンスをゲーム内クレジットおよび本記録に明示する。

## 実装・変換記録

| 項目 | 内容 |
|---|---|
| 取得日時 | 2026-08-28 |
| 取得元ファイル | `https://opengameart.org/sites/default/files/lowpoly_plane_0.blend` |
| 取得元の容量 | 847.3 KB（配布ページ記載） |
| 変換方法 | Blender 4.0.2で、メッシュオブジェクトのみを選択してGLBへエクスポート。カメラ、照明、アニメーションは含めない。 |
| 変換後ファイル | `assets/models/external/sky_talon.glb` |
| 変換後の容量 | 66,596 bytes |
| 変換後SHA-256 | `93eeabb94d606899da7663917a3388b831c11c9a37892c5f4affb45d3018ccd6` |
| 元メッシュ | 2オブジェクト、446ポリゴン |
| ゲーム内ID | `skytalon` |
| 登場Wave | Wave 7およびWave 8（Ember Canyon）。後半のランダム増援プールにもWave 7以降で登録。 |

GLB化後のモデルは、既存の`GLTFLoader`による正規化、敵機専用フィルライト、戦闘フレーム、ELITE HUDマーカー、ロックオン、および高速バンク飛行AIに接続される。

## 統合時の視覚確認

火山帯のWave 7で`skytalon`を生成し、GLBロード後に既存の敵機専用フレーム、ELITEマーカー、ロックオン対象、既存の火山地形と同時に描画されることを確認した。元の青い塗装は、プレイヤー側との識別性を保つため、敵軍の暖色装甲へ72%ブレンドしている。機体の低翼・胴体・尾翼は、既存の宇宙機型敵とは異なる航空機シルエットとして確認できる。
