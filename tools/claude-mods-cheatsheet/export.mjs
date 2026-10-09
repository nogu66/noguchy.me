#!/usr/bin/env node
// Export cheatsheet.html to PNG, SVG and a WebP preview, in Japanese and English,
// and ogp.html to the pages' OGP card.
//
// usage: node tools/claude-mods-cheatsheet/export.mjs
// needs: Google Chrome (set CHROME to override the binary), pdftocairo (brew install
//        poppler), sharp (a site dependency)
//
// The SVG goes through Chrome's PDF output and pdftocairo, so its text is outlined
// and looks the same on any machine. Edit the HTML, not the SVG.
//
// The version and date printed on the sheet come from
// src/data/claude-mods-cheatsheet.json, which the site pages read too.
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(root, "public/claude-mods-cheatsheet");
const meta = JSON.parse(
  readFileSync(path.join(root, "src/data/claude-mods-cheatsheet.json"), "utf8")
);
const chrome =
  process.env.CHROME ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const W = 2480;
const H = 3508;
const common = [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--virtual-time-budget=8000",
];

for (const lang of ["ja", "en"]) {
  const src = pathToFileURL(path.join(here, "cheatsheet.html"));
  src.search = new URLSearchParams({
    lang,
    export: "1",
    v: meta.version,
    date: meta.date,
  }).toString();
  const base = path.join(out, `claude-mods-cheatsheet-${lang}`);
  execFileSync(
    chrome,
    [...common, `--window-size=${W},${H}`, `--screenshot=${base}.png`, src.href],
    { stdio: "ignore" }
  );
  execFileSync(
    chrome,
    [...common, "--no-pdf-header-footer", `--print-to-pdf=${base}.pdf`, src.href],
    { stdio: "ignore" }
  );
  execFileSync("pdftocairo", ["-svg", `${base}.pdf`, `${base}.svg`]);
  rmSync(`${base}.pdf`);
  await sharp(`${base}.png`)
    .resize({ width: 1240 })
    .webp({ quality: 82 })
    .toFile(`${base}.webp`);
  process.stdout.write(`${base}.{png,svg,webp}  v${meta.version}  ${meta.date}\n`);
}

const ogp = pathToFileURL(path.join(here, "ogp.html"));
execFileSync(
  chrome,
  [
    ...common,
    "--window-size=1200,630",
    `--screenshot=${path.join(out, "ogp.png")}`,
    ogp.href,
  ],
  { stdio: "ignore" }
);
process.stdout.write(`${path.join(out, "ogp.png")}\n`);
