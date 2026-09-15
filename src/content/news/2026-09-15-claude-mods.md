---
title: "Claude Codeの拡張機能「Claude Mods」が登場"
pubDatetime: 2026-09-15
published: true
tags: [AI, Claude Code, Anthropic]
contents:
  - "Function Hooksを基盤とする新たなプラグイン機構"
  - "UIの描画やイベント処理にも対応"
  - "環境変数による試験的な有効化"
  - "コミュニティで公開されたゲーム実装"
description: "Anthropicが、Claude Codeをより深く拡張できるプラグイン機構「Claude Mods」を発表しました。Function Hooksを通じてUIや実行フローを変更でき、すでに試験的な利用が可能です。"
thumbnail: "/images/news/claude-mods.png"
timezone: "Asia/Tokyo"
---

AnthropicのBoris Cherny氏が、Claude Codeの新しい拡張機能「Claude Mods」の提供開始を告知しました。

https://x.com/bcherny/status/2099551291601248485

## Claude Mods

Claude Modsは、Claude Codeを用途に合わせて拡張するプラグインです。Modそのものが独立した新しい仕組みというより、内部の「Function Hooks」を使うプラグインを、製品上の呼び名としてClaude Modsと整理したものです。

Function Hooksでは、従来のイベントフックよりも深いレベルでClaude Codeの処理に介入できます。TypeScript関数としてフックを定義でき、型定義やLSPのサポートを利用しながら、動作の制限、イベントの監査、UIコンポーネントのプロパティや描画結果の変更まで行うことが可能です。複数のModはミドルウェアのように組み合わせられ、登録順にネストして実行されます。

## すでに試せる設定

公式の案内では、Function Hooksを有効にしてClaude Codeを起動できます。

### settings.json

```bash
{
    "env": {
        CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
    }
}
```

筆者が試した結果、Claude Codeにおいて「フォルダを信頼する」を選択していない場合、こちらの機能が有効化されなかったため注意が必要です。

まだ調整されている段階ですが、すでにFunction Hooksを使うModを読み込んで動作を試したり、フィードバックを送ったりできます。

利用するModによって必要な設定やファイル構成は異なるため、各ModのREADMEや公式 issue の最新情報を確認する必要があります。

## Modでできること

公式の設計例では、`ui.press` のようなUIイベントを捕捉したり、`*` で全イベントを監査ログに記録したりできます。また、管理者が利用可能な副作用を制限し、配下のプラグインが実行できる操作を細かく制御することも想定されています。

実例として、コミュニティでは `ui.render` を使ってClaude Codeのプロンプト上部にゲーム画面を描画する「cc-arcade」が作られています。テトリスなどのゲームをClaudeが作業している間もトークンを消費せずに操作でき、`turn.complete` でClaudeのターン終了時にゲームを一時停止したり、`tool.call` でイベントを受け取ったり、`$.store` でスコアを保存しています。

このように、Modはコマンドや知識を追加するだけのプラグインではなく、Claude Codeの実行フローや表示そのものを組み替えられる拡張レイヤーで

Claude Codeを単なるコマンドラインツールから、用途に合わせて開発環境自体を組み替えられる機能として、今後の展開が楽しみです。

詳細は、Anthropicの公式リポジトリに公開されている設計・開発状況をご覧ください。

https://github.com/anthropics/claude-code/issues/91870

テトリスの実装例を紹介したコミュニティコメント：

https://github.com/anthropics/claude-code/issues/91870#issuecomment-5666255143

実装リポジトリ：

https://github.com/sezaakgun/cc-arcade
