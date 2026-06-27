# RevenueCat AI Toolkit

技術者向け完全解説 — アーキテクチャ・MCP Tools・スキル・Swift実装パターン

本ドキュメントは、AI コーディングエージェントから課金まわりを操作する2つのツール群を扱います。

- **RevenueCat AI Toolkit** — 課金バックエンド（RevenueCat）側を操作
- **asc CLI** — App Store Connect 側を操作
- **連携シナジー** — 組み合わせで何が変わるか

---

# RevenueCat AI Toolkit

## 概要

### 何をするプラグインか

アプリ内課金バックエンド「RevenueCat」をAIコーディングエージェントから直接操作するためのプラグインマーケットプレイス。ダッシュボードを開かずにプロジェクト作成・商品設定・KPI分析・A/Bテスト結果取得まで完結する。

### 構成

| プラグイン | 内容 |
| --- | --- |
| **Plugin 1: RevenueCat** | メインプラグイン。MCPサーバー + 14スキル。iOS / Android / Flutter / React Native / KMP をカバー。 |
| **Plugin 2: play-billing** | Android特化。Google Play Billingライフサイクルに関する19スキル。MCP無し（スキルのみ）。 |

### 対応IDE

`Claude Code` / `Cursor` / `OpenAI Codex` / `VS Code` / `Gemini CLI`

各IDE用のアダプター（`.claude-plugin/` `.codex-plugin/` `.cursor-plugin/` `gemini-extension.json`）を同一リポジトリ内に配置し、同じスキルとMCPを共有する設計。

### 認証

ブラウザベースOAuth。RevenueCatアカウントの権限に基づくアクセス制御。APIキーの手動設定は不要。

### 📖 もっと簡単に理解するには（DeepWiki）

ai-toolkit のリポジトリ構造・スキル・MCP の関係をより手軽に把握したい場合は、AI生成のドキュメントサイト **DeepWiki** を使うと理解が早い。リポジトリ全体を自然言語で要約・図解し、コードを直接読まなくても全体像をつかめる。

- リポジトリの構造図とコンポーネント間の関係を自動生成
- 「このスキルは何をするか」をチャット形式で質問できる
- 本ページの内容と併読すると、概要 → 詳細の流れで把握しやすい

