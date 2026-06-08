---
title: "Dynamic workflow と /goal コマンドによるスキルの最適化手法"
pubDatetime: 2026-06-08T12:00:00
featured: false
published: true
tags: ["claudecode", "claude", "ai", "skill"]
description: "Claude Code の Dynamic workflow と /goal コマンドを組み合わせ、手動チューニングに頼らずに Agent Skills を多角的に検証・改善する手法を解説します。"
timezone: "Asia/Tokyo"
---

:::message alert
**本記事で紹介する手法は、通常よりも多くのトークンを消費する可能性があります。**
:::

## はじめに

**実運用において、Agent Skillsは作って終わりではなく、検証ループで育てるものです**。

先日、チームへ配布するワークフロー系のスキルを作成しました。スキル自体は `/skill-creator`コマンドを使うことで簡単に作成することができます。**しかし、それだけでは実運用に耐えることができません**。

次に必要なのは、スキル本体をいじることではなく、**スキルが意図通りに動作するかを多角的に検証すること**です。

網羅性、スキル、スキル内のプロセス遵守、検証すべきことはわかっているのに、どうしても手動のチェックだけでは精度の改善に限界があります。

**そこで、本記事では、 Claude Code の Dynamic workflow と `/goal`コマンドを組み合わせ、手動チューニングに頼らずスキルを育てる検証ループの手法を示します**。

**この記事の対象読者**

- Claude Code で Skills を運用している方
- スキル数が増えて、どれをいつ使うか迷い始めた方
- dynamic workflow や `/goal` によるスキル最適化に興味がある方

**この記事でわかること**

- dynamic workflow の考え方と、従来の静的スキル運用との違い
- `/goal` を使ったスキル選択・最適化の仕組み
- 実践的なワークフロー設計の指針

**この記事で扱わないこと**

- Skills の作成手順の詳細
- 特定プロダクトの API 実装

## Dynamic workflow

**Dynamic workflow**（**動的ワークフロー**）**とは、サブエージェントを大規模にオーケストレーションする JavaScript スクリプトです**。

Claude は説明したタスク用のスクリプトを作成し、バックグラウンドでタスクを実行しながら、応答できるようにセッションを維持します。

例としては、コードベース全体のバグ調査、プロジェクト全体の別言語へのリプレイス、複数のソースに対して相互検証が必要タスクに対して有効です。

![dynamic workflowのイメージ](/images/dynamic-workflow-goal-skill-optimization/動的ワークフロー説明図.png)

https://code.claude.com/docs/ja/workflows

## `/goal` コマンド

**`/goal` コマンドは完了条件を設定し 、その条件の達成に向かって追加の指示不要で動作し続けます**。

各ターンの後、小さく高速なモデルが条件が成立しているかどうかをチェックします。成立していない場合、Claude はあなたの応答を待つ代わりに別のターンを開始します。条件が満たされると、ゴールは自動的にクリアされます。

例として、受け入れ基準が満たされるまで実装をするとき、大きなファイルを基準以下になるまで分割するときに有効です。

![/goalのイメージ](/images/dynamic-workflow-goal-skill-optimization/goal説明図.png)

https://code.claude.com/docs/ja/goal

## とりあえず、ワークフローだけを知りたい人はこちら

1. `/skill-creator`でスキルを作成する
2. Dynamic workflowを使った検証を依頼する（例：「`ultracodeでこのスキルの動作を検証してください。`」）
3. 検証結果を確認して、改善点を把握する。
4. `/goal`コマンドでスキルの改善が完了するまで実行をする。

## ワークフロー

### 検証対象のスキルを用意

今回は、検証ループの実行を、次のリポジトリを対象として行います。

リポジトリの中身は、**LLMに自然言語で指示することで MacOS のコンピューターを操作するCLIツール、CLIを操作するスキルが含まれています**。

https://github.com/nogu66/open-computer-use

実行対象のスキルが存在しない場合は、次のように `/skill-creator` コマンドを実行して、スキルを作成してください。

## Dynamic workflow の実行

それでは、次に **Dynamic workflow**を使って、スキルの検証を開始していきましょう！

Dynamic workflow を実行する方法は２つあります。

1. **`ultracode`をプロンプトに含める。**
2. **`/effort` を `ultracode`に変更する。**

### `ultracode`をプロンプトに含める

1つ目の方法は簡単で、`ultracode` というワードを含めることで明示的に実行することができます。`ultracode`を Claude Code に入力すると、次の画像のようにカラーが変化して表示されます。

