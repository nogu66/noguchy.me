import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  lstat,
  writeFile,
  rename,
} from "node:fs/promises";
import { parseDocument, Document } from "yaml";
import sharp from "sharp";
import { format, resolveConfig } from "prettier";

export class EditorError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const hash = text => createHash("sha256").update(text).digest("hex");
const fields = [
  "title",
  "description",
  "pubDatetime",
  "published",
  "tags",
  "contents",
  "thumbnail",
];

export function parseArticle(source, id) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new EditorError(`${id}: 記事情報を読み取れません。`);
  const document = parseDocument(match[1]);
  if (document.errors.length)
    throw new EditorError(`${id}: 記事情報の形式を確認してください。`);
  const data = document.toJS();
  if (!data || Array.isArray(data) || typeof data !== "object")
    throw new EditorError(`${id}: 記事情報が不正です。`);
  return {
    document,
    article: {
      id,
      revision: hash(source),
      title: data.title ?? "",
      description: data.description ?? "",
      pubDatetime: String(data.pubDatetime ?? ""),
      published: data.published === true,
      tags: data.tags ?? [],
      contents: data.contents ?? [],
      thumbnail: data.thumbnail ?? "",
      body: source.slice(match[0].length).replace(/^\r?\n/, ""),
    },
  };
}

function validateArticle(data) {
  for (const field of [
    "title",
    "description",
    "body",
    "pubDatetime",
    "thumbnail",
  ]) {
    if (typeof data[field] !== "string")
      throw new EditorError(`入力内容を確認してください: ${field}`);
  }
  if (!data.title.trim()) throw new EditorError("タイトルを入力してください。");
  if (!Number.isFinite(Date.parse(data.pubDatetime)))
    throw new EditorError("日時を入力してください。");
  if (typeof data.published !== "boolean")
    throw new EditorError("公開対象の設定が不正です。");
  for (const field of ["tags", "contents"]) {
    if (
      !Array.isArray(data[field]) ||
      !data[field].every(v => typeof v === "string") ||
      data[field].length > 100
    ) {
      throw new EditorError("タグと要点の入力内容を確認してください。");
    }
  }
  if (data.published && (!data.description.trim() || !data.body.trim())) {
    throw new EditorError("公開対象にするには、概要と本文も入力してください。");
  }
  if (data.thumbnail && !/^(https?:\/\/|\/images\/)/i.test(data.thumbnail))
    throw new EditorError(
      "カバー画像は画像パスまたは https:// のURLを指定してください。"
    );
}

export function createNewsStore(root) {
  const newsDir = path.join(root, "src/content/news");
  const backupDir = path.join(root, ".local/news-editor/backups");
  let queue = Promise.resolve();
  const serial = task => {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  };
  async function safeFile(base, relative) {
    if (
      typeof relative !== "string" ||
      relative.length > 240 ||
      !relative
        .split("/")
        .every(part => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part))
    ) {
      throw new EditorError("ファイル名が不正です。");
    }
    let current = base;
    // Do not follow symlinks, including the content or image root itself.
    const ancestors = path.relative(root, base).split(path.sep);
    current = root;
    for (const part of [...ancestors, ...relative.split("/")]) {
      current = path.join(current, part);
      try {
        if ((await lstat(current)).isSymbolicLink())
          throw new EditorError("シンボリックリンクは編集できません。");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    return current;
  }
  const articleFile = async id => {
    if (!String(id).endsWith(".md"))
      throw new EditorError("Markdown記事を指定してください。");
    return safeFile(newsDir, id);
  };
  async function read(id) {
    try {
      return parseArticle(await readFile(await articleFile(id), "utf8"), id)
        .article;
    } catch (error) {
      if (error.code === "ENOENT")
        throw new EditorError("記事が見つかりません。", 404);
      throw error;
    }
  }
  async function list() {
    const articles = [],
      warnings = [];
    async function walk(dir, prefix = "") {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (
          entry.name.startsWith("_") ||
          entry.name.startsWith(".") ||
          entry.isSymbolicLink()
        )
          continue;
        if (entry.isDirectory())
          await walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
        else if (entry.name.endsWith(".md")) {
          try {
            const article = await read(`${prefix}${entry.name}`);
            articles.push({ ...article, body: undefined });
          } catch (error) {
            warnings.push(error.message);
          }
        }
      }
    }
    await walk(newsDir);
    articles.sort(
      (a, b) => Date.parse(b.pubDatetime) - Date.parse(a.pubDatetime)
    );
    return { articles, warnings };
  }
  const save = data =>
    serial(async () => {
      validateArticle(data);
      const filename = await articleFile(data.id);
      let source = null;
      try {
        source = await readFile(filename, "utf8");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      if (
        (source !== null && hash(source) !== data.revision) ||
        (source === null && data.revision)
      ) {
        throw new EditorError(
          "この記事は別の場所で変更されています。入力内容は退避済みです。Markdownをダウンロードしてから、最新の記事を読み直してください。",
          409
        );
      }
      const document =
        source === null
          ? new Document({ timezone: "Asia/Tokyo" })
          : parseArticle(source, data.id).document;
      for (const field of fields) document.set(field, data[field]);
      if (source !== null)
        document.set("modDatetime", new Date().toISOString());
      let output;
      try {
        output = await format(
          `---\n${document.toString({ lineWidth: 0 })}---\n\n${data.body}`,
          {
            ...(await resolveConfig(filename)),
            parser: "markdown",
          }
        );
      } catch {
        throw new EditorError(
          "記事の書式を整えられませんでした。Markdownタブでコードブロックなどの記法を確認してください。"
        );
      }
      await mkdir(path.dirname(filename), { recursive: true });
      if (source !== null) {
        await mkdir(backupDir, { recursive: true });
        await writeFile(
          path.join(
            backupDir,
            `${Date.now()}-${randomUUID()}-${path.basename(data.id)}`
          ),
          source,
          { flag: "wx" }
        );
        const temporary = `${filename}.${randomUUID()}.tmp`;
        await writeFile(temporary, output, { flag: "wx" });
        await rename(temporary, filename);
      } else await writeFile(filename, output, { flag: "wx" });
      return parseArticle(output, data.id).article;
    });
  async function upload(buffer) {
    if (buffer.length > 10 * 1024 * 1024)
      throw new EditorError("画像は10MB以内にしてください。", 413);
    let converted;
    try {
      const image = sharp(buffer, { limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      if (
        !["jpeg", "png", "webp", "gif", "avif", "heif"].includes(
          metadata.format
        )
      )
        throw new Error("format");
      converted = await image
        .rotate()
        .resize({ width: 2400, withoutEnlargement: true })
        .webp({ quality: 88 })
        .toBuffer();
    } catch {
      throw new EditorError(
        "読み取れない画像です。PNG・JPEG・WebPなどの画像を選んでください。"
      );
    }
    const name = `${randomUUID()}.webp`;
    const filename = await safeFile(
      path.join(root, "public/images/news/editor"),
      name
    );
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, converted, { flag: "wx" });
    return { url: `/images/news/editor/${name}` };
  }
  async function image(relative) {
    const filename = await safeFile(path.join(root, "public/images"), relative);
    const extension = path.extname(filename).toLowerCase();
    const mime = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".avif": "image/avif",
    }[extension];
    if (!mime) throw new EditorError("画像が見つかりません。", 404);
    return { buffer: await readFile(filename), mime };
  }
  return { read, list, save, upload, image };
}
