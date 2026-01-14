# Git Worktree セットアップガイド

このプロジェクトでは、複数のブランチで同時に作業するために Git worktree を使用しています。

## Google Analytics の環境分離

テスト環境のデータが Google Analytics に送信されないように、環境ごとに異なる設定ファイルを用意しています。

### 環境変数ファイルの構成

- `.env` - 現在の開発環境用(Git管理外)
- `.env.development` - 開発/テスト環境用のテンプレート(Google Analytics 無効)
- `.env.production` - 本番環境用のテンプレート(Google Analytics 有効)
- `.env.example` - 環境変数の例

## Worktree のセットアップ手順

### 1. 新しい worktree を作成

開発用の worktree を作成する場合:

```bash
# 開発用ブランチで新しいworktreeを作成
git worktree add ../noguchy.me-dev dev-branch-name
```

本番環境(main ブランチ)用の worktree を作成する場合:

```bash
# mainブランチで新しいworktreeを作成
git worktree add ../noguchy.me-production main
```

### 2. 環境変数ファイルをコピー

作成した worktree のディレクトリに移動し、適切な環境変数ファイルをコピーします。

#### 開発/テスト環境の場合

```bash
cd ../noguchy.me-dev
cp .env.development .env
```

この設定では、Google Analytics ID が設定されていないため、トラッキングが無効になります。

#### 本番環境の場合

```bash
cd ../noguchy.me-production
cp .env.production .env
```

この設定では、Google Analytics ID が設定されており、本番環境のトラッキングが有効になります。

### 3. 依存関係をインストール

```bash
pnpm install
```

### 4. 開発サーバーを起動

```bash
pnpm dev
```

## Worktree の確認

現在の worktree 一覧を確認:

```bash
git worktree list
```

## Worktree の削除

不要になった worktree を削除:

```bash
# worktreeのディレクトリを削除
rm -rf ../noguchy.me-dev

# Gitのworktree情報をクリーンアップ
git worktree prune
```

## 注意事項

1. **環境変数ファイルは Git で管理されません**
   - `.env` ファイルは `.gitignore` に含まれているため、各 worktree で個別に設定する必要があります
   - 環境に応じて `.env.development` または `.env.production` をコピーしてください

2. **本番環境へのデプロイ**
   - 本番環境にデプロイする際は、必ず `.env.production` の内容が使用されていることを確認してください
   - CI/CD パイプラインを使用している場合は、環境変数を適切に設定してください

3. **Google Analytics の動作確認**
   - 開発環境: ブラウザの開発者ツールで Google Analytics のスクリプトが読み込まれていないことを確認
   - 本番環境: Google Analytics のリアルタイムレポートで正しくトラッキングされていることを確認

## トラブルシューティング

### Google Analytics が開発環境で有効になっている

`.env` ファイルを確認し、`PUBLIC_GOOGLE_ANALYTICS_ID` がコメントアウトされているか、空白であることを確認してください:

```bash
# PUBLIC_GOOGLE_ANALYTICS_ID=
```

### Worktree 間でコミットが同期されない

worktree は同じリポジトリを共有していますが、異なる作業ディレクトリです。変更をコミットした後、他の worktree で `git fetch` と `git pull` を実行してください。
