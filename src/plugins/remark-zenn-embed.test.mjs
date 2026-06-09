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

  it("@[card](url) は OGP カードになる", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => `<meta property="og:title" content="カード記事">`,
    }));
    const html = await render("@[card](https://example.com/x)\n", [
      remarkZennEmbed,
    ]);
    expect(html).toContain("zenn-link-card");
    expect(html).toContain("カード記事");
  });

  it("github.com のリポジトリ URL を GitHub カードにする", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      text: async () =>
        `<meta property="og:title" content="nogu66/noguchy.me"><meta property="og:image" content="https://opengraph.githubassets.com/abc/nogu66/noguchy.me">`,
    }));
    const html = await render("https://github.com/nogu66/noguchy.me\n", [
      remarkZennEmbed,
    ]);
    expect(html).toContain("zenn-link-card-github");
    expect(html).toContain("opengraph.githubassets.com/abc/nogu66/noguchy.me");
    expect(html).toContain("nogu66/noguchy.me");
    // 汎用カードの右寄せ小画像レイアウトにはならない
    expect(html).not.toContain("zenn-link-card-image");
  });

  it("github.com の PR/Issue URL も GitHub カードにする", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      text: async () =>
        `<meta property="og:title" content="PR #1"><meta property="og:image" content="https://opengraph.githubassets.com/x/pull">`,
    }));
    const html = await render("https://github.com/nogu66/noguchy.me/pull/1\n", [
      remarkZennEmbed,
    ]);
    expect(html).toContain("zenn-link-card-github");
  });

  it("x.com のプロフィール URL を X カードにする", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      text: async () =>
        `<meta property="og:title" content="nogu (@_nogu66) on X"><meta property="og:description" content="Software Engineer"><meta property="og:image" content="https://pbs.twimg.com/profile_images/abc_200x200.jpg">`,
    }));
    const html = await render("https://x.com/_nogu66\n", [remarkZennEmbed]);
    expect(html).toContain("zenn-link-card-x");
    expect(html).toContain("nogu (@_nogu66) on X");
    expect(html).toContain("pbs.twimg.com/profile_images/abc_200x200.jpg");
    expect(html).toContain("zenn-link-card-x-mark");
    // ツイート埋め込み（blockquote）にはならない
    expect(html).not.toContain("twitter-tweet");
  });

  it("x.com のツイート URL は従来通りツイート埋め込みにする", async () => {
    const html = await render("https://x.com/_nogu66/status/123\n", [
      remarkZennEmbed,
    ]);
    expect(html).toContain("twitter-tweet");
    expect(html).not.toContain("zenn-link-card-x");
  });

  it("gist は従来通り script 埋め込み（GitHub カードにしない）", async () => {
    const html = await render("https://gist.github.com/nogu66/abc123\n", [
      remarkZennEmbed,
    ]);
    expect(html).toContain("<script");
    expect(html).toContain("gist.github.com/nogu66/abc123.js");
    expect(html).not.toContain("zenn-link-card-github");
  });

  it("箇条書きの中の裸 URL はカード化せず通常リンクのまま", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => `<meta property="og:title" content="X">`,
    }));
    const html = await render(
      "- https://example.com/a\n- https://example.com/b\n",
      [remarkZennEmbed]
    );
    expect(html).not.toContain("zenn-link-card");
    expect(html).toContain("<li>");
    expect(html).toContain('href="https://example.com/a"');
  });

  it("箇条書きの中の GitHub URL もカード化しない", async () => {
    const html = await render("- https://github.com/nogu66/repo\n", [
      remarkZennEmbed,
    ]);
    expect(html).not.toContain("zenn-link-card-github");
    expect(html).toContain('href="https://github.com/nogu66/repo"');
  });

  it("文章中の裸 URL はカード化しない", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => `<meta property="og:title" content="X">`,
    }));
    const html = await render("詳しくは https://example.com/a を参照。\n", [
      remarkZennEmbed,
    ]);
    expect(html).not.toContain("zenn-link-card");
  });

  it("数値文字参照を含む OGP タイトルをデコードする", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => `<meta property="og:title" content="&#12354;&#x3044;">`,
    }));
    const html = await render("https://example.com/y\n", [remarkZennEmbed]);
    expect(html).toContain("あい");
  });
});
