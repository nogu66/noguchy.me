import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createNewsStore } from "./news-editor-store.mjs";
import { needsSourceMode, normalizeMarkdown } from "../tools/news-editor/model";

let root, store;
const draft = () => ({
  id: "2026-09-15-test.md",
  revision: null,
  title: "日本語のニュース: テスト",
  description: "概要です。",
  pubDatetime: "2026-09-15T10:00:00+09:00",
  published: false,
  tags: ["AI", "Claude Code"],
  contents: ["要点"],
  thumbnail: "",
  body: "## 見出し\n\n本文と **太字**。\n\nhttps://x.com/example/status/123\n",
});
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "noguchy-news-editor-"));
  await mkdir(path.join(root, "src/content/news"), { recursive: true });
  store = createNewsStore(root);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("repository article editing", () => {
  it("formats editor output while preserving unfinished code snippets", async () => {
    const saved = await store.save({
      ...draft(),
      body: "## 見出し\n\n本文。\n\n\n",
    });
    expect(saved.body).toBe("## 見出し\n\n本文。\n");
    const snippet = await store.save({
      ...saved,
      body: '```json\n{"broken":}\n```',
    });
    expect(snippet.body).toBe('```json\n{"broken":}\n```\n');
    expect((await store.read(saved.id)).body).toBe(snippet.body);
  });
  it("round trips Japanese metadata and the exact Markdown body", async () => {
    const input = draft();
    const saved = await store.save(input);
    expect(saved.revision).toMatch(/^[0-9a-f]{64}$/);
    expect(await store.read(input.id)).toEqual({
      ...input,
      revision: saved.revision,
    });
    expect((await store.list()).articles).toHaveLength(1);
    expect((await store.list()).articles[0].body).toBeUndefined();
  });
  it("preserves unknown frontmatter and backs up the complete previous file", async () => {
    const original =
      "---\ntitle: Existing\npubDatetime: 2026-09-15\npublished: true\ndescription: Original\nauthor: nogu\nogImage: /custom.png\n# keep this comment\ntimezone: Asia/Tokyo\n---\n\n:::message\n重要\n:::\n";
    await writeFile(path.join(root, "src/content/news/existing.md"), original);
    const existing = await store.read("existing.md");
    await store.save({ ...existing, title: "Updated" });
    const result = await readFile(
      path.join(root, "src/content/news/existing.md"),
      "utf8"
    );
    expect(result).toContain("author: nogu");
    expect(result).toContain("ogImage: /custom.png");
    expect(result).toContain("# keep this comment");
    expect(result).toContain("modDatetime:");
    expect((await store.read("existing.md")).body).toBe(existing.body);
    const backups = await readdir(
      path.join(root, ".local/news-editor/backups")
    );
    expect(backups).toHaveLength(1);
    expect(
      await readFile(
        path.join(root, ".local/news-editor/backups", backups[0]),
        "utf8"
      )
    ).toBe(original);
  });
  it("rejects duplicate creation and stale revisions without overwriting", async () => {
    const saved = await store.save(draft());
    await expect(store.save(draft())).rejects.toMatchObject({ status: 409 });
    const updated = await store.save({ ...saved, body: "Latest" });
    await expect(store.save({ ...saved, body: "Stale" })).rejects.toMatchObject(
      { status: 409 }
    );
    expect((await store.read(saved.id)).body).toBe(updated.body);
  });
  it("serializes simultaneous saves so only one matching revision wins", async () => {
    const saved = await store.save(draft());
    const results = await Promise.allSettled([
      store.save({ ...saved, body: "One" }),
      store.save({ ...saved, body: "Two" }),
    ]);
    expect(
      results.filter(result => result.status === "fulfilled")
    ).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(
      1
    );
  });
  it("requires title and a valid date; requires content for publishable articles", async () => {
    await expect(store.save({ ...draft(), title: " " })).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      store.save({ ...draft(), pubDatetime: "invalid" })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      store.save({ ...draft(), published: true, body: "" })
    ).rejects.toMatchObject({ status: 400 });
    expect(
      (await store.save({ ...draft(), description: "", body: "" })).published
    ).toBe(false);
  });
  it("rejects path traversal, absolute paths and symlinked files", async () => {
    for (const id of [
      "../outside.md",
      "/outside.md",
      "nested/../../outside.md",
      "a/../outside.md",
      "_hidden.md",
    ]) {
      await expect(store.save({ ...draft(), id })).rejects.toMatchObject({
        status: 400,
      });
    }
    const external = path.join(root, "external.md");
    await writeFile(external, "untouched");
    await symlink(external, path.join(root, "src/content/news/link.md"));
    await expect(
      store.save({ ...draft(), id: "link.md" })
    ).rejects.toMatchObject({ status: 400 });
    expect(await readFile(external, "utf8")).toBe("untouched");
  });
  it("reports malformed articles while listing healthy ones", async () => {
    await store.save(draft());
    await writeFile(
      path.join(root, "src/content/news/broken.md"),
      "no frontmatter"
    );
    await writeFile(
      path.join(root, "src/content/news/_example.md"),
      "template"
    );
    const result = await store.list();
    expect(result.articles).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });
  it("stores decoded images as unique, resized WebP files", async () => {
    const input = await sharp({
      create: { width: 16, height: 12, channels: 3, background: "#d97757" },
    })
      .png()
      .toBuffer();
    const first = await store.upload(input);
    const second = await store.upload(input);
    expect(first.url).not.toBe(second.url);
    const image = await store.image(first.url.slice("/images/".length));
    expect(image.mime).toBe("image/webp");
    expect((await sharp(image.buffer).metadata()).width).toBe(16);
  });
  it("rejects fake images and non-image file reads", async () => {
    await expect(
      store.upload(Buffer.from("not an image"))
    ).rejects.toMatchObject({ status: 400 });
    await expect(store.image("../../package.json")).rejects.toMatchObject({
      status: 400,
    });
    await expect(store.image("news/config.json")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("site Markdown compatibility", () => {
  it("preserves standalone embed URLs after rich-text serialization", () => {
    expect(
      normalizeMarkdown(
        "[https://x.com/a/status/123](https://x.com/a/status/123)\n\n<https://youtube.com/watch?v=123>\n\n[リンク](https://example.com)"
      )
    ).toBe(
      "https://x.com/a/status/123\n\nhttps://youtube.com/watch?v=123\n\n[リンク](https://example.com)"
    );
  });
  it("keeps unsupported Zenn and HTML syntax in source mode", () => {
    for (const body of [
      ":::message\nhello\n:::",
      "@[youtube](id)",
      "```js:app.js\nlet x;\n```",
      "$$x^2$$",
      "<details>hello</details>",
      "<!-- keep -->",
      "```mermaid\ngraph TD\n```",
      "![alt](x.png =250x)",
    ])
      expect(needsSourceMode(body)).toBe(true);
    expect(
      needsSourceMode("## 見出し\n\n**本文**\n\nhttps://x.com/a/status/123")
    ).toBe(false);
  });
});