![ultracodeを含めたプロンプト](/images/dynamic-workflow-goal-skill-optimization/ultracode-prompt.png)

### `/effort` を `ultracode`に変更する

2つめの方法は、Claude Code に　`/effort`コマンドを入力して、Effortの設定画面に移動します。その後、一番右にあるultracodeを選択します。

![effortの選択](/images/dynamic-workflow-goal-skill-optimization/effor-ultracode.png)

ultracodeを選択して、元の画面に戻ると入力ウィンドウの右上にultracodeが表示されます。

![ultracode effort](/images/dynamic-workflow-goal-skill-optimization/after-effor-ultracode.png)

**本記事内では、検証部分にだけ dynamic workflow を適用したいため、`ultracode`をプロンプトに含めて実行します。**

## Dynamic workflowを用いたスキルの検証開始

次のように入力をして、リポジトリ内のスキル検証を開始していきます。

```bash
ultracode でこのリポジトリ内のスキルを検証してください。
```

Dynamic workflow の実行が開始すると、画像のようにリポジトリ構造の把握を行ってから、ultracodeのマルチエージェントワークフローでの検証が開始されます。

![多角的な検証](/images/dynamic-workflow-goal-skill-optimization/start-running-debug-skill.png)

今回のケースでは、**３パターンのエージェントが起動しました。**

```bash
ワークフローを起動しました（4次元の並列レビュー → 各指摘の敵対的検証 → 統合レポート）。完了通知を待ちます。
  - Find: スキル作法 / CLI記述の正確性 / MCP・インストール記述の正確性 / ファイル間一貫性 の4観点を Explore エージェントで並列調査
  - Verify: 各指摘を懐疑的に再検証（実ファイルを読み直して誤読を棄却）
  - Synthesize: 確認済みの指摘のみで日本語レポートを生成
```

**Findエージェントが問題を洗い出し、Verifyエージェントが指摘事項を再検証。最後に、Synthesizeエージェントが検証結果をレポートとして出力してくれます。**

### 起動中のエージェントを確認

**起動しているエージェントは、`/workflows` で確認することができます**。

![起動しているエージェント](/images/dynamic-workflow-goal-skill-optimization/running-workflow-check.png)

これによって、リアルタイムに起動中しているのか、完了しているのを見ることができます。また、起動しているエージェントの設定や出力内容などを起動中や完了後にも見ることができるので、どのような動作をエージェントがやったかを確認することもできます。

## スキルの検証結果

検証対象のスキルを実行したところ、次の画像のような問題が検出されました。

![スキルの検証結果](/images/dynamic-workflow-goal-skill-optimization/result-of-dubug.png)

ザックリと内容を要約すると、CLIを操作するスキルであるにも関わらず、その操作方法に関する記載が不足していることが問題として挙げられています。

**次に、挙げられて問題を `/goal`コマンドを用いて、解消していきましょう。**

## `/goal` コマンドによるスキルの改善

最後に、`/goal`コマンドを用いて、スキルの問題解消を行なっています。次のようにプロンプトに `/goal`を含めて、dynamic workflowで指摘された問題点の改善を依頼します。

```bash
/goal 指摘された問題点を改善して欲しいです。
```

`/goal`コマンドを実行すると、エージェント内で検証と実行を繰り返して、スキルの改善が完了するまで実行を続けます。すべての検証が問題ないと判断されると、画像のようにスキルのアップデートが完了します。

![スキルのアップデート結果](/images/dynamic-workflow-goal-skill-optimization/updating-skill.png)

## おわりに

AIエージェントにおいて、スキルの検証・改善方法は未だ確立されていない分野の１つです。そのため、手動チューニングは手間や時間がかかり、決定的な終了条件も見つかっていません。また、LLMという性質上、多角的に検証を行わないと、考慮できていない問題点が発生する可能性があります。

それに対して、**Dynamic workflow と `/goal`コマンドを組み合わせることで、手動チューニングだけに頼らないエージェントティックな検証を行うことができます**。それによって、スキルの多角的な検証・改善が可能となり、より精度の高いスキルになると考えております。

その結果、初期段階からうまく動作するスキルが作成可能になります。加えて、初期段階から優れたスキルを作成できることにより、実運用において有用な実行結果を収集することが可能になり、継続的なスキルの改善に役に立つと確信しております。

## Xアカウント

日常的な実践内容はXで発信しています。

https://x.com/_nogu66

## 参考文献

- https://code.claude.com/docs/ja/workflows
- https://code.claude.com/docs/ja/goal
- https://github.com/nogu66/open-computer-use
