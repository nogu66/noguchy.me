# SEO設定ガイド

このドキュメントでは、noguchy.meサイトのSEO設定と今後の運用について説明します。

## 実装済みのSEO最適化

### 1. メタデータ設定

#### 基本メタタグ
- `title`: ページごとに最適化
- `description`: サイト全体の説明（約100文字）
- `author`: noguchy
- `og:type`: ページタイプに応じて自動切替（website/article）
- `og:locale`: ja_JP
- `theme-color`: #fdfdfd

#### SNS連携
- **Open Graph (Facebook/X)**: title, description, url, image, type, locale
- **Twitter Card**: summary_large_image形式
- **Twitter連携**: @_nogu66 が twitter:site と twitter:creator に設定済み

### 2. 構造化データ（JSON-LD）

以下の構造化データが実装されています：

#### WebSiteスキーマ（トップページ）
```json
{
  "@type": "WebSite",
  "name": "noguchy.me",
  "url": "https://noguchy.me/",
  "description": "...",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://noguchy.me/search?q={search_term_string}"
  }
}
```

#### Personスキーマ（Aboutページ）
```json
{
  "@type": "Person",
  "name": "noguchy",
  "url": "https://noguchy.me/",
  "sameAs": [
    "https://github.com/nogu66",
    "https://x.com/_nogu66"
  ]
}
```

#### BlogPostingスキーマ（記事ページ）
```json
{
  "@type": "BlogPosting",
  "headline": "記事タイトル",
  "image": "OG画像URL",
  "datePublished": "...",
  "dateModified": "...",
  "author": {...},
  "mainEntityOfPage": {...},
  "publisher": {...}
}
```

#### BreadcrumbListスキーマ（パンくずリスト）
全てのサブページに自動実装

### 3. サイトマップとRobots.txt

- **サイトマップ**: `/sitemap-index.xml` で自動生成
- **Robots.txt**: `/robots.txt` で自動生成（全クローラー許可）
- **RSS Feed**: `/rss.xml` で自動検出可能

---

## Google Search Console 設定手順

### Step 1: Google Search Console にサイトを登録

1. [Google Search Console](https://search.google.com/search-console) にアクセス
2. 「プロパティを追加」をクリック
3. 「URLプレフィックス」を選択
4. `https://noguchy.me/` を入力

### Step 2: 所有権の確認

#### 方法1: HTMLタグによる確認（推奨）

1. 確認方法で「HTMLタグ」を選択
2. `<meta name="google-site-verification" content="xxx...xxx" />` のコードが表示される
3. `content="xxx...xxx"` の `xxx...xxx` 部分をコピー
4. `.env` ファイルに以下を追加:

```bash
PUBLIC_GOOGLE_SITE_VERIFICATION=xxx...xxx
```

5. ビルド & デプロイ:

```bash
npm run build
# デプロイコマンド（プラットフォームに応じて実行）
```

6. Google Search Console で「確認」ボタンをクリック

#### 方法2: HTMLファイルによる確認

1. 確認用HTMLファイルをダウンロード
2. `public/` ディレクトリに配置
3. デプロイ後、Google Search Console で「確認」ボタンをクリック

### Step 3: サイトマップを送信

1. 左メニューの「サイトマップ」をクリック
2. 「新しいサイトマップの追加」に以下を入力:

```
https://noguchy.me/sitemap-index.xml
```

3. 「送信」をクリック

### Step 4: インデックス登録をリクエスト

1. 左メニューの「URL検査」をクリック
2. `https://noguchy.me/` を入力
3. 「インデックス登録をリクエスト」をクリック

---

## 新しい記事を追加する際のSEOチェックリスト

記事を追加する際は、以下を確認してください：

### 必須項目

- [ ] **title**: 検索キーワードを含む魅力的なタイトル（50-60文字）
- [ ] **description**: 記事の要約（120-150文字）
- [ ] **pubDatetime**: 正確な公開日時
- [ ] **published**: `true` に設定
- [ ] **tags**: 関連するタグを2-5個設定

### 推奨項目

- [ ] **見出し構造**: H2、H3を適切に使用
- [ ] **内部リンク**: 関連記事へのリンクを追加
- [ ] **画像の最適化**: alt属性を設定
- [ ] **外部リンク**: 参考サイトへのリンク（rel="noopener noreferrer"は自動設定）

### 記事のフロントマター例

```markdown
---
title: "Claude Codeで爆速開発する5つのテクニック"
description: "AIペアプログラミングツールClaude Codeを活用した開発効率化のテクニックを5つ紹介します。実践的な使い方からトラブルシューティングまで網羅。"
pubDatetime: 2026-01-15T10:00:00+09:00
published: true
featured: false
tags: ["claude-code", "ai", "開発効率化", "プログラミング"]
timezone: "Asia/Tokyo"
---

# 記事本文

...
```

---

## SEO効果の確認方法

### Google Search Console（定期確認推奨）

1. **検索パフォーマンス**: クリック数、表示回数、CTR、掲載順位
2. **カバレッジ**: インデックス登録済みページ数
3. **エクスペリエンス**: Core Web Vitals のスコア

### 構造化データの検証ツール

- [Google Rich Results Test](https://search.google.com/test/rich-results)
  - サイトのURLを入力してテスト
  - WebSite、Person、BlogPosting、BreadcrumbListスキーマが正しく認識されるか確認

- [Schema.org Validator](https://validator.schema.org/)
  - URLまたはコードを入力してJSON-LD構文をチェック

### SNSシェアの確認

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
  - OGタグが正しく設定されているか確認
  - キャッシュのクリアも可能

- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
  - Twitter Cardの表示プレビュー
  - @_nogu66 が正しく表示されるか確認

---

## トラブルシューティング

### Q: Google検索に表示されない

A: 以下を確認してください：
1. Google Search Console でインデックス登録されているか
2. robots.txt で許可されているか（`/robots.txt` を確認）
3. サイトマップが送信されているか
4. 十分な時間が経過しているか（通常1-4週間）

### Q: 構造化データのエラーが出る

A: Google Rich Results Test でエラー内容を確認し、該当箇所を修正してください。

### Q: OG画像が表示されない

A:
1. `/public/ogp.png` が存在するか確認
2. Facebook/Twitter のキャッシュをクリア
3. 画像サイズが適切か確認（推奨: 1200x630px）

---

## 参考リンク

- [Google Search Console](https://search.google.com/search-console)
- [Google検索セントラル](https://developers.google.com/search/docs)
- [Schema.org](https://schema.org/)
- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards](https://developer.x.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)

---

## 設定ファイルの場所

- **サイト設定**: `src/config.ts`
- **メタデータ**: `src/layouts/Layout.astro`
- **構造化データ**:
  - トップページ: `src/pages/index.astro`
  - Aboutページ: `src/layouts/AboutLayout.astro`
  - パンくずリスト: `src/components/Breadcrumb.astro`
- **サイトマップ**: `astro.config.ts`（自動生成）
- **Robots.txt**: `src/pages/robots.txt.ts`（自動生成）
