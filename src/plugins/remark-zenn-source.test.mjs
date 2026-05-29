import { describe, it, expect } from "vitest";
import { render } from "./test-helper.mjs";
import remarkZennSource from "./remark-zenn-source.mjs";

describe("remark-zenn-source", () => {
  it(":::message → info ボックス", async () => {
    const html = await render(":::message\nお知らせ\n:::\n", [
      remarkZennSource,
    ]);
    expect(html).toContain('class="zenn-msg zenn-msg-info"');
    expect(html).toContain("お知らせ");
  });

  it(":::message alert → alert ボックス", async () => {
    const html = await render(":::message alert\n警告\n:::\n", [
      remarkZennSource,
    ]);
    expect(html).toContain("zenn-msg-alert");
  });

  it(":::details タイトル → details/summary", async () => {
    const html = await render(":::details 詳しく\n中身\n:::\n", [
      remarkZennSource,
    ]);
    expect(html).toContain("<details");
    expect(html).toContain("<summary>詳しく</summary>");
    expect(html).toContain("中身");
  });

  it("ネスト(::::details > :::message)", async () => {
    const md = "::::details 親\n:::message\n子\n:::\n::::\n";
    const html = await render(md, [remarkZennSource]);
    expect(html).toContain("<details");
    expect(html).toContain("zenn-msg");
    expect(html).toContain("子");
  });

  it("コンテナ内の Markdown が解釈される", async () => {
    const html = await render(":::message\n**太字**\n:::\n", [
      remarkZennSource,
    ]);
    expect(html).toContain("<strong>太字</strong>");
  });

  it("画像幅 =250x → width 付き img", async () => {
    const html = await render("![猫](https://ex.com/a.png =250x)\n", [
      remarkZennSource,
    ]);
    expect(html).toContain('<img src="https://ex.com/a.png"');
    expect(html).toContain('width="250"');
    expect(html).toContain('alt="猫"');
  });

  it("通常 Markdown はそのまま", async () => {
    const html = await render("# 見出し\n\n本文\n", [remarkZennSource]);
    expect(html).toContain("<h1>見出し</h1>");
  });

  it("width + height 両方指定", async () => {
    const html = await render("![](https://ex.com/a.png =250x100)\n", [
      remarkZennSource,
    ]);
    expect(html).toContain('width="250"');
    expect(html).toContain('height="100"');
  });

  it(":::details はタイトル省略時に既定値", async () => {
    const html = await render(":::details\n中身\n:::\n", [remarkZennSource]);
    expect(html).toContain("<summary>詳細</summary>");
  });

  it("コードフェンス内の :::message と画像幅は変換しない", async () => {
    const md =
      "```md\n:::message\n例\n:::\n![](https://ex.com/a.png =250x)\n```\n";
    const html = await render(md, [remarkZennSource]);
    expect(html).not.toContain("zenn-msg");
    expect(html).not.toContain("<img");
    expect(html).toContain(":::message"); // 文字列として残る
  });

  it("コロン数が一致しない閉じフェンスは無視され文字も残さない", async () => {
    const md = "::::details 親\n中身\n:::\n::::\n";
    const html = await render(md, [remarkZennSource]);
    expect(html).toContain("<details");
    expect(html).toContain("中身");
    expect(html).not.toContain("<p>:::</p>");
  });
});
