# Shipathon 2026 AI開発ツールガイド

> Claude Code / Codex でモバイルアプリを爆速開発するためのスキル・MCP・プラグイン集

**Shipathon** = RevenueCat 主催の世界最大級モバイルアプリハッカソン。2ヶ月でアプリを開発 → ストア公開 → RevenueCat SDK でマネタイズ。賞金1,000万円超。

- 期間: 2026年8月1日〜9月30日
- 形式: オンライン
- 公式: [jp.shipaton.com](https://jp.shipaton.com/)

---

## 1. MCP サーバー（バックエンド・ドキュメント）

### 1-1. Context7 — 最新ドキュメントをAIに直接注入

LLMの学習データは古くなりがち。Context7 は最新のライブラリドキュメントとコード例をプロンプトに直接注入し、幻覚（存在しないAPIの生成）を防ぐ。

**Shipathon での使いどころ:** React Native / Flutter / SwiftUI / RevenueCat SDK など、バージョン更新が頻繁なライブラリを使うとき、古いAPI呼び出しによるエラーを未然に防げる。

#### セットアップ

```bash
# ワンコマンドでセットアップ
npx ctx7 setup
```

```json
// または MCP 設定に手動追加
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp"
    }
  }
}
```

#### 提供ツール

| ツール名 | 機能 |
|---------|------|
| `resolve-library-id` | ライブラリ名をContext7互換IDに変換 |
| `query-docs` | ライブラリのドキュメントを検索・取得 |

#### 活用例

```
# Claude Code での使い方（自然言語でOK）
"RevenueCat の Offerings API の最新の使い方を教えて"
→ Context7 が最新ドキュメントを取得してコード生成に反映

"React Native Navigation v7 の設定方法を教えて"
→ v7 固有の breaking changes も反映された回答
```

---

### 1-2. Firebase MCP — バックエンドを自然言語で構築

Firestore・Storage・Authentication の操作をAIエージェントから直接実行。バックエンド構築の手間を大幅に削減。

**Shipathon での使いどころ:** ユーザー認証・データ保存・画像アップロードなど、モバイルアプリに必須のバックエンド機能をコマンド一つで構築。

#### 対応サービス

| サービス | できること |
|---------|----------|
| **Firestore** | ドキュメントCRUD、コレクション一覧、クエリ実行 |
| **Storage** | ファイルアップロード（コンテンツ/URL）、メタデータ取得、一覧 |
| **Authentication** | ユーザー検索（ID/メール）、ユーザー情報取得 |

#### セットアップ

```json
{
  "mcpServers": {
    "firebase": {
      "command": "npx",
      "args": ["@gannonh/firebase-mcp"],
      "env": {
        "SERVICE_ACCOUNT_KEY_PATH": "./service-account.json",
        "FIREBASE_STORAGE_BUCKET": "your-bucket.appspot.com"
      }
    }
  }
}
```

リポジトリ: [gannonh/firebase-mcp](https://github.com/gannonh/firebase-mcp)

---

### 1-3. Supabase MCP — オープンソースBaaSをAIで操作

PostgreSQLベースのBaaSであるSupabaseのDB・認証・Edge Functionsを、AIエージェントから直接操作できる。

**Shipathon での使いどころ:** Firebaseの代替としてオープンソース志向のチームに最適。SQL直接実行やTypeScript型自動生成でDX向上。

#### 主要機能

| カテゴリ | 機能 |
|---------|------|
| **データベース** | テーブル一覧、SQL実行、マイグレーション管理 |
| **開発ツール** | TypeScript型生成、Edge Functions デプロイ |
| **運用** | ログ取得、ブランチング（有料プラン） |

#### セットアップ

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp"
    }
  }
}
```

> **セキュリティ Tips:** 開発用プロジェクトで使用し、`read_only=true` を有効化することを推奨。

---

### 1-4. RevenueCat MCP — 課金実装の強力な味方【必須】

RevenueCat の REST API v2 をAIエージェントから直接操作。サブスクリプション管理、Entitlement確認、顧客情報取得などをコードを書かずに実行・検証できる。

> **Shipathon 必須:** RevenueCat SDK の導入とマネタイズ実装はShipathonの参加要件。このMCPで課金フローの構築・デバッグを加速しよう。

#### 主なユースケース

- Offerings / Entitlements の設定確認
- テストユーザーのサブスクリプション状態チェック
- 課金フローの動作検証
- MRR・チャーンなどの収益メトリクス確認

#### 選択肢

| リポジトリ | 特徴 |
|-----------|------|
| [iamhenry/revenuecat-mcp](https://github.com/iamhenry/revenuecat-mcp) | REST API v2 全対応、IDE統合向け |
| [TrialAndErrorAI/revenuecat-mcp](https://github.com/TrialAndErrorAI/revenuecat-mcp) | 68エンドポイント、Code-mode対応 |

Claude Code のプラグインとして `RevenueCat` プラグインも利用可能（`/plugin` からインストール）。

---

## 2. スキル（開発ワークフロー）

### 2-1. Mobile Development スキル群

Claude Code の公式プラグイン `minimax-skills` に含まれるモバイル開発特化スキル。各フレームワーク固有のベストプラクティス・アーキテクチャパターンを自動適用。

| スキル名 | 対象 | 主な効果 |
|---------|------|---------|
| `ios-application-dev` | SwiftUI / UIKit | iOS アプリ設計・実装ガイダンス |
| `android-native-dev` | Kotlin / Jetpack Compose | Android ネイティブ開発のベストプラクティス |
| `frontend-dev` | React Native / Web | クロスプラットフォームUI開発 |
| `fullstack-dev` | フルスタック | フロント + バックエンド統合開発 |

**Shipathon での使いどころ:** ネイティブ開発（Swift/Kotlin）でもクロスプラットフォーム（React Native/Flutter）でも、フレームワーク固有の「正しい書き方」を AIが自動で適用してくれる。

```bash
# Claude Code のプラグインマーケットプレイスからインストール
claude
/plugin install minimax-skills
```

---

### 2-2. Superpowers — AIエージェントの開発方法論

コーディングエージェント向けの統合的なソフトウェア開発方法論。

- リポジトリ: [github.com/obra/superpowers](https://github.com/obra/superpowers)

**Shipathon での使いどころ:** ハッカソンは時間との戦い。Superpowersの体系的なワークフローで「雑に作って壊れる」を防ぎ、限られた時間で高品質なアプリを仕上げられる。

#### 特に有用なスキル

| スキル | 内容 | ハッカソンでの価値 |
|-------|------|-----------------|
| **brainstorming** | ソクラテス式の設計精密化 | アイデア → 実装計画を高速で固める |
| **writing-plans** | 詳細な実装計画作成 | コード書く前に全体設計を決める |
| **test-driven-development** | RED-GREEN-REFACTOR | 課金フローのようなクリティカルな機能の品質担保 |
| **systematic-debugging** | 4段階の根本原因分析 | 「動かない」→「なぜ動かないか」を体系的に解決 |
| **subagent-driven-development** | 並列エージェント処理 | 複数画面を同時に開発 |
| **verification-before-completion** | 完了前検証 | ストア申請前の最終チェック |

---

### 2-3. Claude Code 公式プラグイン — Shipathon向けピックアップ

| プラグイン | 機能 | ハッカソンでの活用 |
|-----------|------|------------------|
| **feature-dev** | 7フェーズの構造化開発フロー | 機能単位で計画→実装→テストを回す |
| **code-review** | 5つのSonnetエージェントによるPRレビュー | チーム開発時のコード品質維持 |
| **security-guidance** | XSS・インジェクション等の自動検出 | 課金周りのセキュリティ担保 |
| **frontend-design** | UI設計ガイダンス | ストアで映えるUI/UXの構築 |
| **commit-commands** | Git操作の自動化 | `/commit-push-pr` でワンコマンドでPR作成 |
| **agent-sdk-dev** | Agent SDK開発キット | カスタムAIエージェント構築 |

---

## 3. 実戦レシピ（組み合わせパターン）

### 3-1. iOS ネイティブ（SwiftUI）のおすすめ構成

**ツールスタック:** Context7 + ios-application-dev + Firebase MCP + RevenueCat Plugin

**開発フロー:**

1. **brainstorming** — アイデアを固める
2. **writing-plans** — 実装計画を作成
3. **feature-dev** — 機能単位で実装
4. **TDD で課金実装** — RevenueCat SDK 統合
5. **verification** — ストア申請前チェック

```
# Step 1: アイデアを固める
"ペット管理アプリを作りたい。Superpowers の brainstorming で設計を詰めて"

