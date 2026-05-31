# Zenn記法対応 設計ドキュメント

- 日付: 2026-05-29
- 対象: noguchy.me（Astro + AstroPaper + TailwindCSS）
- 目的: ブログ記事を **Zennと同じMarkdown記法** で書けるようにする（自分のブログの見た目・パイプラインは維持）

## 1. 背景・ゴール

Zennの執筆体験に慣れているため、ブログ記事をZennと同じ記法で書けるようにする。ただし **Zenn公式パッケージ（zenn-markdown-html 等）は使わず**、AstroPaperの既存パイプライン（Astro Markdown / Shiki / 画像最適化 / Tailwind Typography テーマ / ダークモード）をそのまま活かしたまま、機能ごとに remark/rehype プラグインを追加して対応する。

対象機能（すべて対応）:

- メッセージ／アコーディオン: `:::message` / `:::message alert` / `:::details`（ネスト含む）
- KaTeX数式: `$$`（ブロック）/ `$`（インライン）
- mermaid図: ` ```mermaid `
- リンクカード／埋め込み: 裸URLのカード化、`@[card]` / `@[youtube]` / X / GitHub / Gist など
- 画像の幅指定 `![](url =250x)`・キャプション `*caption*`
- コードブロックのファイル名 `js:ファイル名`・diff `diff js`
- 脚注・テーブル・打ち消し線などZenn標準記法（GFMで既に対応済み）

## 2. 方針（採用アプローチ）

**Astroネイティブに統合**する。記事本文の描画は `render(post)` → `<Content />` のまま変更しない。Zenn固有の記法は、Astroの `markdown.remarkPlugins` / `rehypePlugins` に機能別プラグインを追加して解釈する。

スタイルは **既存の `app-prose`（Tailwind Typography）テーマと既存コンポーネントの配色を流用** する。これによりサイトの一貫性とダークモード（`html[data-theme="dark"]`）が自動的に保たれる。

### 採用した設計判断

| 論点 | 決定 |
|------|------|
| アプローチ | Astroネイティブ統合（公式パッケージ不使用） |
| mermaid描画 | クライアントサイド（mermaid.js をブラウザで実行） |
| リンクカード | 既知プロバイダ埋め込み + 任意URLはビルド時OGP取得でカード化 |
| スタイル/ダーク | 既存 `app-prose` テーマ + 既存Notice/Accordion配色を流用（ダークは自動連動） |

## 3. 機能別の実現方法

| 機能 | 実現方法 |
|------|----------|
| `:::message` / `:::message alert` / `:::details` | `remark-directive` でコンテナディレクティブを解析 → カスタムremarkプラグインで、既存 `notice`（info/warning）相当のHTML、`:::details` は native `<details><summary>` に変換。既存CSSの配色を流用 |
| KaTeX数式 `$$`・`$` | `remark-math` + `rehype-katex`、`katex` のCSSを読み込み（ビルド時にHTML化） |
| mermaid ` ```mermaid ` | カスタムrehypeで `<pre class="mermaid">` を出力 → クライアントスクリプトで `mermaid.run()` を実行（描画はブラウザ側） |
| 画像 `=250x`・`*caption*` | カスタムremarkプラグイン。`url` 末尾の ` =\d+x` を幅に変換、画像のみの段落を `<figure>` 化し直後の強調段落を `<figcaption>` に |
| コード `js:ファイル名` | カスタムremarkプラグイン。code node の lang `lang:file` を分割し、`lang` と既存Shikiが解釈する `file="..."` メタに書き換え（既存 fileName transformer を活用） |
| コード `diff js`（行頭 +/- 方式） | Zennは行頭 `+`/`-`/空白 でdiff表現。Shiki標準の `transformerNotationDiff`（コメント方式）とは別物のため、行頭プレフィックスを解釈する **カスタムShiki transformer** を追加 |
| リンクカード（裸URL／`@[card]`） | カスタムremarkプラグイン。既知プロバイダはiframe/script埋め込み、それ以外はビルド時にOGPを取得してカードHTML化。取得失敗時は通常リンクにフォールバック |
| YouTube/X/GitHub/Gist 等の埋め込み | 上記プラグイン内でプロバイダ判定して各社の埋め込み記法を生成 |
| 脚注・テーブル・打ち消し線 | AstroのGFMで対応済み（変更不要） |

## 4. コンポーネント / ファイル変更

### 4.1 追加パッケージ
- `remark-directive` — `:::` コンテナ記法の解析
- `remark-math` + `rehype-katex` + `katex` — 数式
- `mermaid` — クライアント描画
- （リンクカードのOGP取得用に軽量なフェッチ実装を自前で用意、または `remark-link-card` 等の既存プラグインを検討）

