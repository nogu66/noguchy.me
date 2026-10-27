#!/usr/bin/env node
// Wrap the Commit Quest game (written as a claude.ai Artifact page, which has no
// <html>/<head>/<body>) into a full document with OGP tags at
// public/commit-quest/index.html, and render ogp.html to public/commit-quest/ogp.png.
//
// usage: node tools/commit-quest/build.mjs [path/to/game.html]
//   default source: ~/workspace/commit-quest/index.html
// needs: Google Chrome (set CHROME to override the binary)
// Run `pnpm run format` afterwards; Prettier checks public/.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(root, "public/commit-quest");
const src =
  process.argv[2] ?? path.join(homedir(), "workspace/commit-quest/index.html");
const chrome =
  process.env.CHROME ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const url = "https://noguchy.me/commit-quest/";
const title = "コミット・クエスト";
const desc =
  "パン屋のホームページ作りを手伝いながら、本物の git コマンドを打って覚える学習ゲーム。コミットグラフと作業台・ステージ・リポジトリの動きが目の前で見える。全 21 レベル、ブラウザでそのまま遊べます。";

const game = readFileSync(src, "utf8");
const cut = game.indexOf("</style>") + "</style>".length;
const head = game
  .slice(0, cut)
  .replace(/<title>[\s\S]*?<\/title>\n?/, "")
  .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, "")
  // the Artifact skeleton supplied these resets
  .replace("<style>", "<style>\nbody{margin:0}\nimg{max-width:100%}");
const body = game.slice(cut).trim();
// the game references its illustrations as relative assets/…; pin them to the page's
// folder so /commit-quest (no trailing slash) still finds them
const pin = s => s.replace(/(["'(`])assets\//g, "$1/commit-quest/assets/");

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title} | Git をゲームで覚える</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${url}">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="noguchy.me">
<meta property="og:locale" content="ja_JP">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${title} | Git をゲームで覚える">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${url}ogp.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="コミット・クエスト。Git をゲームで覚える、全 21 レベル">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@_nogu66">
<meta name="twitter:creator" content="@_nogu66">
<meta name="twitter:title" content="${title} | Git をゲームで覚える">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${url}ogp.png">
<link rel="preload" as="image" href="/commit-quest/assets/hero-bakery.webp">
${pin(head.trim())}
</head>
<body>
${pin(body)}
</body>
</html>
`;

mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "index.html"), html);
// copy the webp illustrations (the raw PNGs stay in the game folder)
const assets = path.join(path.dirname(src), "assets");
mkdirSync(path.join(out, "assets"), { recursive: true });
for (const f of readdirSync(assets).filter(f => f.endsWith(".webp")))
  copyFileSync(path.join(assets, f), path.join(out, "assets", f));
execFileSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--virtual-time-budget=8000",
    "--window-size=1200,630",
    `--screenshot=${path.join(out, "ogp.png")}`,
    pathToFileURL(path.join(here, "ogp.html")).href,
  ],
  { stdio: "ignore" }
);
process.stdout.write(`${out}/index.html\n${out}/ogp.png\n`);