# Step 2: 実装計画
"SwiftUI で実装計画を作って。Context7 で SwiftUI の最新APIを確認して"

# Step 3: バックエンド構築
"Firebase MCP でユーザー認証とペットデータのFirestoreコレクションを作って"

# Step 4: 課金実装
"RevenueCat SDK でプレミアムプラン（月額/年額）のPaywallを実装して"

# Step 5: 最終検証
"verification-before-completion でストア申請前チェックして"
```

---

### 3-2. React Native のおすすめ構成

**ツールスタック:** Context7 + frontend-dev + Supabase MCP + RevenueCat Plugin

**なぜこの組み合わせ？**

- **Context7:** React Native のバージョンアップが激しく、古いAPIでコード生成されるリスクが高い → 最新ドキュメントを常に参照
- **frontend-dev スキル:** React 系のコンポーネント設計・状態管理のベストプラクティスを自動適用
- **Supabase MCP:** PostgreSQL + Edge Functions で柔軟なバックエンド。TypeScript型自動生成が React Native と相性抜群
- **RevenueCat:** iOS/Android 両方の課金をワンコードで管理

---

### 3-3. Flutter のおすすめ構成

**ツールスタック:** Context7 + fullstack-dev + Firebase MCP + RevenueCat Plugin

**なぜこの組み合わせ？**

- **Context7:** Flutter/Dart のAPIは頻繁に変更される → 最新のWidget・パッケージAPIを確実に参照
- **fullstack-dev スキル:** フロント（Flutter）+ バックエンド統合の設計パターンを適用
- **Firebase MCP:** Flutter × Firebase は公式で強力にサポートされている組み合わせ。FlutterFire で統合も簡単
- **RevenueCat:** Flutter SDK で iOS/Android 課金を統一管理

---

## 4. 逆引き — 「やりたいこと」から探すツール

| やりたいこと | 使うツール | 種別 |
|------------|----------|------|
| 最新のライブラリAPIを参照したい | Context7 | MCP |
| ユーザー認証を実装したい | Firebase MCP / Supabase MCP | MCP |
| データベースを構築したい | Firebase MCP（NoSQL） / Supabase MCP（SQL） | MCP |
| 画像・ファイルを保存したい | Firebase MCP（Storage） | MCP |
| 課金・サブスクを実装したい | RevenueCat MCP / Plugin | **必須** |
| iOS の正しい書き方を知りたい | ios-application-dev | Skill |
| Android の正しい書き方を知りたい | android-native-dev | Skill |
| アイデアを構造化したい | Superpowers: brainstorming | Skill |
| 実装計画を作りたい | Superpowers: writing-plans | Skill |
| バグの根本原因を特定したい | Superpowers: systematic-debugging | Skill |
| コードレビューしたい | code-review プラグイン | Plugin |
| セキュリティチェックしたい | security-guidance プラグイン | Plugin |
| ワンコマンドでPR作成したい | commit-commands プラグイン | Plugin |

---

## 5. Shipathon タイムライン別ツール活用

| フェーズ | 期間 | 活用ツール |
|---------|------|----------|
| **企画** | Week 1 | brainstorming → writing-plans |
| **基盤構築** | Week 1-2 | Firebase/Supabase MCP + Context7 + Mobile Dev Skills |
| **機能実装** | Week 2-6 | feature-dev + subagent-driven-development + Context7 |
| **課金実装** | Week 5-6 | RevenueCat MCP/Plugin + TDD |
| **品質管理** | Week 7 | code-review + security-guidance + systematic-debugging |
| **申請準備** | Week 8 | verification-before-completion |

---

## セットアップまとめ

### MCP サーバーの設定場所

```bash
# グローバル設定（全プロジェクト共通）
~/.claude/settings.json

# プロジェクト設定（プロジェクト固有）
.claude/settings.json
```

### 推奨 MCP 設定（一括）

```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp"
    },
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp"
    },
    "firebase": {
      "command": "npx",
      "args": ["@gannonh/firebase-mcp"],
      "env": {
        "SERVICE_ACCOUNT_KEY_PATH": "./service-account.json",
        "FIREBASE_STORAGE_BUCKET": "your-bucket.appspot.com"
      }
    }
  }
}
```

### プラグインのインストール

```bash
claude
/plugin install minimax-skills
/plugin install feature-dev
/plugin install code-review
/plugin install security-guidance
/plugin install commit-commands
```

---

*Shipathon 2026 AI開発ツールガイド — [jp.shipaton.com](https://jp.shipaton.com/)*
