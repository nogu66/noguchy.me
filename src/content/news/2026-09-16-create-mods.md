---
title: "Claude Modsの開発を支援する「create-mods」が公開"
pubDatetime: 2026-09-16
published: true
tags:
  - AI
  - Claude Code
  - Claude Mods
contents:
  - Claude Modsの設計・実装を支援するプラグイン
  - APIの参照からUI拡張、実装アイデアの検討まで
  - インストール方法
description: "Claude Codeの拡張機能「Claude Mods」の開発を支援するプラグイン「create-mods」が公開されました。Function Hooksの仕組みやAPI、UI描画、設計パターンを参照しながら、独自のModづくりを進められます。"
timezone: "Asia/Tokyo"
thumbnail: /images/news/editor/de312a69-96ef-4917-8dc5-3e622a074a93.webp
modDatetime: 2026-09-16T02:52:26.137Z
---

**Claude Codeの拡張機能「Claude Mods」の開発を支援するプラグイン「create-mods」が、GitHubで公開されました。**

https://github.com/nogu66/claude-code/tree/main/create-mods

Claude Modsは、Claude Codeの「Function Hooks」を使って、処理の流れやUIを拡張する仕組みです。create-modsは、その仕組みを理解し、独自のModを設計・実装するためのリファレンスとワークフローがClaude Codeのスキルとしてまとめられています。

## create-modsでできること

導入すると、Claude Modsやfunction hooksについて相談したときに、Claudeが関連するスキルを自動で呼び出します。Modづくりでは、次のような場面に活用できます。

### **仕組みを理解する**

従来のシェルベースのhooksとの違いや、イベントを受け取り、次の処理へ渡す流れを確認できます。

- **APIやイベントを調べる**
  - Modから利用する`$` APIやイベントの一覧、権限の仕組み、エラーからの復旧方法を参照しながら実装を検討できます。
- **UIの拡張を設計する**
  - `ui.render`による描画や再描画、インタラクティブなUIを動かす構成を学べます。Claude Code内でゲームを動かす「cc-arcade」の実例も参考にしています。
- **保守しやすい構成でModを組み立てる**
  - イベント処理、UI、ロジックを分ける設計パターンを参照できます。
- **つくるModのアイデアを広げる**
  - セキュリティ、開発生産性、ログなどによる動作の把握、UI/UX、メモリ、外部連携、オンボーディングといった分野のアイデア集を利用できます。

これらはModを開発するための知識や手順です。アイデア集にある機能が、インストールだけで一括して追加されるわけではありません。

## インストール方法

Claude Codeでマーケットプレイスを追加し、プラグインをインストールします。

```text
/plugin marketplace add nogu66/claude-code
/plugin install create-mods@nogu-marketplace
```

導入後は、たとえば「Claude Modsで作業状況を表示するUIをつくりたい」「function hooksと従来のhooksの違いを知りたい」と相談するところから始めることができます。

Function Hooksは早期アクセス段階のため、仕様が変わる可能性があります。実際にModを開発する際は、Claude Codeのセッション内で`/plugin-types`を実行し、最新の型定義を確認することが案内されています。

詳しい機能や使い方は、[日本語README](https://github.com/nogu66/claude-code/blob/main/create-mods/README.ja.md)をご覧ください。
