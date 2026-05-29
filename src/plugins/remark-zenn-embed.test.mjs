import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "./test-helper.mjs";
import remarkZennEmbed, { __clearCache } from "./remark-zenn-embed.mjs";

beforeEach(() => __clearCache());

describe("remark-zenn-embed", () => {
  it("@[youtube](id) を YouTube iframe にする", async () => {
    const html = await render("@[youtube](WRVsOCh907o)\n", [remarkZennEmbed]);
    expect(html).toContain("<iframe");
    expect(html).toContain("youtube.com/embed/WRVsOCh907o");
  });

  it("裸の YouTube URL を iframe にする", async () => {
    const html = await render("https://www.youtube.com/watch?v=WRVsOCh907o\n", [
      remarkZennEmbed,
    ]);
    expect(html).toContain("youtube.com/embed/WRVsOCh907o");
  });

  it("裸の汎用 URL は OGP を取得してカード化する", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      text: async () =>
        `<meta property="og:title" content="サンプル記事"><meta property="og:description" content="説明文">`,
    }));
    const html = await render("https://example.com/post\n", [remarkZennEmbed]);
    expect(html).toContain("zenn-link-card");
    expect(html).toContain("サンプル記事");
    expect(html).toContain('href="https://example.com/post"');
  });

  it("OGP 取得に失敗したら通常リンクにフォールバック", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("network");
    });
    const html = await render("https://example.com/fail\n", [remarkZennEmbed]);
    expect(html).toContain('href="https://example.com/fail"');
    expect(html).not.toContain("zenn-link-card");
  });
});
