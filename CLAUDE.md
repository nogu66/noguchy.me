# CLAUDE.md

このファイルはClaude Codeがこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

Astro + TailwindCSSで構築された個人ポートフォリオサイト（noguchy.me）

## 作業後の必須チェック

コードの変更やファイルの追加・編集を行った後は、コミット前に必ず以下のCI/CDチェックを実行してください:

```bash
# 1. ESLint - コード品質チェック
pnpm run lint

# 2. Prettier - フォーマットチェック
pnpm run format:check

# 3. ビルド確認
pnpm run build
```

### フォーマットエラーの修正

フォーマットチェックでエラーが発生した場合:

```bash
pnpm run format
```

## よく使うコマンド

- `pnpm dev` - 開発サーバー起動
- `pnpm build` - プロダクションビルド
- `pnpm format` - コードフォーマット適用
- `pnpm lint` - ESLintチェック
- `pnpm new-post` - 新規ブログ記事作成

## ディレクトリ構造

- `src/content/` - コンテンツ（ブログ記事、受賞歴など）
- `src/pages/` - ページコンポーネント
- `src/components/` - 再利用可能なコンポーネント
- `src/layouts/` - レイアウトコンポーネント

## ブログ記事の記法（Zenn互換）

ブログ記事は Zenn と同じ Markdown 記法で書けます（独自 remark/rehype プラグインで対応。Zenn公式パッケージは不使用）:

- `:::message` / `:::message alert` / `:::details タイトル`（`::::` でネスト可）
- KaTeX 数式（`$$` ブロック / `$` インライン）
- mermaid 図（` ```mermaid `、クライアント描画）
- 画像の幅指定 `![](url =250x)`・キャプション（画像直後の `*caption*`）
- コードのファイル名 `言語:ファイル名`・diff `diff 言語`
- リンクカード（裸 URL の OGP カード化）・YouTube / X / GitHub / Gist 埋め込み・`@[youtube]` / `@[card]` / `@[tweet]` / `@[github]`

実装: `src/plugins/`（remark/rehype プラグイン群）、Shiki transformer: `src/utils/transformers/zennDiff.js`、登録: `astro.config.ts`。
プラグインの単体テスト: `pnpm run test`。
全記法の確認用記事（非公開）: `src/content/blog/_zenn-syntax-test.md`。