🔗 [deepwiki.com/RevenueCat/ai-toolkit](https://deepwiki.com/RevenueCat/ai-toolkit)

---

## アーキテクチャ

### 全体アーキテクチャ

```
IDE / Agent（Claude Code, Cursor, etc.）
        ↓ プラグインマーケットプレイス
┌─────────────────────────┬─────────────────────────┐
│ Skills (Markdown)        │ MCP Client               │
│ AIへのドメイン知識注入     │ IDE内蔵のMCPクライアント   │
│ 手順書・コードテンプレート  │ ツール呼び出し            │
└─────────────────────────┴─────────────────────────┘
        ↓ HTTP (OAuth)
mcp.revenuecat.ai/mcp
リモートHTTP MCPサーバー / RevenueCat API ラッパー
        ↓ REST API
RevenueCat Backend
プロジェクト・商品・分析データ
```

> **技術的特徴:** MCPサーバーをSaaS（リモートHTTP）として提供。ローカルnpxプロセスではなくクラウドホスト型。認証はOAuthで完結し、ユーザーがAPIキーを手動設定する必要がない。

### スキルの役割

スキル = 「MCPツールをどの順番で・どう使うか」をAIに教えるMarkdownベースの手順書。YAML frontmatter（name, description）+ ステップバイステップの指示で構成される。

- **プラットフォーム自動検出:** プロジェクトのファイル構成（Package.swift, pubspec.yaml等）からiOS/Android/Flutter/RN/KMPを判定
- **プラットフォーム別サブファイル:** 各スキルが `platforms/ios.md` 等を持ち、検出結果に応じたコードを提供
- **ドメイン知識の埋め込み:** 「サブスクの4つの力」等のビジネスロジックをAIに注入
- **検証ステップ:** 各スキルに「完了と言ってよい条件」が明示されている

### リポジトリ構造

```
RevenueCat/ai-toolkit/
├── .claude-plugin/marketplace.json  # Claude Code用マーケットプレイス定義
├── .codex-plugin/                   # OpenAI Codex用
├── .cursor-plugin/                  # Cursor用
├── revenuecat/                      # Plugin 1: メインプラグイン
│   ├── .mcp.json                    # MCPサーバー接続設定
│   ├── .claude-plugin/plugin.json   # プラグインマニフェスト
│   └── skills/
│       ├── create-revenuecat-project/
│       │   └── SKILL.md
│       ├── integrate-revenuecat/
│       │   ├── SKILL.md
│       │   └── platforms/
│       │       ├── ios.md           # Swift実装
│       │       ├── android.md
│       │       ├── flutter.md
│       │       ├── kmp.md
│       │       └── react-native.md
│       ├── revenuecat-charts/
│       ├── revenuecat-experiment-analysis/
│       └── ... (14スキル)
└── revenuecat-play-billing/         # Plugin 2: Android特化
    └── skills/ (19スキル)
```

---

## MCP Tools

### MCP Server

`https://mcp.revenuecat.ai/mcp` — リモートHTTP MCP。OAuth認証。

| カテゴリ | ツール名 | 説明 |
| --- | --- | --- |
| プロジェクト | `list-projects` | アクセス可能なプロジェクト一覧 |
| プロジェクト | `create-project` | 新規プロジェクト作成 |
| プロジェクト | `list-public-api-keys` | 公開SDKキー取得（appl_ / goog_） |
| アプリ | `create-app` | App Store / Play Store アプリ登録 |
| アプリ | `list-app-public-api-keys` | アプリ別APIキー取得 |
| 商品設計 | `create-product` | サブスク/一括購入商品の作成 |
| 商品設計 | `create-entitlement` | エンタイトルメント（アクセス権）作成 |
| 商品設計 | `attach-products-to-entitlement` | 商品→エンタイトルメント紐付け |
| オファリング | `create-offering` | オファリング（商品グループ）作成 |
| オファリング | `create-package` | パッケージ（monthly等）作成 |
| オファリング | `attach-products-to-package` | 商品→パッケージ紐付け |
| 分析 | `get-chart-options-schema` | チャートの利用可能フィルタ/セグメント取得 |
| 分析 | `get-chart-data` | KPIデータ取得（MRR, 解約率等） |
| 実験 | `list-experiments` | A/Bテスト一覧 |
| 実験 | `get-experiment` | 実験詳細（バリアント、ペイウォール） |
| 実験 | `get-experiment-results` | 実験結果データ |
| ペイウォール | `render-paywall-screenshot` | ペイウォールのプレビュー画像生成 |
| ストア | `get-product-store-state` | ストア側の商品状態確認 |

> **ポイント:** MCPツールはRevenueCatダッシュボードの操作をそのままAPI化したもの。商品→エンタイトルメント→パッケージ→オファリングの依存関係があり、スキルがこの順序制御を担う。

---

## スキル一覧

### RevenueCat Plugin（14スキル）

| スキル | 概要 | 詳細 |
| --- | --- | --- |
| `create-project` | プロジェクト新規作成 | Discovery（プラットフォーム・ビジネスモデルのヒアリング）→ Create Resources（MCP呼び出しの正しい依存順序でリソース作成）→ Summary（APIキー表示）の3フェーズ。 |
| `integrate` | SDK統合ガイド | ダッシュボード側（プロジェクト/アプリ/APIキー）とアプリ側（SDKインストール + configure()）の両方をカバー。プラットフォーム自動検出。 |
| `charts` | KPI分析・収益データ | Acquisition, Conversion, Retention, Reactivationの「4つの力」フレームワーク。ダッシュボードURLの直接生成にも対応。 |
| `experiment` | A/Bテスト分析 | 5ステップ: 実験ID取得 → 詳細取得（バリアント・ペイウォール）→ チャートデータで文脈補足 → 結果取得 → 解釈。 |
| `paywall` | ペイウォール設定 | ダッシュボードで設定したペイウォールの表示実装。RevenueCatUIフレームワークの利用。 |
| `purchase-flow` | 課金フロー実装 | getOfferings → purchase(package) → restorePurchases の一連のフロー。キャンセルハンドリング、二重課金防止。 |
| `entitlements-gate` | 機能ゲーティング | entitlements.activeでの権限チェック。customerInfoStreamによるリアクティブ監視。 |
| `identify-user` | ユーザー識別 | logIn / logOut のアプリ認証連携。Anonymous → Identified の移行。 |
| `customer-center` | カスタマーセンター | サブスク管理UI。キャンセル・プラン変更のセルフサービス。 |
| `status` | プロジェクト状態確認 | プロジェクトの設定状態をサマリー表示。アプリ数、商品数、エンタイトルメント数等。 |
| `testing-setup` | テスト環境構築 | サンドボックス/StoreKit Configuration Fileの設定。テスト用アカウント管理。 |
| `troubleshoot` | トラブルシューティング | オファリング・商品・エンタイトルメントの問題診断。ストア接続エラーの解決。 |
| `migrate` | 移行ガイド | 既存の課金実装からRevenueCatへの移行手順。 |
| `revenuecat (汎用)` | キャッチオール | 他のスキルにマッチしない一般的なRevenueCat関連の質問に対応。 |

### Play Billing Plugin（19スキル）

| スキル | 概要 |
| --- | --- |
| `purchase-flow` | 購入フロー |
| `plan-changes` | プラン変更 |
| `price-changes` | 価格変更 |
| `payment-recovery` | 支払い回復 |
| `cancellations-pauses-winback` | キャンセル・一時停止・ウィンバック |
| `subscription-states` | サブスク状態管理 |
| `subscriptions` | サブスク基礎 |
| `one-time-products` | 一括購入商品 |
| `catalog-management` | 商品カタログ管理 |
| `webhooks` | Webhook連携 |
| `security` | セキュリティ |
| `error-handling` | エラーハンドリング |
| `testing` | テスト手法 |
| `setup` | セットアップ |
| `configuring-the-sdk` | SDK設定詳細 |
| `backend` | バックエンド連携 |
| `alternative-billing` | 代替課金フロー |
| `revenuecat-vs-raw-billing` | RC vs 生Play Billing比較 |
| `understanding-revenuecat` | コンセプト概要 |

---

## Swift実装

### Swift実装ベストプラクティス（スキルに含まれる内容）

#### 1. SDK統合（integrate-revenuecat）

SPM / CocoaPods 両対応。SwiftUI App / UIKit AppDelegate 双方のエントリポイントをカバー。

```swift
// SwiftUI App — init()で1回だけconfigure
import RevenueCat

@main struct MyApp: App {
    init() {
        Purchases.logLevel = .debug // リリース時は削除
        Purchases.configure(withAPIKey: "appl_YOUR_KEY")
    }
    var body: some Scene {
        WindowGroup { ContentView() }
    }
}
```

- `configure()` はアプリ起動時に1回だけ呼ぶ
- 公開SDKキー（`appl_`）のみ使用。シークレットキーはクライアントに入れない
- APIキーは `.xcconfig` でソース管理外に

#### 2. 課金フロー（purchase-flow）

```swift
enum PurchaseOutcome {
    case purchased, cancelled, failed(Error)
}

func buy(_ package: Package) async -> PurchaseOutcome {
    do {
        let result = try await Purchases.shared.purchase(package: package)
        if result.userCancelled { return .cancelled }
        return .purchased // ここでコンテンツ解放しない
    } catch {
        let ns = error as NSError
        if ns.code == ErrorCode.purchaseCancelledError.rawValue {
            return .cancelled
        }
        return .failed(error)
    }
}
```

- **キャンセル = エラーではない。** アラートを出さず静かに戻す
- **購入コールバック内でコンテンツ解放しない。** entitlementsリスナーに一元化
- **購入中はボタンを `.disabled`** にして二重課金防止
- **Restore ボタンは必須**（App Store審査要件）

#### 3. Entitlementゲート（entitlements-gate）

```swift
// AsyncStreamで購読状態をリアクティブ監視
@MainActor final class EntitlementsModel: ObservableObject {
    @Published var hasPremium = false

    func observe() async {
        for await info in Purchases.shared.customerInfoStream {
            hasPremium = info.entitlements["premium"]?.isActive == true
        }
    }
}

struct RootView: View {
    @StateObject private var model = EntitlementsModel()
    var body: some View {
        Group {
            if model.hasPremium { PremiumView() }
            else { PaywallView() }
        }
        .task { await model.observe() }
    }
}
```

- `customerInfoStream`（AsyncStream）で購入・復元・期限切れを自動検知
- `.task` modifier で開始・キャンセルを自動管理
- **`.active` のみチェック。** `.all` には期限切れも含まれる
- product IDではなくentitlement ID（`"premium"`等）でゲート

#### 4. カバーされていないこと

- Swift全般のアーキテクチャ（MVVM, TCA, DI等）
- StoreKit 2 ネイティブAPIの直接利用パターン
- UIデザイン / カスタムペイウォールのUI実装
- サーバーサイド検証（webhook受信側の実装）

RevenueCatがStoreKit 2をラップしているため、開発者はStoreKitの複雑さをほぼ意識せずに済む設計。

---

## Play Billing

### revenuecat-play-billing プラグイン

Google Play Billing Library に特化した19スキルのコレクション。MCPサーバーは持たず、メインプラグインのMCPを併用する前提。ソースは `RevenueCat/play-billing-skills` から同期。ライセンスは Apache-2.0。

> **なぜ分離されているか:** Google Play Billingのライフサイクル（プラン変更、価格変更、支払い回復、キャンセル/一時停止/ウィンバック）は非常に複雑で、iOS側にはない概念が多い。必要な開発者だけがインストールする設計。

（スキル一覧は「スキル一覧 > Play Billing Plugin（19スキル）」を参照）

---

# asc CLI

## 概要

### asc CLI — App Store Connect をターミナルから操作

**asc**（App Store Connect CLI）は、App Store Connect API をスクリプタブルに操作する Go 製の CLI ツール。Xcode や ASC ダッシュボードを開かずに、ビルドのアップロード・TestFlight 配布・審査提出・メタデータ更新・App内課金設定まで完結する。JSON-first・対話プロンプトなしの設計で、CI/CD や AI エージェントとの統合に最適化されている。

🔗 [asccli.sh](https://asccli.sh/) ／ [github.com/rorkai/App-Store-Connect-CLI](https://github.com/rorkai/App-Store-Connect-CLI)

### 構成

| 区分 | 内容 |
| --- | --- |
| **Core: asc CLI 本体** | Go 製の CLI バイナリ。App Store Connect API の全機能をカバー。Homebrew / install script / WinGet でインストール。 |
| **Skills: Agent Skills（22スキル）** | AI エージェント向けのスキル集。ビルド・TestFlight・メタデータ・審査提出・署名のワークフローを自動化。 |

### 設計思想

- **JSON-first:** パイプ/CI 環境では自動的に JSON 出力。TTY では table 表示。`--output json|table|markdown` で明示的に切替可
- **対話プロンプトなし:** すべての入力はフラグで指定。AI エージェントやスクリプトから安全に呼び出せる
- **Dry-run サポート:** `--dry-run` で破壊的操作をプレビュー。エージェントが実行前に確認できる
- **複数アカウント:** 名前付きプロファイルで複数の ASC アカウントを切り替え

### 対応プラットフォーム

`iOS` / `macOS` / `tvOS` / `visionOS`

App Store Connect API がサポートする全 Apple プラットフォームに対応。

### インストール

```bash
# Homebrew（推奨）
brew install asc

# Install script（macOS / Linux）
curl -fsSL https://asccli.sh/install | bash

# WinGet（Windows）
winget install asc
```

### 認証

```bash
# キーチェーン連携（ローカル開発向け）
asc auth login \
  --name "MyApp" \
  --key-id "ABC123" \
  --issuer-id "DEF456" \
  --private-key /path/to/AuthKey.p8 \
  --network

# CI/ヘッドレス環境（キーチェーンバイパス）
asc auth login \
  --bypass-keychain \
  --name "MyCIKey" \
  --key-id "ABC123" \
  --issuer-id "DEF456" \
  --private-key /path/to/AuthKey.p8
```

App Store Connect API キー（.p8）を [appstoreconnect.apple.com](https://appstoreconnect.apple.com/access/integrations/api) で発行して登録。`asc auth doctor` でトラブルシュート。

> **位置づけ:** RevenueCat AI Toolkit が **課金バックエンド（RevenueCat）側** を担うのに対し、asc CLI は **App Store Connect（ストア）側** を担う。両者は補完関係にあり、AI エージェントから扱える点も共通する。

---

## アーキテクチャ

### 全体アーキテクチャ

```
開発者 / AI エージェント（CLI 直接実行 or Agent Skills 経由）
        ↓ コマンド実行
┌─────────────────────────┬─────────────────────────┐
│ asc CLI（Go バイナリ）     │ Agent Skills（22 スキル）  │
│ JSON-first・対話プロンプトなし│ Markdown ベースの手順書     │
│ Dry-run サポート          │ ワークフロー自動化          │
└─────────────────────────┴─────────────────────────┘
        ↓ REST API（JWT 認証）
┌─────────────────────────┬─────────────────────────┐
│ App Store Connect API    │ Apple Ads API            │
│ アプリ・ビルド・TestFlight │ キャンペーン・レポート       │
│ メタデータ・IAP・審査       │ （別 OAuth 認証）          │
└─────────────────────────┴─────────────────────────┘
        ↓ 管理対象
App Store（公開・審査） / TestFlight（ベータ配布） / Xcode Cloud（クラウドビルド）
```

> **技術的特徴:** Go 製のシングルバイナリ。API キー（.p8）による JWT 認証を内蔵し、キーチェーン連携 or 環境変数ベースのヘッドレス認証をサポート。TTY 判定による自動出力フォーマット切替（table / json）で、人間と機械の両方に対応。

### Agent Skills の役割

Agent Skills = 「asc コマンドをどの順番で・どう組み合わせるか」を AI エージェントに教える Markdown ベースの手順書。RevenueCat AI Toolkit のスキルと同じ思想。

- **SKILL.md:** エージェントへの指示（手順・判断基準・検証ステップ）
- **scripts/:** 補助スクリプト（オプション）
- **references/:** 参照ドキュメント（オプション）

### スキルのインストール

```bash
# asc CLI から直接インストール
asc install-skills

# npx 経由で特定エージェント向けにインストール
npx skills add rorkai/app-store-connect-cli-skills --global --agent codex
```

グローバルインストールすると全プロジェクトでスキルが利用可能になる。

### リポジトリ構造

```
rorkai/App-Store-Connect-CLI/
├── cmd/                     # CLIエントリポイント
├── commands/                # コマンド実装
├── internal/                # 内部ライブラリ
├── docs/
│   ├── CI_CD.md             # CI/CD 統合ガイド
│   └── WORKFLOWS.md         # ワークフロー定義
├── guides/                  # 各種ガイド
└── .asc/
    ├── config.json           # ローカル認証設定
    ├── deployment.json       # ビルド番号注入マニフェスト
    └── workflow.json         # ワークフロー定義

rorkai/app-store-connect-cli-skills/
└── skills/
    ├── asc-cli-usage/
    │   └── SKILL.md
    ├── asc-testflight-orchestration/
    │   └── SKILL.md
    ├── asc-release-flow/
    │   └── SKILL.md
    └── ... (22スキル)
```

---

## コマンド一覧

### コマンド体系

`asc <domain> <action> [flags]` — ドメインごとにサブコマンドが整理されている。すべてのコマンドが `--output json|table|markdown` をサポート。

| カテゴリ | コマンド | 説明 |
| --- | --- | --- |
| 認証 | `auth login` | API キー登録（キーチェーン / バイパス / ローカル） |
| 認証 | `auth status` | アクティブプロファイルの検証 |
| 認証 | `auth doctor` | 認証トラブルシュート |
| アプリ | `apps list` | アプリ一覧取得 |
| アプリ | `apps info view` | アプリ詳細表示 |
| ビルド | `builds upload` | .ipa / .pkg アップロード |
| ビルド | `builds list` | ビルド一覧 |
| ビルド | `builds add-groups` | TestFlight グループへの追加 |
| ビルド | `builds next-build-number` | 次のビルド番号を算出 |
| TestFlight | `testflight groups list` | 配布グループ一覧 |
| TestFlight | `testflight feedback list` | テスターフィードバック取得 |
| TestFlight | `testflight crashes list/log` | クラッシュレポート・ログ |
| 審査・リリース | `publish appstore` | App Store 提出（ビルド→提出の一括操作） |
| 審査・リリース | `release stage` | リリース計画プレビュー（dry-run 可） |
| 審査・リリース | `validate` | 提出前チェック |
| 審査・リリース | `submit status / cancel` | 審査状況確認・取り下げ |
| レビュー | `review status` | 審査状態トラッキング |
| レビュー | `review doctor` | 審査ブロッカー診断 |
| メタデータ | `metadata init` | メタデータテンプレート生成 |
| メタデータ | `metadata apply` | ローカライズメタデータ適用 |
| メタデータ | `metadata sync` | 双方向メタデータ同期 |
| メタデータ | `metadata keywords audit` | ASO キーワード監査 |
| メディア | `screenshots plan` | キャプチャ要件レイアウト |
| メディア | `screenshots apply / upload` | フレーム付きスクリーンショットのアップロード |
| メディア | `video-previews list` | プレビュー動画一覧 |
| 署名 | `certificates list` | コード署名証明書一覧 |
| 署名 | `profiles list` | プロビジョニングプロファイル一覧 |
| 署名 | `bundle-ids list` | Bundle ID 一覧 |
| Xcode | `xcode inject` | バージョン/ビルド番号をプロジェクトに注入 |
| Xcode | `xcode archive` | .ipa / .pkg アーカイブ作成 |
| Xcode | `xcode export` | 署名済みバイナリのエクスポート |
| Xcode Cloud | `xcode-cloud run` | クラウドビルドワークフロー実行 |
| Xcode Cloud | `xcode-cloud build-runs get` | ビルドラン詳細取得 |
| Apple Ads | `ads auth login / discover` | Search Ads 認証・組織探索 |
| Apple Ads | `ads campaigns` | 広告キャンペーン一覧 |
| Apple Ads | `ads reports campaigns` | パフォーマンスレポート |
| StoreKit | `storekit auth login / doctor` | IAP 認証設定・診断 |
| StoreKit | `storekit retention-messaging` | リテンションメッセージ管理 |
| ワークフロー | `workflow validate` | ワークフロー定義の検証 |
| ワークフロー | `workflow run` | 定義済みワークフロー実行（dry-run 可） |

> **ポイント:** RevenueCat AI Toolkit の MCP Tools が「課金バックエンドの CRUD」を提供するのに対し、asc CLI のコマンドは「ストア側のリリースライフサイクル全体」をカバー。認証→ビルド→TestFlight→メタデータ→審査→リリースの一連のフローを1つの CLI で完結できる。

---

## スキル一覧（asc Agent Skills 22スキル）

[rorkai/app-store-connect-cli-skills](https://github.com/rorkai/app-store-connect-cli-skills) — `asc install-skills` でインストール。

| スキル | 概要 | 詳細 |
| --- | --- | --- |
| `cli-usage` | コマンド実行ガイド | asc コマンドの正しい動詞・フラグ・ページネーション・認証パターンを AI エージェントに提供。JSON 出力の取り扱い方も含む。 |
| `testflight-orchestration` | TestFlight 配布管理 | ベータグループ管理・テスター追加・ビルド配布・テストノート設定を自動化。 |
| `release-flow` | App Store 提出フロー | asc validate と asc release stage を使い、API で修正可能なブロッカーと手動対応が必要なブロッカーを分離。提出レディネス評価。 |
| `xcode-build` | Xcode ビルド管理 | Xcode アーカイブ・ExportOptions.plist 設定・IPA/PKG エクスポート・ビルド番号管理を自動化。 |
| `signing-setup` | 署名・プロビジョニング | Bundle ID・Capability・証明書・プロビジョニングプロファイルの管理。暗号化署名の同期。 |
| `metadata-sync` | メタデータ同期 | App Store メタデータとローカライゼーションの双方向同期。文字数制限バリデーション付き。 |
| `localize-metadata` | メタデータ翻訳 | LLM 駆動のプロンプトで App Store メタデータを複数ロケールに翻訳。文字数制限を自動適用。 |
| `aso-audit` | ASO キーワード監査 | メタデータのオフライン ASO 監査。キーワードギャップ分析で改善点を検出。 |
| `whats-new-writer` | リリースノート生成 | git ログや箇条書きから、ローカライズ済みの App Store リリースノート（「最新情報」）を自動生成。 |
| `shots-pipeline` | スクリーンショット自動化 | エージェント駆動のシミュレーター操作 → AXe ベースの UI 操作 → フレーミング → アップロード準備のパイプライン。 |
| `submission-health` | 提出前ヘルスチェック | プリフライトチェック・デジタル商品バリデーション・審査提出のモニタリング。 |
| `build-lifecycle` | ビルドライフサイクル | ビルド処理状態の追跡・最新ビルド解決・保持ポリシーに基づくクリーンアップ。 |
| `id-resolver` | ID 解決 | App ID・Build ID・Version ID・Group ID・Tester ID を自動化コンテキストで解決。 |
| `crash-triage` | クラッシュトリアージ | TestFlight クラッシュとベータフィードバックの分析。シグネチャとビルド別にグルーピング。 |
| `apple-ads` | Apple Ads 管理 | Apple Ads の認証・組織探索・キャンペーン管理・レポート取得。ライブアカウント変更前のセーフテストワークフロー。 |
| `workflow` | ワークフロー自動化 | .asc/workflow.json によるリポジトリローカルの自動化グラフ。マルチステップ・条件分岐・フック・バリデーション対応。 |
| `app-create-ui` | アプリ作成（ブラウザ自動化） | API では不可能な App Store Connect のアプリレコード作成をブラウザ自動化で実行。 |
| `ppp-pricing` | 地域別価格設定（PPP） | 購買力平価（PPP）に基づく地域別価格戦略の実装。テリトリ固有の価格設定。 |
| `subscription-localization` | サブスク表示名翻訳 | サブスクリプション/IAP の表示名を複数ロケールに一括翻訳。 |
| `revenuecat-catalog-sync` | RevenueCat カタログ同期 | ASC のサブスク/IAP と RevenueCat の Products・Offerings を照合し、差分を解消する橋渡しスキル。 |
| `notarization` | macOS 公証 | Developer ID 署名による macOS アプリの公証。App Store 外配布向け。 |
| `wall-submit` | Wall of Apps 登録 | asc CLI の Wall of Apps レジストリにアプリを登録。 |

---

## CI/CD

### 出力フォーマットの自動切替

TTY（対話ターミナル）では `table`、パイプ/CI 環境では `json` を自動選択。AI エージェントやスクリプトが常に構造化データを受け取れる。

```bash
# 対話環境（人間向け）
$ asc apps list
# → テーブル表示

# パイプ / CI 環境（機械向け）
$ asc apps list | jq '.[] | .id'
# → JSON 自動出力

# 明示的に切替
$ asc apps list --output markdown
```

### 環境変数

- `ASC_BYPASS_KEYCHAIN=1` — キーチェーン無効化（ヘッドレス CI）
- `ASC_DEFAULT_OUTPUT` — デフォルト出力フォーマット
- `ASC_TELEMETRY_DISABLED=1` / `DO_NOT_TRACK=1` — テレメトリ無効化
- `ASC_DEBUG=api` — API デバッグ出力

### ワークフロー定義

`.asc/workflow.json` でマルチステップの自動化グラフを定義。条件分岐・フック・バリデーションに対応。

```bash
# ワークフロー検証
asc workflow validate

# ドライラン（実際には実行しない）
asc workflow run --dry-run my-release-flow

# 実行
asc workflow run my-release-flow
```

### ビルド番号注入

```bash
# deployment.json マニフェストからバージョン/ビルド番号を注入
asc xcode inject --manifest .asc/deployment.json
```

CI パイプラインでビルド番号を自動インクリメントし、Xcode プロジェクトに反映するパターン。

### 対応 CI サービス

`GitHub Actions` / `GitLab CI` / `Bitrise` / `CircleCI`

`docs/CI_CD.md` に各サービスの統合パターンが記載。`--bypass-keychain` + `--local` で `.asc/config.json` にリポジトリスコープの認証情報を格納。

### Xcode → TestFlight ワークフロー例

```bash
# 1. ビルド番号算出
BUILD=$(asc builds next-build-number --app "123456789")

# 2. バージョン注入
asc xcode inject --manifest .asc/deployment.json

# 3. アーカイブ & エクスポート
asc xcode archive --scheme "MyApp"
asc xcode export --method "app-store"

# 4. アップロード
asc builds upload --app "123456789" --ipa "./build/MyApp.ipa"

# 5. TestFlight 配布
asc builds add-groups --app "123456789" --groups "Internal Testers"
```

> **エージェント連携のポイント:** JSON-first 設計により、AI エージェントは asc コマンドの出力をそのまま解析できる。`--dry-run` で破壊的操作をプレビューし、安全にオーケストレーションを構築可能。

---

## ai-toolkit 連携

### ai-toolkit との組み合わせ

RevenueCat AI Toolkit（MCP）は **RevenueCat 側** の設定を担うが、その手前にある **App Store Connect 側** のアプリ登録・IAP/サブスク作成は本来手作業が必要。ここを **asc CLI** が埋めることで、AI エージェントが両側をまたいで一気通貫にセットアップでき、導入のハードルが大きく下がる。

```
AI エージェント（Claude Code / Codex / Cursor 等）
        ↓ 2系統を駆動
┌─────────────────────────────┬─────────────────────────────┐
│ asc CLI + Agent Skills        │ ai-toolkit (MCP + Skills)     │
│ App Store Connect             │ RevenueCat                    │
│ アプリ登録・IAP/サブスク作成     │ 商品・エンタイトルメント設定      │
│ ビルド・TestFlight・審査        │ KPI 分析・A/B テスト           │
└─────────────────────────────┴─────────────────────────────┘
        ↓ 連携
App Store Connect（ストア側）  ／  RevenueCat Backend（課金バックエンド）
```

### カタログ同期スキル

`asc-revenuecat-catalog-sync` スキルは、App Store Connect のサブスク/IAP と RevenueCat の Products・Offerings を照合し、差分を解消する。両ツールの橋渡し役。

```bash
# asc 側: ASC の IAP 一覧を取得
asc storekit retention-messaging messages list --app "123456789" --output json

# RevenueCat 側: MCP で商品一覧を取得
# → 差分を検出し、不足分を自動作成
```

### 一気通貫ワークフロー例

- **Step 1 (asc):** `asc apps list` でアプリ ID を特定
- **Step 2 (asc):** App Store Connect で IAP/サブスク商品を作成
- **Step 3 (ai-toolkit):** RevenueCat で Product・Entitlement・Offering を設定
- **Step 4 (ai-toolkit):** `integrate-revenuecat` スキルで SDK 統合コードを生成
- **Step 5 (asc):** ビルド → TestFlight 配布 → 動作確認
- **Step 6 (asc):** メタデータ設定 → 審査提出

> **なぜ相性が良いか:** どちらも「AI エージェントから呼び出せる」設計。asc CLI は JSON-first + Agent Skills、ai-toolkit は MCP + Skills。ストア側（asc）→ 課金バックエンド側（ai-toolkit）の作業を AI に任せることで、ダッシュボードと ASC を行き来する初期設定の手間を大幅に削減できる。

---

# 連携シナジー

## Shipathon 活用

### Shipathon 2026 参加者のみなさんへ

[Shipathon 2026](https://jp.shipaton.com/)（8/1〜9/30）は RevenueCat 主催の世界最大級モバイルアプリハッカソンです。参加条件は **「アプリを公開し、RevenueCat で課金を実装すること」**。このページで紹介する2つのツールを使えば、その両方を **AI エージェントへの自然言語の指示だけ** で完結できます。

賞金総額 1,000 万円超 / 参加資格不問 / 50,000人以上が参加（2025年実績）

### コードが書けなくても大丈夫

Shipathon で求められる「ストアに公開」「課金を実装」は、従来はエンジニアでないと難しい作業でした。しかし、AI コーディングエージェント + 本ページの2つのツールを組み合わせると、**自然言語で指示するだけ** で AI がコードの生成からストアへの提出まで代行してくれます。

| 従来のハードル | AI ツールで変わること |
| --- | --- |
| App Store Connect の複雑な設定画面 | 日本語で「月額980円のサブスク付けて」と言うだけ |
| RevenueCat ダッシュボードの概念理解 | AI が設定の順序・依存関係を自動制御 |
| Product / Entitlement / Offering の依存関係 | 課金コードはスキルがテンプレート提供 |
| Swift / Kotlin の課金コード実装 | ビルドから審査提出まで CLI コマンドで完結 |
| ビルド・署名・TestFlight の手順 | エラーが出ても AI が原因診断・修正 |

### こんな指示で動きます（自然言語の例）

**非エンジニア向け：アイデアからリリースまで**

```
"瞑想アプリを作りたい。無料で基本コースが使えて、
月額480円のプレミアムで全コース解放。
App Store に出すところまでやって"
```

AI エージェントがアプリ生成 → ASC でサブスク商品作成 → RevenueCat で課金バックエンド設定 → SDK 統合 → ビルド → 審査提出まで一気通貫で実行。

**非エンジニア向け：課金部分だけ追加**

```
"もうアプリはできてる。ここに買い切り1,200円の
広告非表示オプションを追加して、RevenueCatと
App Store Connect の両方を設定して"
```

既存アプリに課金を後付けするパターン。AI がコードの変更箇所を特定し、ストア側・バックエンド側の設定を両方自動で行う。

**エンジニア向け：設定作業の自動化**

```
"ASC の IAP 設定と RevenueCat のカタログを同期して。
不足している商品があれば自動で作って、
Offering に monthly と annual のパッケージを構成して"
```

エンジニアにとっても面倒な「2つのダッシュボードの整合性管理」を AI に任せることで、コア機能の開発に集中できる。

**エンジニア向け：リリースフロー自動化**

```
"ビルドして TestFlight で Internal Testers に配布。
問題なければメタデータを日英で設定して審査に出して。
リリースノートは直近の git log から生成して"
```

asc CLI のスキルがビルド→配布→メタデータ→審査の全ステップを自動化。Shipathon 期間中の高速イテレーションに最適。

### Shipathon で使うために必要なもの

| 項目 | 内容 | 必要度 |
| --- | --- | --- |
| **AI エージェント** | Claude Code / Cursor / Codex など | 必須 |
| **RevenueCat アカウント** | [revenuecat.com](https://www.revenuecat.com/) で無料作成 | 必須 |
| **Apple Developer Program** | 年額 12,980 円（iOS アプリ公開に必要） | 必須（iOS の場合） |
| **RevenueCat AI Toolkit** | AI エージェントのプラグインマーケットプレイスからインストール | 必須 |
| **asc CLI** | `brew install asc` | 推奨 |
| **asc Agent Skills** | `asc install-skills` | 推奨 |

### Shipathon タイムライン × ツール活用

**Week 1-2: アイデア → プロトタイプ**

- AI エージェントにアプリのアイデアを伝えてプロトタイプを生成
- **ai-toolkit:** `create-revenuecat-project` でプロジェクト作成
- **ai-toolkit:** `integrate-revenuecat` で SDK 統合

**Week 3-4: 課金実装 → テスト**

- **asc:** ASC で IAP / サブスク商品を作成
- **ai-toolkit:** RevenueCat で商品設定・ペイウォール構成
- **ai-toolkit:** `purchase-flow` + `entitlements-gate` で課金フロー実装
- **asc:** TestFlight でテスト配布

**Week 5-8: ブラッシュアップ → リリース → 成長**

- **asc:** メタデータ設定（多言語対応）→ 審査提出
- **ai-toolkit:** A/B テスト設定で価格やペイウォールを最適化
- **ai-toolkit:** `revenuecat-charts` で KPI モニタリング
- 改善 → 再ビルド → 再提出のサイクルを高速に回す

> **Shipathon のポイント:** 2ヶ月間でアプリを「公開して成長させる」ことが求められる。AI ツールで初期セットアップを高速化することで、ユーザー獲得や機能改善に時間を使える。「作る」だけでなく「育てる」フェーズにリソースを集中できるのが最大のメリット。

---

## なぜ組み合わせるのか

### 2つのツールが埋める「溝」

iOS/macOS アプリの課金実装には **2つの管理画面** が関わる。App Store Connect（ストア側）と RevenueCat（課金バックエンド側）。従来、開発者はこの2つのダッシュボードを行き来しながら手動で設定を揃える必要があった。

### Before：従来のワークフロー

```
開発者（2つのダッシュボードを手動操作）
        ↓ ブラウザで手動操作
App Store Connect（IAP/サブスク作成・メタデータ設定・審査提出）
RevenueCat Dashboard（Product 作成・Entitlement 設定・Offering 構成）
```

> **課題:** 商品IDの手動コピペ、設定の同期漏れ、ダッシュボード間の行き来による時間ロス。初期設定だけで半日〜1日かかることも。

### After：AI エージェント統合ワークフロー

```
AI エージェント（Claude Code / Codex / Cursor）
        ↓ 自然言語で指示するだけ
asc CLI + Agent Skills（JSON-first CLI / 22 スキルで自動化）
ai-toolkit (MCP + Skills)（リモート MCP サーバー / 14 スキルで自動化）
        ↓ 自動連携
App Store Connect（設定済み） ／ RevenueCat（設定済み）
```

> **効果:** AI エージェントが両側を統一的に操作。商品IDの受け渡し、設定の整合性チェック、不足リソースの自動作成まで一気通貫で完結。初期設定が数分に短縮。

### 組み合わせのメリット

| 単体で使う場合 | 組み合わせた場合 |
| --- | --- |
| asc CLI だけ → ストア側の操作は自動化できるが、RevenueCat 側は手動設定が必要 | ストア側 → 課金バックエンド側を AI が一気通貫で設定 |
| ai-toolkit だけ → RevenueCat 側は自動化できるが、ASC での IAP 作成やビルド配布は手動 | 商品IDの受け渡しを自動化（`asc-revenuecat-catalog-sync` スキル） |
| 商品IDの手動コピペが残る | ビルド → TestFlight → 審査まで同じ AI セッションで完結 |
| 設定の整合性は開発者が目視確認 | 設定の不整合を AI が検出・修正 |

---

## 一気通貫ワークフロー

### End-to-End ワークフロー

AI エージェントに「サブスク課金付きアプリをリリースして」と指示した場合の全体フロー。

#### Phase 1: ストア側セットアップ（asc CLI）

- `asc apps list` でアプリ ID を特定
- App Store Connect で IAP / サブスクリプション商品を作成
- 商品 ID（`com.example.premium_monthly` 等）を取得

```bash
# アプリ確認
asc apps list --output json

# サブスク商品の状態確認
asc storekit retention-messaging messages list \
  --app "123456789" --output json
```

↓ 商品 ID を受け渡し

#### Phase 2: 課金バックエンド設定（ai-toolkit MCP）

- `create-product` で RevenueCat に商品登録（ASC の商品 ID を紐付け）
- `create-entitlement` でアクセス権定義（`"premium"`）
- `attach-products-to-entitlement` で商品→権限を紐付け
- `create-offering` → `create-package` → `attach-products-to-package` でペイウォール構成

```
# MCP 経由で RevenueCat に商品を作成
# → entitlement 作成 → offering 構成
# → 依存関係の順序はスキルが制御
```

↓ SDK 統合コード生成

#### Phase 3: アプリ実装（ai-toolkit Skills）

- `integrate-revenuecat` スキルで SDK 統合コードを生成
- `purchase-flow` スキルで課金フロー実装
- `entitlements-gate` スキルで機能ゲーティング

↓ ビルド & テスト

#### Phase 4: ビルド・テスト・リリース（asc CLI）

- `asc xcode archive` → `asc builds upload` でビルド
- `asc builds add-groups` で TestFlight 配布
- `asc metadata apply` でメタデータ設定
- `asc validate` → `asc publish appstore` で審査提出

```bash
# ビルド → TestFlight → 審査の一括フロー
asc xcode archive --scheme "MyApp"
asc builds upload --app "123456789" --ipa "./build/MyApp.ipa"
asc builds add-groups --app "123456789" --groups "Internal Testers"
asc publish appstore --app "123456789" --submit --confirm
```

↓ リリース後

#### Phase 5: 運用・分析（両ツール連携）

- `revenuecat-charts` スキルで KPI 分析（MRR、解約率、コンバージョン）
- `revenuecat-experiment-analysis` スキルで A/B テスト結果分析
- `asc testflight crashes list` でクラッシュ分析
- `asc-revenuecat-catalog-sync` で商品カタログの整合性チェック

---

## 実践シナリオ

### Scenario 1: 新規サブスクアプリのゼロからリリース

AI エージェントへの指示例:

```
"月額980円・年額7,800円のプレミアムサブスクを持つ
アプリをセットアップして、TestFlight で配布して"
```

AI エージェントが実行すること:

- **asc:** ASC でサブスク商品グループ・月額/年額プランを作成、地域別価格を設定
- **ai-toolkit:** RevenueCat で Product × 2・Entitlement・Offering・Package を作成し商品を紐付け
- **ai-toolkit:** Swift コードを生成（SDK 統合・ペイウォール・購入フロー・機能ゲート）
- **asc:** ビルド → TestFlight 配布

> **従来:** ASC ダッシュボードで商品作成 → RevenueCat ダッシュボードで設定 → コード実装 → Xcode でビルド → ASC でアップロード。**半日〜1日。**
> **連携後:** 自然言語で指示 → AI が全ステップを自動実行。**数十分。**

### Scenario 2: 既存アプリに新しい課金プランを追加

AI エージェントへの指示例:

```
"ライフタイム購入オプション（4,800円）を追加して、
既存の premium entitlement に紐付けて"
```

- **asc:** ASC で非消耗型 IAP を作成、価格設定
- **ai-toolkit:** RevenueCat で Product を作成 → 既存の premium Entitlement に紐付け → Offering にパッケージ追加
- **ai-toolkit:** ペイウォール UI にライフタイムオプションを追加するコードを生成
- **asc-revenuecat-catalog-sync:** 両側の商品カタログが一致していることを検証

### Scenario 3: 多言語対応 + 地域別価格の一括設定

AI エージェントへの指示例:

```
"日本語・英語・中国語のメタデータを設定して、
各地域の購買力に合わせたサブスク価格にして"
```

- **asc:** `asc-localize-metadata` スキルで App Store メタデータを3言語に翻訳
- **asc:** `asc-ppp-pricing` スキルで購買力平価に基づく地域別価格を設定
- **asc:** `asc-subscription-localization` でサブスク表示名を各ロケールに翻訳
- **ai-toolkit:** RevenueCat の Offering がストア側の価格設定と整合しているか確認

### Scenario 4: A/B テスト → 結果分析 → 次バージョンリリース

AI エージェントへの指示例:

```
"ペイウォールの A/B テスト結果を分析して、
勝者バリアントで次のバージョンをリリースして"
```

- **ai-toolkit:** `revenuecat-experiment-analysis` スキルで実験結果を取得・解釈
- **ai-toolkit:** `revenuecat-charts` で勝者バリアントの KPI トレンドを確認
- **asc:** `asc-whats-new-writer` でリリースノートを自動生成
- **asc:** ビルド → メタデータ更新 → 審査提出

### 橋渡しスキル: asc-revenuecat-catalog-sync

2つのツールを繋ぐ要となるスキル。ASC 側のサブスク/IAP と RevenueCat 側の Products・Offerings を照合し、差分を自動検出・解消する。

- **不足検出:** ASC にあるが RevenueCat にない商品を検出 → 自動作成を提案
- **ID 照合:** 商品 ID（`com.example.premium_monthly`）が両側で一致しているか検証
- **Entitlement 漏れ:** 商品が作成済みだが Entitlement に紐付けられていないケースを検出
- **Offering 構成:** パッケージに商品が正しく割り当てられているか確認

> **なぜ重要か:** ASC と RevenueCat で商品設定が食い違うと、「購入はできるがコンテンツが解放されない」「ペイウォールに商品が表示されない」等の深刻なバグになる。このスキルが整合性のゲートキーパーとなる。
