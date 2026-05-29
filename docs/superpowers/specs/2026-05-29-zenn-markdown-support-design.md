# Zenn記法対応 設計ドキュメント

- 日付: 2026-05-29
- 対象: noguchy.me（Astro + AstroPaper + TailwindCSS）
- 目的: ブログ記事本文をZennのMarkdown記法に対応させる

## 1. 背景・ゴール

Zennの執筆体験に慣れているため、ブログ記事を **Zennと同じMarkdown記法** で書けるようにする。対象は以下の機能群（すべて対応）:

- メッセージ／アコーディオン: `:::message` / `:::message alert` / `:::details`
- KaTeX数式: `$$`（ブロック）/ `$`（インライン）
- mermaid図: ` ```mermaid `
- リンクカード／埋め込み: 裸URLのカード化、`@[card]` / `@[youtube]` / X / GitHub / Gist など
- 画像の幅指定 `![](url =250x)`・キャプション `*caption*`・脚注・テーブルなどZenn標準記法
- コードブロックのファイル名 `js:ファイル名`・diff `diff js`

## 2. 方針（採用アプローチ）

**Zenn公式パッケージを全面採用** する。記事本文の描画を、Astro標準のMarkdownパイプライン（`render(post)` → `<Content />`）から `zenn-markdown-html` に差し替える。これによりZennとほぼ完全一致の記法・見た目を得る。

差し替えは **記事本文の描画部分のみ** に限定する。フロントマター・レイアウト・OGP生成・記事一覧・検索（pagefind）などはAstroのまま変更しない。

### 採用した設計判断

| 論点 | 決定 |
|------|------|
| アプローチ | Zenn公式パッケージ全面採用 |
| mermaid描画 | クライアントサイド（`zenn-embed-elements`） |
| リンクカード | 既知プロバイダ埋め込み + OGPカード（`embed.zenn.studio` 経由） |
| スタイル/ダーク | `zenn-content-css` を採用し、`html[data-theme="dark"]` に同期するダーク用CSSを追加 |

## 3. アーキテクチャ

```
post.body (生Markdown)
  → markdownToHtml(body, { embedOrigin: "https://embed.zenn.studio" })   // ビルド時(SSG)
  → HTML文字列
  → <article class="znc" set:html={html}>                                // PostDetails.astro
  ＋ <script>import "zenn-embed-elements"</script>                        // クライアントで埋め込み/mermaid/katexを描画
  ＋ zenn-content-css + katex CSS（グローバル読み込み）
  ＋ html[data-theme="dark"] .znc { ... } ダーク同期CSS
```

- `zenn-markdown-html` はAstroの `.astro` フロントマター（サーバ側 / ビルド時）で実行する。
- mermaid・各種埋め込み・KaTeX数式は `zenn-embed-elements` が提供するカスタム要素により **クライアントサイド** で描画される（`embed.zenn.studio` を利用）。
- 数式描画には `katex` のCSSが必要なため読み込む。

## 4. コンポーネント / ファイル変更

### 4.1 追加パッケージ
- `zenn-markdown-html` — Markdown → HTML 変換
- `zenn-content-css` — Zenn本文スタイル
- `zenn-embed-elements` — 埋め込み/mermaid/KaTeXのクライアント描画用カスタム要素
- `katex` — 数式用CSS

### 4.2 `src/utils/renderZennMarkdown.ts`（新規）
- 役割: `markdownToHtml` をラップし、`embedOrigin` 等のオプションを集約する単一の入口。
- インターフェース: `renderZennMarkdown(body: string): string`
- 依存: `zenn-markdown-html`

### 4.3 `src/layouts/PostDetails.astro`（変更）
- `const { Content } = await render(post);` を廃止し、`renderZennMarkdown(post.body)` で本文HTMLを生成する。
  - フロントマター由来のメタデータ（`post.data` 経由）は現状どおり利用。`render(post)` から使っているのは `Content` のみなので影響は本文描画に限定。
- 本文要素を `<article id="article" class="znc ...">` に変更し、`set:html` でZenn HTMLを差し込む。
  - 既存の `app-prose`（Tailwind Typography）はZenn本文には適用しない（`.znc` に置換）。`max-w-app mx-auto mt-8` などのレイアウト系クラスは維持。
- `zenn-embed-elements` を読み込むクライアントスクリプトを追加（記事ページでのみ）。
- 既存の見出しアンカー付与スクリプト（`#article` 配下の見出しを走査）は `.znc` 出力でも動くことを確認し、必要ならセレクタを調整。

### 4.4 スタイル（`src/styles/` または `Layout.astro`）
- `zenn-content-css` と `katex/dist/katex.min.css` をグローバルに読み込む。
- `html[data-theme="dark"] .znc { ... }` でZenn本文のダーク配色を定義し、サイトの `data-theme` トグル（`/toggle-theme.js`）に連動させる。
  - 対象: 本文テキスト色・背景・境界線・`:::message`/`:::details`・テーブル・引用・コードブロック（Prismトークン色）など。
  - サイトのアクセントカラー（エレクトリックブルー）と矛盾しない範囲で調整する。

## 5. 既存資産への影響

- **既存2記事**（`how-to-learn-computer-science-2026.md` / `test-article.md`）はプレーンMarkdownのみのため、Zenn描画でもそのまま表示できる（特殊記法・AstroPaper独自記法は未使用）。
- **コードハイライト**: 記事本文はShiki → Zenn(Prism)に変わる（見た目がZenn風に）。Shikiの設定（`astro.config`）はMDXや他用途のため残す。
- **画像最適化**: 記事本文の画像はAstroの最適化が外れ、素の `<img>` になる（Zennと同じ挙動）。
- **既存のNotice/Accordion MDXショートコード**: 記事本文ではZennの `:::` 記法に置き換わるため不要。コンポーネント自体は削除せず残置（他での利用可能性のため）。
- **MDX統合・autoImport**: 記事本文の描画では使われなくなるが、設定は残す。

## 6. リスク・留意点

- 埋め込み（リンクカード/ツイート/GitHub等）は **実行時に `embed.zenn.studio` への外部依存** がある。オフライン・サーバ障害時は埋め込みが表示されない。
- `zenn-markdown-html` のコードハイライト方式・KaTeX/mermaidの描画要素名は、実装時に実際の出力HTMLを確認して最終確定する（カスタム要素名・必要CSSの特定）。
- `zenn-content-css` はダーク配色を内包しない前提。ダーク表示は本設計の独自CSSで担保する。
- ビルドは `astro check && astro build && pagefind` のまま。`set:html` 文字列描画はSSGで完結し、追加のビルド依存（headlessブラウザ等）は不要。

## 7. 検証方法

- `pnpm run lint` / `pnpm run format:check` / `pnpm run build` が通ること。
- Zenn全記法を網羅したテスト記事を作成し、ライト/ダーク両方で描画を目視確認:
  - `:::message` / `:::message alert` / `:::details`（ネスト含む）
  - 数式（ブロック/インライン）
  - mermaid図
  - リンクカード / YouTube / X / GitHub 埋め込み
  - 画像の幅指定・キャプション、脚注、テーブル、コードのファイル名/diff
- 既存2記事が崩れず表示されること。

## 8. スコープ外（YAGNI）

- Zennエディタの入力補完（絵文字補完など）— 執筆ツール側機能のため対象外。
- 一部のニッチ埋め込み（SpeakerDeck/Docswell/blueprintUE 等）は `zenn-markdown-html` が対応していればそのまま動くが、個別検証はスコープ外（標準対応の範囲で提供）。
