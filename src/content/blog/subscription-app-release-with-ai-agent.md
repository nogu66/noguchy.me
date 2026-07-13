---
title: "世界一簡単なサブスクアプリのリリース方法"
pubDatetime: 2026-07-13T12:00:00
featured: true
published: true
tags:
  [
    "revenuecat",
    "ai",
    "ios",
    "claudecode",
    "appstoreconnect",
    "codex",
    "asccli",
  ]
description: "RevenueCat AI ToolkitとOSSのasc CLIを組み合わせることで、サブスクアプリの課金設定からストア審査提出までをAIエージェントに任せる方法を紹介します。"
timezone: "Asia/Tokyo"
---

**サブスクアプリを作るとき、コードを書くこと自体より、リリースまわりの設定作業に時間を取られた経験はありませんか?**

RevenueCatのダッシュボードで商品を作って、エンタイトルメントを紐付けて、パッケージにまとめる。App Store Connectでアプリを登録して、IAPを申請して、ビルドをTestFlightに上げる。

この2つのダッシュボードを行き来する作業、正直かなり面倒です。コードを書く手を止めてブラウザに切り替える瞬間に、集中力がすっと切れます。

**結論から言うと、この作業のほとんどはAIエージェントへの指示に置き換えられます。** RevenueCat公式の「RevenueCat AI Toolkit」と、OSSの「asc CLI」を組み合わせるだけです。

## 何がそんなに面倒だったのか

サブスクアプリをリリースするまでにやることを分解すると、こうなります。

- App Store Connectの複雑な設定画面を操作する
- RevenueCatダッシュボードの概念（Product / Entitlement / Offering）を理解する
- それらの依存関係を正しい順序で設定する
- Swift、あるいはKotlinで課金コードを実装する
- ビルド・署名・TestFlightの手順を踏む

どれも1つずつは大したことがなくても、全部積み重なるとそれなりの時間がかかります。しかも一度覚えても、次に触るのが数ヶ月後だと大体忘れています。

この面倒さは、ツールごとの役割分担で見ると整理しやすくなります。

![RevenueCat AI ToolkitとASC CLIの役割分担](/images/subscription-app-release-with-ai-agent/tool-comparison.png)

## RevenueCat AI Toolkit→課金バックエンド側

