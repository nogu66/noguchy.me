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

### ローカル記事エディタ（News Studio）

#### Macアプリとして使う

```bash
pnpm run editor:news:install
```

`~/Applications/News Studio.app` が作成されます。Finderからダブルクリック、またはDockにドラッグして起動できます。専用ウィンドウで開き、ローカルサーバーも自動起動します。初回のアプリ作成にはXcode Command Line Toolsが必要です。

アプリはこのリポジトリとインストール時のNode.jsを利用します。移動・変更した場合はインストールコマンドを再実行してください。更新前のアプリは `.local/news-editor/app-backups/` に退避します。入力内容の自動退避はアプリ専用で、ブラウザ側とは別です。記事ファイルは共通です。アプリを閉じてもローカルサーバーは継続し、次回起動時に再利用されます。

#### ブラウザで使う

Notion風のリッチテキスト編集画面を、このリポジトリ専用に用意しています。

```bash
pnpm install
pnpm run editor:news
# http://127.0.0.1:4323/ を開く
```

- 左側の記事一覧から既存記事を開くか、「新しい記事」で下書きを作成します。
- 本文に直接入力できます。`/` から見出し・リスト・引用・コード・画像・区切り線・表を追加できます。文字を選択すると書式メニューが開きます。
- 画像は選択・貼り付け・ドロップで挿入できます。カバー画像も指定できます。画像は最大10MB、最大2400px幅のWebPに変換して `public/images/news/editor/` に保存します。アニメーション画像は静止画になります。
- タイトル・概要・日本時間の公開日時・タグ・公開対象を設定します。「記事設定」から要点、ファイル名、Markdownのダウンロードも操作できます。
- 入力中の内容はブラウザ内に自動退避されます。**「保存する」または `⌘S` / `Ctrl+S`** で `src/content/news/` に書き込みます。自動退避は同じブラウザ・同じURL内でのみ復元でき、ブラウザのデータを消すと失われます。
- 下書きはサイトに表示されません。「公開対象」で保存した記事は、従来どおり `pnpm run deploy:news` で公開します。**保存だけではデプロイ・コミットは行いません。**
- 既存記事の更新前には `.local/news-editor/backups/` に元ファイルを保存します。外部で変更された記事は上書きを拒否します。入力をダウンロードしてから「記事ファイルから読み直す」で最新内容を確認できます。
- Zenn独自記法・HTML・数式などを含む本文は、内容を保持するためMarkdown編集で開きます。プレビューは標準Markdownの簡易表示で、X等の埋め込み・独自記法はサイト側で描画します。Tiptapの[Markdown機能](https://tiptap.dev/docs/editor/markdown/getting-started/installation)を利用しています。

ローカルの `127.0.0.1` のみに接続を受け付けます。ログイン・外部CMS・データベースは不要です。ポート変更は `NEWS_EDITOR_PORT=4324 pnpm run editor:news`。公開サイトのビルドにエディタは含まれません。

保存時はリポジトリのPrettier設定に合わせて整形します。コードブロック等の構文が原因で整形できない場合は、元ファイルを変更せずエラーを表示します。

実装は `tools/news-editor/` と `scripts/news-editor-*.mjs`。サーバーの変更時は再起動してください。エディタの保存・バックアップ・競合検出などのテストは `pnpm test scripts/news-editor-store.test.mjs` で実行できます。

画像は追加時にファイル保存されます。本文から画像を外しても元画像は残ります。不要画像やバックアップの自動削除は行いません。

### Workers への初回公開手順

1. `pnpm exec wrangler login` で `noguchy.me` ゾーンを管理する Cloudflare アカウントにログインします。
2. `pnpm run deploy:news` を実行します。`wrangler.news.jsonc` の Custom Domain 設定により `news.noguchy.me` を Worker に接続します。
3. 新サイトの記事と OGP が本番で表示されることを確認してから、転送を含む個人サイトを公開します。

Workers の Git 連携を使う場合は、このリポジトリのルートを指定し、ビルドコマンドを `pnpm run build:news`、デプロイコマンドを `pnpm exec wrangler deploy --config wrangler.news.jsonc` に設定します。既存の個人サイトとは別の Worker `noguchy-news` を使用します。

Cloudflare アカウントや DNS の接続はローカルのビルドだけでは行われません。設定の詳細は [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) と [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) を参照してください。

## ライセンス

MIT License
