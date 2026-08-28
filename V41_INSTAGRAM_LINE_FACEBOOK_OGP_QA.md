# v41 Instagram・LINE・Facebook OGP 共有対応 QA

**対象:** STAR FOX — SKYBLAZER SQUADRON  
**更新日:** 2026-08-27  
**判定:** 実装・ローカルHTTP検証 合格

本更新では、ゲーム本体のCanvas、Three.js、入力、戦闘、画面遷移を変更せず、既存のOGP配信サーバーだけを補強した。Facebook、LINE、Instagram / Meta系の共有取得要求が来た場合、ルートURLであってもゲームHTMLではなく軽量な静的カードHTMLを返す。通常のブラウザには従来どおりゲームHTMLを返す。

## 調査結果と対応範囲

| サービス | 共有の扱い | 今回の対応 | 制約 |
|---|---|---|---|
| Facebook | URL共有時にOpen Graphタグでタイトル・説明・画像を制御でき、Sharing Debuggerで取得内容を確認できる [1] [2] | `facebookexternalhit` / `Facebot`へ静的カードHTML、絶対HTTPS OGP画像、gzip / deflate対応を返す | Meta側の取得キャッシュがある。画像更新はURL自体を変える必要がある [1] |
| LINE | URL共有時のリッチプレビューの互換性を高めるには、OGPタグ・到達可能な画像・静的HTMLが有効 | `Line/` / `LINE/`へ静的カードHTMLと同一のOGP画像を返す | 実際のクローラUA・表示形式はLINEのアプリ／地域／時期で変わり得る |
| Instagram | Instagram公式はストーリーズのリンクステッカーで外部URLへ遷移できると案内している [3] | `Instagram`、`InstagramBot`、`Meta-ExternalAgent`、`Meta-ExternalFetcher`を静的カード経路に追加。DM・アプリ内でURLが取得される場合の互換性を高める | 通常のInstagramフィード投稿は、外部ページのOGPだけで画像付き投稿を自動生成・置換する仕組みではない。主な導線はストーリーズのリンクステッカー |

> Open Graphの基本プロパティは`og:title`、`og:type`、`og:image`、`og:url`であり、`og:image:secure_url`、`og:image:type`、`og:image:width`、`og:image:height`、`og:image:alt`は画像を補強する構造化プロパティである [4]。

## 実装内容

`server.mjs`のクローラ判定へ、Facebook、Instagram / Meta系、LINEを明示追加した。該当するUser-Agentでは、`social-card.html`をベースにした約2.9KBの静的HTMLだけを返す。このHTMLにはCanvas、JavaScript、Three.js import map、ゲームアセット参照がない。通常ブラウザ向けの`index.html`は変更せず、従来のゲームを返す。

HTMLはクライアントが`Accept-Encoding: gzip`または`deflate`を通知した場合に圧縮して返す。FacebookのWebmaster向け資料では、Facebookクローラとの共有互換性のため、サーバーでgzipおよびdeflateを扱うよう案内している [1]。HTML応答の`Vary`は`User-Agent, Accept-Encoding`とし、共有キャッシュが「通常のゲームHTML」と「クローラ用カードHTML」、または圧縮・非圧縮応答を混同しないようにした。

OGP画像は既存の`/api/og-image.jpg`を継続利用する。これは同一オリジンのHTTP 200・リダイレクトなし・`Content-Type: image/jpeg`で配信される1200×630 JPEGであり、各SNSに同じ絶対HTTPS URLとして提示される。本番では`PUBLIC_ORIGIN=https://<最終公開ドメイン>`を設定する。

## 実機・HTTP検証

検証用リクエストには、`Host: play.example.test`および`X-Forwarded-Proto: https`を指定した。`play.example.test`はテスト用のダミードメインであり、本番公開URLではない。

| テスト | 結果 |
|---|---|
| Node構文 | `server.mjs`の構文検証に成功 |
| Facebook UA | `facebookexternalhit/1.1`でHTTP 200、gzip、静的カードHTML、絶対OGP画像URLを確認 |
| Instagram UA | `Instagram 320.0.0.0.0 Android`でHTTP 200、gzip、静的カードHTML、絶対OGP画像URLを確認 |
| Meta外部UA | `Meta-ExternalAgent/1.1`でHTTP 200、gzip、静的カードHTMLを確認 |
| LINE UA | `Line/13.0`でHTTP 200、gzip、静的カードHTML、絶対OGP画像URLを確認 |
| 通常ブラウザ | `Mozilla/5.0`でHTTP 200、gzip、Canvas `#gl`を含むゲームHTMLを確認 |
| キャッシュ分岐 | 通常・クローラ双方で`Vary: User-Agent, Accept-Encoding`を確認 |
| OGP画像 | `GET /api/og-image.jpg`でHTTP 200、`image/jpeg`、168,881 bytes、リダイレクトなしを確認 |
| robots | `GET /robots.txt`でHTTP 200、全クローラ許可を確認 |

## 本番共有の手順

Facebookでは、公開HTTPS URLを[Sharing Debugger][2]に入力して、画像・タイトル・説明を再スクレイプする。Meta公式資料では、画像はURL単位でキャッシュされ、画像更新時は新しい画像URLを使うよう説明している [1]。画像を更新する場合は、安定した新しい画像バージョンを公開し、対応する`og:image`へ切り替える。

LINEでは、最終HTTPS URLを新しいトークまたはテスト用のグループで送信し、カードの画像・タイトル・説明を確認する。キャッシュ中の既存トーク表示が変わらない場合は、メッセージを送信し直す。

Instagramでは、ゲームのURLをストーリーズ作成画面の**リンクステッカー**へ設定する。公式の案内では、ストーリーズにリンクステッカーを追加し、閲覧者がタップすると目的URLへ移動する [3]。Instagramのフィード投稿として画像を見せたい場合は、今回生成済みのOGP画像またはゾーン別コンセプト画像を投稿画像として別途アップロードし、キャプションやプロフィールリンク、ストーリーズのリンクステッカーからゲームURLへ誘導する。

## 結論

Facebook、LINE、Instagram / Meta系のURL取得要求に対して、Xと同じく軽量な静的カードHTML、包括的なOGPメタタグ、同一オリジンJPEG、公開キャッシュ、gzip / deflateを提供するようサーバー側のみを拡張した。ゲーム本体コードには変更を加えていない。公開後は実ドメインでHTTP 200、HTTPS、リダイレクトなしを確認し、FacebookはSharing Debugger、LINEは新規メッセージ、Instagramはストーリーズのリンクステッカーを使って最終表示を確認する。

## References

[1]: https://developers.facebook.com/documentation/sharing/webmasters "Meta for Developers — A Guide to Sharing for Webmasters"
[2]: https://developers.facebook.com/tools/debug/ "Meta for Developers — Sharing Debugger"
[3]: https://about.instagram.com/blog/announcements/expanding-sharing-links-in-stories-to-everyone "Instagram — Expanding Sharing Links in Stories to Everyone"
[4]: https://ogp.me/ "The Open Graph protocol"
