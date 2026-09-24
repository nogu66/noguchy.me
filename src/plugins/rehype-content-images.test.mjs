import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeContentImages from "./rehype-content-images.mjs";

let publicDir;

beforeAll(async () => {
  publicDir = mkdtempSync(path.join(tmpdir(), "rehype-content-images-"));
  mkdirSync(path.join(publicDir, "images"));
  await sharp({
    create: { width: 40, height: 20, channels: 3, background: "#fff" },
  })
    .png()
    .toFile(path.join(publicDir, "images", "a.png"));
});

afterAll(() => {
  rmSync(publicDir, { recursive: true, force: true });
});

async function render(md) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeContentImages, { publicDir })
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

describe("rehype-content-images", () => {
  it("ローカル画像に実寸の width / height を付ける", async () => {
    const html = await render("![a](/images/a.png)\n");
    expect(html).toContain('width="40"');
    expect(html).toContain('height="20"');
    expect(html).toContain('decoding="async"');
  });

  it("先頭の画像は lazy にせず、2枚目以降を lazy にする", async () => {
    const html = await render("![a](/images/a.png)\n\n![b](/images/a.png)\n");
    const imgs = html.match(/<img[^>]*>/g);
    expect(imgs).toHaveLength(2);
    expect(imgs[0]).not.toContain("loading=");
    expect(imgs[1]).toContain('loading="lazy"');
  });

  it("外部画像や存在しないファイルには寸法を付けない", async () => {
    const html = await render(
      "![a](https://ex.com/a.png)\n\n![b](/images/missing.png)\n"
    );
    expect(html).not.toContain("width=");
    expect(html).toContain('loading="lazy"');
  });
});
