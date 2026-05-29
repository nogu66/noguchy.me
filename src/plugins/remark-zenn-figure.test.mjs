import { describe, it, expect } from "vitest";
import { render } from "./test-helper.mjs";
import remarkZennFigure from "./remark-zenn-figure.mjs";

describe("remark-zenn-figure", () => {
  it("画像直後の *caption* を figcaption にする", async () => {
    const md = "![ねこ](https://ex.com/a.png)\n*かわいい猫*\n";
    const html = await render(md, [remarkZennFigure]);
    expect(html).toContain("<figure");
    expect(html).toContain("<figcaption>かわいい猫</figcaption>");
    expect(html).toContain('src="https://ex.com/a.png"');
  });

  it("キャプションが無い画像はそのまま（figure化しない）", async () => {
    const md = "![ねこ](https://ex.com/a.png)\n";
    const html = await render(md, [remarkZennFigure]);
    expect(html).not.toContain("<figure");
    expect(html).toContain("<img");
  });

  it("画像以外で始まる段落は無視", async () => {
    const md = "ただの文章 *強調*\n";
    const html = await render(md, [remarkZennFigure]);
    expect(html).not.toContain("<figure");
  });
});
