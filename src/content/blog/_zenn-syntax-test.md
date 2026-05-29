---
title: "Zenn記法 動作確認"
description: "全記法の描画確認用（非公開）"
pubDatetime: 2026-05-29
published: false
tags: ["test"]
---

## 見出し

:::message
通常メッセージ。**太字**や`code`も使える。
:::

:::message alert
警告メッセージ。
:::

::::details 親アコーディオン
:::message
ネストしたメッセージ。
:::
::::

数式ブロック:

$$
e^{i\theta} = \cos\theta + i\sin\theta
$$

インライン $a \ne 0$ も表示できる。

```js:hello.js
const great = () => console.log("Awesome");
```

```diff js
+ const added = 1;
- const removed = 2;
  const same = 3;
```

```mermaid
graph TD
  A[開始] --> B{分岐}
  B -->|Yes| C[実行]
  B -->|No| D[終了]
```

![Astroロゴ](https://docs.astro.build/assets/full-logo-light.png =300x)

![キャプション付き画像](https://docs.astro.build/assets/full-logo-light.png)
_これはキャプションです_

@[youtube](WRVsOCh907o)

| Head | Head |
| ---- | ---- |
| Text | Text |

脚注の例[^1]。

[^1]: 脚注の内容。
