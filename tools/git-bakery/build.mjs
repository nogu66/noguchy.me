#!/usr/bin/env node
// Wrap the Commit Quest game (written as a claude.ai Artifact page, which has no
// <html>/<head>/<body>) into a full document with OGP tags at
// public/git-bakery/index.html, and render ogp.html to public/git-bakery/ogp.png.
//
// usage: node tools/git-bakery/build.mjs [path/to/game.html]
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
const out = path.join(root, "public/git-bakery");
const src =
  process.argv[2] ?? path.join(homedir(), "workspace/commit-quest/index.html");
const chrome =
  process.env.CHROME ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const url = "https://noguchy.me/git-bakery/";
const title = "Git ベーカリー";
const desc =
  "Git は、ファイルの変更を記録しておき、あとから見返したり元に戻したりできる道具。町のパン屋さんのホームページ作りを手伝いながら、その使い方をゲームで覚えます。全 21 レベル、ブラウザでそのまま遊べます。";

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
// folder so /git-bakery (no trailing slash) still finds them
const pin = s => s.replace(/(["'(`])assets\//g, "$1/git-bakery/assets/");

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title} | パン屋さんで覚える Git</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${url}">
<link rel="icon" type="image/png" sizes="32x32" href="/git-bakery/assets/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/git-bakery/assets/favicon-192.png">
<link rel="apple-touch-icon" href="/git-bakery/assets/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="noguchy.me">
<meta property="og:locale" content="ja_JP">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${title} | パン屋さんで覚える Git">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${url}ogp.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Git ベーカリー。パン屋さんで覚える Git、全 21 レベル">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@_nogu66">
<meta name="twitter:creator" content="@_nogu66">
<meta name="twitter:title" content="${title} | パン屋さんで覚える Git">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${url}ogp.png">
<link rel="preload" as="image" href="/git-bakery/assets/hero-bakery.webp">
${pin(head.trim())}
</head>
<body>
${pin(body)}
</body>
</html>
`;

mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "index.html"), html);
// copy the webp illustrations and the cat favicons (the raw PNGs stay in the game folder)
const assets = path.join(path.dirname(src), "assets");
mkdirSync(path.join(out, "assets"), { recursive: true });
for (const f of readdirSync(assets).filter(
  f => f.endsWith(".webp") || /^(favicon-|apple-touch-icon)/.test(f)
))
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