### 4.2 `astro.config.mjs`（変更）
- `markdown.remarkPlugins` に: `remark-directive` → `remarkZennDirective`（自作）、`remark-math`、`remarkZennImage`（自作）、`remarkZennCode`（自作・ファイル名/diff前処理）、`remarkZennEmbed`（自作・リンクカード/埋め込み）を追加。
- `markdown.rehypePlugins` に `rehype-katex`、`rehypeZennMermaid`（自作）を追加。
- `shikiConfig.transformers` に Zenn diff 用のカスタム transformer を追加（既存の fileName/highlight/diff transformer は維持）。

### 4.3 `src/plugins/`（新規・自作プラグイン群）
機能ごとに独立した小さなプラグインとして実装し、単体で理解・テストできる単位にする:
- `remark-zenn-directive.ts` — `:::message` / `:::details`
- `remark-zenn-image.ts` — 幅指定・キャプション
- `remark-zenn-code.ts` — `lang:file` を Shiki メタへ前処理
- `remark-zenn-embed.ts` — リンクカード・各種埋め込み
- `rehype-zenn-mermaid.ts` — mermaid コードフェンス → `<pre class="mermaid">`
- `transformers/zennDiff.ts` — 行頭 +/- 方式 diff の Shiki transformer

### 4.4 `src/layouts/PostDetails.astro`（小変更）
- 本文描画（`<Content />`）はそのまま。
- mermaid を描画するクライアントスクリプト（`import mermaid` → `mermaid.run()`、`data-theme` に応じて light/dark テーマ指定）を記事ページに追加。
- 既存の見出しアンカー付与スクリプトは変更不要。

### 4.5 スタイル（`src/styles/`）
- `:::message` / `:::message alert` の配色（既存 `notice` のCSS変数を流用）。
- `:::details`（native `<details>`）の見た目を既存 Accordion 風に。
- `<figure>`/`<figcaption>`（画像キャプション）、リンクカード、mermaid コンテナのスタイル。
- `katex/dist/katex.min.css` の読み込み。
- すべて既存テーマのカラートークンを用い、ダークは `html[data-theme="dark"]` に自動連動。

## 5. 既存資産への影響

- **既存2記事**（`how-to-learn-computer-science-2026.md` / `test-article.md`）はプレーンMarkdownのみのため影響なし。
- **コードハイライト**: Shiki のまま（変更なし）。Zenn記法 `lang:file`・`diff js` は前処理/transformer で既存Shikiに乗せる。
- **画像最適化**: Astroの最適化は維持。幅/キャプションは追加処理として上乗せ。
- **既存 Notice/Accordion コンポーネント**: 残置（MDXからの直接利用も引き続き可能）。`:::` 記法は静的HTML/`<details>` に変換するため、これらと併存可能。
- **ダークモード**: 既存テーマに従うため自動連動。

## 6. リスク・留意点

- 埋め込み（リンクカード/ツイート/GitHub等）は実行時に各プロバイダ（X/YouTube/GitHub等）へ外部依存する。OGPカードはビルド時取得のため、取得失敗時は通常リンクにフォールバックする。
- `diff js`（行頭 +/- 方式）の Shiki transformer は自作のため、複雑なdiff表現での見た目は実装時に調整が必要。
- `remark-directive` のネスト（`::::details` で `:::message` を内包）に対応するため、フェンス長（コロン数）の扱いを実装で確認する。
- mermaid はクライアントJSが増える（図のあるページのみ実行）。`data-theme` 変更時の再描画は必要なら対応。

## 7. 検証方法

- `pnpm run lint` / `pnpm run format:check` / `pnpm run build` が通ること。
- Zenn全記法を網羅したテスト記事を作成し、ライト/ダーク両方で目視確認:
  - `:::message` / `:::message alert` / `:::details`（ネスト含む）
  - 数式（ブロック/インライン）、mermaid図
  - リンクカード / YouTube / X / GitHub 埋め込み
  - 画像の幅指定・キャプション、脚注、テーブル、コードのファイル名/diff
- 既存2記事が崩れず表示されること。

## 8. スコープ外（YAGNI）

- Zennエディタの入力補完（絵文字補完など）— 執筆ツール側機能のため対象外。
- 一部のニッチ埋め込み（SpeakerDeck/Docswell/blueprintUE/JSFiddle/CodeSandbox 等）は、需要が出たら個別追加。初期スコープは X / YouTube / GitHub / Gist / 汎用OGPカード とする。
