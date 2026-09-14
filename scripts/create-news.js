#!/usr/bin/env node
/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("エラー: ファイル名を指定してください");
  console.log("使い方: pnpm new-news <ファイル名>");
  console.log("例: pnpm new-news claude-plugin-eval");
  process.exit(1);
}

const filename = args[0].endsWith(".md") ? args[0] : `${args[0]}.md`;
const templatePath = path.join(__dirname, "..", "templates", "news-template.md");
const outputPath = path.join(
  __dirname,
  "..",
  "src",
  "content",
  "news",
  filename
);

if (!fs.existsSync(templatePath)) {
  console.error(`エラー: テンプレートファイルが見つかりません: ${templatePath}`);
  process.exit(1);
}

if (fs.existsSync(outputPath)) {
  console.error(`エラー: ファイルが既に存在します: ${outputPath}`);
  process.exit(1);
}

const template = fs
  .readFileSync(templatePath, "utf-8")
  .replace(/{{DATETIME}}/g, new Date().toISOString());

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, template, "utf-8");

console.log(`✅ ニュースを作成しました: ${outputPath}`);
console.log("📝 frontmatter と本文を編集してください");
console.log("💡 公開する場合は、frontmatter の published を true に変更してください");
