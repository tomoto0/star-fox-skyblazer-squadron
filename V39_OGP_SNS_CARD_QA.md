# v39 OGP・SNSカード配信 QA

**対象:** STAR FOX — SKYBLAZER SQUADRON  
**更新日:** 2026-08-27  
**判定:** 実装・ローカル配信検証 合格

本更新では、Canvasゲームの通常画面を維持したまま、X、LINE、Facebook、WhatsAppなどのSNSクローラに専用の静的カードHTMLを返す配信経路を追加した。OGP画像は同一オリジンの固定URLでJPEGとして配信し、署名付きストレージURLやリダイレクトに依存しない。

## 実装内容

| 項目 | 実装 | 確認結果 |
|---|---|---|
| 専用OGP画像 | `assets/og/skyblazer_og.jpg` | 1200×630、progressive JPEG、168,881 bytes（約165KB） |
| 画像エンドポイント | `GET /api/og-image.jpg` | HTTP 200、`Content-Type: image/jpeg`、リダイレクトなし |
| 通常ページ | `GET /` | CanvasゲームHTMLとOGP/Xメタタグを返す |
| クローラ専用ページ | `GET /` + SNS User-Agent | `social-card.html`をベースにした2,942 bytesの静的カードHTMLを返す。Canvas、ゲームJavaScript、Three.js import mapを含まない |
| robots | `GET /robots.txt` | HTTP 200、`User-agent: *`と`Allow: /`を返す |
| キャッシュ | HTMLは公開キャッシュ、画像は長期公開キャッシュ | `Cache-Control`を各応答へ設定。分岐ページは`Vary: User-Agent`で共有キャッシュの混同を防止 |

## 設定したメタタグ

通常ページとクローラ専用カードページの両方に、サーバーが同じ絶対URLのメタタグを注入する。公開ドメインは`PUBLIC_ORIGIN`から取り、末尾のスラッシュを除去して正規化する。

| 区分 | タグ |
|---|---|
| Open Graph | `og:type`、`og:site_name`、`og:title`、`og:description`、`og:url`、`og:locale=ja_JP` |
| OGP画像 | `og:image`、`og:image:secure_url`、`og:image:url`、`og:image:type=image/jpeg`、`og:image:width=1200`、`og:image:height=630`、`og:image:alt` |
| X Card | `twitter:card=summary_large_image`、`twitter:title`、`twitter:description`、`twitter:image`、`twitter:image:src`、`twitter:image:alt`、`twitter:domain` |
| 補助SEO | `description`、`keywords`、`canonical` |

> 本番では、`PUBLIC_ORIGIN`を最終公開ドメインのHTTPS絶対URLに設定する。例は`.env.example`に記載した。これにより、すべての`og:image`と`twitter:image`は `https://<公開ドメイン>/api/og-image.jpg` となる。

## クローラ配信設計

`server.mjs`は、`Twitterbot`、`TwitterPreview`、`facebookexternalhit`、`Facebot`、`LinkedInBot`、`WhatsApp`、`Slackbot`、`Discordbot`、`TelegramBot`、`Line` / `LINE`、`Googlebot`を検知する。該当するUser-Agentには、ゲーム本体を読ませない静的なカードHTMLをHTTP 200で返す。通常ブラウザには従来の`index.html`を返すため、Canvasゲーム画面・操作・アセット読込経路は変わらない。

画像、カードHTML、robotsはいずれもリダイレクトを発生させない。同一オリジンの`/api/og-image.jpg`は、`Content-Type: image/jpeg`および`X-Content-Type-Options: nosniff`を返す。画像はPNGのまま配信せず、容量の制約が厳しいWhatsAppを含む共有カードで扱いやすいJPEGを採用した。

## 実機・HTTP検証

検証用サーバーは、`PUBLIC_ORIGIN=https://play.example.test`を設定してポート8748で実行した。この値は**検証専用のダミー公開ドメイン**であり、本番URLではない。

| テスト | 結果 |
|---|---|
| Node構文 | `server.mjs`の構文検証に成功 |
| 通常ブラウザ | `GET /`でHTTP 200。Canvas `#gl`を含むゲームHTML（12,233 bytes）を返却 |
| X | `Twitterbot/1.0`でHTTP 200。静的カードHTML（2,942 bytes）と必須メタタグを返却 |
| Facebook | `facebookexternalhit/1.1`でHTTP 200。静的カードHTMLを返却 |
| WhatsApp | `WhatsApp/2.23`でHTTP 200。静的カードHTMLを返却 |
| LINE | `Line/13.0`でHTTP 200。静的カードHTMLを返却 |
| クローラ負荷 | クローラHTMLに`canvas`、`script`、`src/main.js`、`node_modules`参照がないことを確認 |
| OGP URL | 通常・クローラ双方のHTMLで `https://play.example.test/api/og-image.jpg` を確認 |
| OGP画像 | HTTP 200、JPEG、1200×630、168,881 bytes、`Location`ヘッダーなし |
| robots | HTTP 200、全クローラ許可を確認 |
| 共有キャッシュ安全性 | 通常・クローラ双方で`Vary: User-Agent`を確認。HTMLは公開キャッシュ、画像は長期公開キャッシュを確認 |

## 本番公開時の設定

本番HTTPS環境では、プロセス起動時に次のように公開オリジンを与える。

```bash
PUBLIC_ORIGIN=https://play.example.com PORT=8747 node server.mjs
```

`PUBLIC_ORIGIN`が未設定の場合、サーバーはリクエストのHostと`X-Forwarded-Proto`から絶対URLを組み立てる。ただし、SNSクローラの確実な取得のため、本番では必ず最終HTTPSドメインを明示設定することを推奨する。

## 運用上の注意

X、LINE、WhatsApp、Facebookなどはカード内容を個別にキャッシュする。この更新後でも既存投稿が直ちに置き換わらない場合がある。その場合は新規投稿を行うか、既存投稿を削除して再投稿し、各プラットフォームに再取得させる。最終公開後は、実際のHTTPSドメインで`/`、`/api/og-image.jpg`、`/robots.txt`がすべて200・リダイレクトなしであることを一度確認する。

## 結論

OGP画像、安定画像URL、主要SNS向けメタタグ、クローラ専用静的HTML、robots、公開キャッシュを一式で実装した。通常ブラウザには従来のCanvasゲームが返り、SNSクローラには数KBのカードHTMLのみが返るため、共有カードの取得負荷と互換性を改善しつつ、ゲームの体験を変えない構成となっている。
