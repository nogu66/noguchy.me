#!/usr/bin/env node
/* eslint-disable no-console */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ブログ記事を作成するスクリプト
 * 使い方: npm run new-post <ファイル名>
 * 例: npm run new-post my-first-post
 */

// コマンドライン引数からファイル名を取得
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("エラー: ファイル名を指定してください");
  console.log("使い方: npm run new-post <ファイル名>");
  console.log("例: npm run new-post my-first-post");
  process.exit(1);
}

const filename = args[0];

// .md拡張子がない場合は追加
const mdFilename = filename.endsWith(".md") ? filename : `${filename}.md`;

// パスの設定
const templatePath = path.join(__dirname, "..", "templates", "blog-template.md");
const outputPath = path.join(
  __dirname,
  "..",
  "src",
  "content",
  "blog",
  mdFilename
);

// テンプレートファイルが存在するか確認
if (!fs.existsSync(templatePath)) {
  console.error(`エラー: テンプレートファイルが見つかりません: ${templatePath}`);
  process.exit(1);
}

// 出力ファイルが既に存在するか確認
if (fs.existsSync(outputPath)) {
  console.error(`エラー: ファイルが既に存在します: ${outputPath}`);
  process.exit(1);
}

// テンプレートを読み込む
let template = fs.readFileSync(templatePath, "utf-8");

// 現在の日時を ISO 8601 形式で生成
const now = new Date();
const datetime = now.toISOString();

// {{DATETIME}} を置換
template = template.replace(/{{DATETIME}}/g, datetime);

// 出力ディレクトリが存在しない場合は作成
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// ファイルを作成
fs.writeFileSync(outputPath, template, "utf-8");

console.log(`✅ ブログ記事を作成しました: ${outputPath}`);
console.log(`📝 記事を編集してください`);
console.log(`💡 公開する場合は、frontmatter の draft を false に変更してください`);
