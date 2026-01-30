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
