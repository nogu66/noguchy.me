# noguchy.me

個人の技術ブログサイトです。

## 技術スタック

- **Framework**: [Astro](https://astro.build/)
- **Theme**: [AstroPaper](https://github.com/satnaing/astro-paper)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **Deployment**: [Cloudflare Pages](https://pages.cloudflare.com/)

## ローカル開発

```bash
# 依存関係のインストール
pnpm install

# 開発サーバーの起動
pnpm run dev

# ビルド
pnpm run build
```

## ニュースサイト（news.noguchy.me）

同じリポジトリからニュース専用の Astro サイトを独立してビルドし、Cloudflare Workers Static Assets で公開します。個人サイトは `dist/`、ニュースサイトは `dist-news/` に出力します。

```bash
pnpm run dev:news     # http://localhost:4322/
pnpm run build:news   # ニュース専用ビルド
pnpm run preview:news # Workers のローカル環境で確認
pnpm run deploy:news  # ビルドして Workers に公開
```

ニュースの記事は引き続き `src/content/news/` に追加します。`pnpm new-news` で雛形を作成できます。画像は `public/images/news/`、サイト設定は `src/news.config.ts`、専用ページは `news-site/pages/` にあります。共通の Markdown 記法・X 埋め込み・テーマを引き継ぎます。

| 用途             | URL                                        |
| ---------------- | ------------------------------------------ |
| ニュース一覧     | `https://news.noguchy.me/`                 |
| 記事             | `https://news.noguchy.me/articles/記事名/` |
| 2ページ目以降    | `https://news.noguchy.me/page/2/`          |
| ニュース専用 RSS | `https://news.noguchy.me/rss.xml`          |

一覧 OGP は専用画像、記事 OGP は `ogImage` → `thumbnail` → 一覧用画像の優先順です。canonical・OGP URL・共有リンクは開発環境でも本番ドメインを使います。個人サイトの旧 `/news` ページは新サイトに転送されます。

### Workers への初回公開

1. `pnpm exec wrangler login` で `noguchy.me` ゾーンを管理する Cloudflare アカウントにログインします。
2. `pnpm run deploy:news` を実行します。`wrangler.news.jsonc` の Custom Domain 設定により `news.noguchy.me` を Worker に接続します。
3. 新サイトの記事と OGP が本番で表示されることを確認してから、転送を含む個人サイトを公開します。

Workers の Git 連携を使う場合は、このリポジトリのルートを指定し、ビルドコマンドを `pnpm run build:news`、デプロイコマンドを `pnpm exec wrangler deploy --config wrangler.news.jsonc` に設定します。既存の個人サイトとは別の Worker `noguchy-news` を使用します。

Cloudflare アカウントや DNS の接続はローカルのビルドだけでは行われません。設定の詳細は [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) と [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) を参照してください。

## ライセンス

MIT License