[RevenueCat AI Toolkit](https://github.com/RevenueCat/ai-toolkit)は、RevenueCat側の設定をAIエージェントに任せるための公式プラグインです。Claude Code、Codex、Cursorなどに対応しています。

中身はMCPサーバーとスキルの組み合わせです。プロジェクト作成、商品設計、エンタイトルメント設定、KPI分析までを、チャットでの指示だけで進められます。

商品→エンタイトルメント→パッケージ→オファリングという依存関係の順序制御も、スキルが担ってくれます。「この順番で設定しないといけない」ということを、人間が覚えておく必要がありません。

**また、実装におけるベストプラクティスもスキル内に梱包されているため、安全かつ確実な課金実装を行うことが可能となります。**

## asc CLI→ストア側

[asc CLI](https://asccli.sh/)（App Store Connect CLI）は、App Store Connect側をAIエージェントから操作するためのツールです。

RevenueCat AI Toolkitとは開発元が異なり、rorkaiが開発しているOSSです（MITライセンス）。JSON-first・対話プロンプトなしの設計で、CLIからでもAIエージェント経由でも安全に呼び出せます。

カバーしている範囲はかなり広く、ストア側のリリースライフサイクルをほぼ一本でこなせます。

- **認証：**APIキー登録、プロファイル管理
- **アプリ・ビルド**：アプリ登録、.ipaアップロード、ビルド番号管理
- **TestFlight**：配布グループ管理、テスターフィードバック・クラッシュログ取得
- **審査・リリース**：App Store提出、提出前チェック、審査状況トラッキング
- **メタデータ**：ローカライズ、ASOキーワード監査、スクリーンショット自動化
- **署名・Xcode**：証明書・プロビジョニングプロファイル管理、アーカイブ・エクスポート
- **ワークフロー**：.asc/workflow.jsonでマルチステップの自動化を定義し、--dry-runで安全にプレビュー

これらの操作をAIエージェント向けに手順化した**22個のAgent Skills**も別リポジトリ（app-store-connect-cli-skills）で提供されていて、asc install-skillsで導入できます。

## 2つのツールのシナジー

ここが一番書きたかったところです。RevenueCat AI Toolkitとasc CLIは、それぞれ単体でも便利ですが、**組み合わせて初めて「課金の実装からリリースまで」を自然言語ベースで一気通貫にできます。**

RevenueCat AI Toolkitだけだと、実は片手落ちです。RevenueCatで課金の中身を設定する前に、そもそもApp Store Connect側でアプリを登録し、IAP・サブスク商品を作っておく必要があります。ここは従来、手作業で行う必要があります。

asc CLIがこの手前の部分を埋めることで、ストア側からRevenueCat側まで一気通貫でセットアップできるようになります。

![RevenueCat AI ToolkitとASC CLIによる一気通貫ワークフロー](/images/subscription-app-release-with-ai-agent/workflow.png)

- Step 1（asc）：アプリを登録し、IAP/サブスク商品を作成する
- Step 2（ai-toolkit）：RevenueCatでProduct・Entitlement・Offeringを設定する
- Step 3（ai-toolkit）：SDK統合コードを生成する
- Step 4（asc）：ビルド → TestFlight配布 → 動作確認する
- Step 5（asc）：メタデータを設定し、審査に提出する

さらに、両者の橋渡しをする専用スキル（asc-revenuecat-catalog-sync）も用意されています。

App Store ConnectのIAP/サブスクとRevenueCatのProduct・Offeringを照合し、差分があれば埋めてくれるスキルです。「**片方で商品を作ったのに、もう片方に反映し忘れる**」という事故を防いでくれます。

この2つが噛み合うのは偶然ではなく、どちらもJSON-first・対話プロンプトなし・Agent Skillsという同じ設計思想でAIエージェント向けに作られているからです。

**「AIエージェントに指示できる」という共通言語を持っているツール同士だからこそ、組み合わせたときに一番効きます。**

人間が2つのダッシュボードの整合性を手動で管理する、という一番面倒な部分をまるごとAIエージェントに渡せるのがポイントです。

## 安全に実装できる、という土台は変わらない

課金の実装は、レシート検証やサブスクリプションの状態管理など、地味に事故りやすい領域です。

RevenueCatはこの複雑な部分をSDKでラップしてくれるので、開発者はStoreKitの詳細をほぼ意識せずに済みます。これはAIエージェントを使う・使わないに関係なく、**RevenueCatを選ぶ基本的な理由**です。

その上で、「安全な選択」を採用するための設定作業自体が地味に難しい、という別の問題を、AIエージェントとの連携（MCP）が解決してくれます。難しい部分ほどAIに任せられる、という役割分担になっているため、作業に慣れていないような人にも優しい設計となっています。

## 実際にはこんな指示で動きます

エンジニアであれば、たとえばこんな指示が有効です。

> ASCのIAP設定とRevenueCatのカタログを同期して。不足している商品があれば自動で作って、Offeringにmonthlyとannualのパッケージを構成して

コードが書けない人でも、たとえばこんな一言から始められます。

> 瞑想アプリを作りたい。無料で基本コースが使えて、月額480円のプレミアムで全コース解放。App Storeに出すところまでやって

どちらの場合も、AIエージェントが商品作成からSDK統合、ビルド、審査提出までを一気通貫で進めてくれます。

## さいごに

RevenueCat AI Toolkitがサブスクの中身を、asc CLIがストアへの提出を担当する。この役割分担のおかげで、ダッシュボードを行き来する作業をAIエージェントとの会話に置き換えられます。

「**安全に実装したいからRevenueCatを使う**」という判断は変わらないまま、そこにかかる設定の手間だけを減らせる。これが2つのツールを組み合わせる一番の価値だと思います。
