# noguchy.me セットアップガイド

このプロジェクトは、Astro Paperテンプレートをベースにした個人ブログサイト「noguchy.me」です。

## プロジェクト情報

- **サイト名**: noguchy.me
- **説明**: 個人ブログ
- **言語**: 日本語（ja）
- **タイムゾーン**: Asia/Tokyo
- **テンプレート**: Astro Paper v5.5.0

## 環境要件

- Node.js 18以上
- pnpm 9以上

## インストール方法

### 1. 依存パッケージのインストール

```bash
cd /home/ubuntu/noguchy-me
pnpm install
```

### 2. 開発サーバーの起動

```bash
pnpm dev
```

サーバーが起動すると、以下のURLでサイトにアクセスできます：
- ローカル: `http://localhost:4321/`

## ビルド

本番環境用にサイトをビルドする場合：

```bash
pnpm build
```

ビルド結果は `dist/` ディレクトリに出力されます。

## 主な機能

- ✨ ミニマルで洗練されたデザイン
- 🌙 ライト/ダークモード対応
- 📱 レスポンシブデザイン
- 🔍 SEO最適化
- 📝 Markdownベースのブログ投稿
- 🏷️ タグシステム
- 📚 アーカイブ機能
- 🔎 検索機能
- 📡 RSS フィード対応

## カスタマイズ

### サイト設定の変更

`src/config.ts` ファイルで以下の設定をカスタマイズできます：

```typescript
export const SITE = {
  website: "https://noguchy.me/",        // サイトURL
  author: "noguchy",                      // 著者名
  profile: "https://noguchy.me/",        // プロフィールURL
  desc: "個人ブログ",                     // サイト説明
  title: "noguchy.me",                    // サイトタイトル
  ogImage: "astropaper-og.jpg",          // OG画像
  lightAndDarkMode: true,                 // ライト/ダークモード
  postPerIndex: 4,                        // トップページの投稿数
  postPerPage: 4,                         // ページあたりの投稿数
  showArchives: true,                     // アーカイブ表示
  showBackButton: true,                   // 戻るボタン表示
  lang: "ja",                             // 言語
  timezone: "Asia/Tokyo",                 // タイムゾーン
};
```

### ブログ投稿の追加

新しいブログ投稿を追加するには、`src/content/blog/` ディレクトリに Markdown ファイルを作成します。

例：`src/content/blog/my-first-post.md`

```markdown
---
author: noguchy
pubDatetime: 2026-01-03T00:00:00Z
modDatetime: 2026-01-03T00:00:00Z
title: 最初の投稿
slug: my-first-post
featured: false
draft: false
tags:
  - Astro
  - ブログ
description: これは最初のブログ投稿です。
---

ここにブログの内容を書きます。
```

## ファイル構造

```
noguchy-me/
├── src/
│   ├── assets/          # 画像やフォントなどのアセット
│   ├── components/      # Astroコンポーネント
│   ├── content/         # ブログ投稿とコンテンツ
│   ├── layouts/         # レイアウトコンポーネント
│   ├── pages/           # ページコンポーネント
│   ├── styles/          # グローバルスタイル
│   ├── config.ts        # サイト設定
│   └── utils/           # ユーティリティ関数
├── public/              # 静的ファイル
├── astro.config.ts      # Astro設定
├── tsconfig.json        # TypeScript設定
└── tailwind.config.mjs  # Tailwind CSS設定
```

## デプロイ

### GitHub Pages へのデプロイ

1. GitHub リポジトリを作成
2. `.github/workflows/` ディレクトリの CI/CD ワークフロー設定を確認
3. リポジトリにプッシュ
4. GitHub Actions が自動的にビルドしてデプロイします

### その他のホスティングサービス

Astro は以下のサービスへのデプロイに対応しています：
- Vercel
- Netlify
- Cloudflare Pages
- AWS Amplify

詳細は [Astro デプロイメントガイド](https://docs.astro.build/ja/guides/deploy/) を参照してください。

## トラブルシューティング

### ポート 4321 が既に使用されている場合

別のポートで起動します：

```bash
pnpm dev -- --port 3000
```

### キャッシュをクリアしたい場合

```bash
rm -rf dist/ .astro/
pnpm build
```

## 参考リンク

- [Astro 公式ドキュメント](https://docs.astro.build/ja/)
- [AstroPaper GitHub](https://github.com/satnaing/astro-paper)
- [Tailwind CSS ドキュメント](https://tailwindcss.com/docs)

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。
