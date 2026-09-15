#!/usr/bin/env node
/* eslint-disable no-console */
import path from "node:path";
import os from "node:os";
import {
  mkdir,
  mkdtemp,
  writeFile,
  access,
  rename,
  readFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.platform !== "darwin")
  throw new Error("このインストーラはmacOS専用です。");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const applications = path.join(os.homedir(), "Applications");
const destination = path.join(applications, "News Studio.app");
const pnpm = execFileSync("/usr/bin/which", ["pnpm"], {
  encoding: "utf8",
}).trim();
const temporary = await mkdtemp(path.join(os.tmpdir(), "news-studio-build-"));
const bundle = path.join(temporary, "News Studio.app");
const contents = path.join(bundle, "Contents");
const resources = path.join(contents, "Resources");
await mkdir(path.join(contents, "MacOS"), { recursive: true });
await mkdir(resources, { recursive: true });
const xml = value =>
  value.replace(
    /[<>&"']/g,
    character =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[character]
  );
const plist = object =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>${Object.entries(
    object
  )
    .map(
      ([key, value]) => `<key>${xml(key)}</key><string>${xml(value)}</string>`
    )
    .join("")}</dict></plist>`;
await writeFile(
  path.join(contents, "Info.plist"),
  plist({
    CFBundleIdentifier: "me.noguchy.news-studio",
    CFBundleName: "News Studio",
    CFBundleDisplayName: "News Studio",
    CFBundleExecutable: "NewsStudio",
    CFBundlePackageType: "APPL",
    CFBundleShortVersionString: "1.0",
    CFBundleVersion: "1",
    CFBundleIconFile: "Studio.icns",
    NSHumanReadableCopyright: "noguchy.me",
    LSMinimumSystemVersion: "13.0",
  })
);
await writeFile(
  path.join(resources, "LocalConfig.plist"),
  plist({ Repository: root, Node: process.execPath, Pnpm: pnpm })
);
console.log("News Studio.app を作成しています…");
execFileSync(
  "/usr/bin/swiftc",
  [
    "-swift-version",
    "5",
    "-O",
    path.join(root, "tools/news-editor/mac/NewsStudio.swift"),
    "-o",
    path.join(contents, "MacOS/NewsStudio"),
    "-framework",
    "AppKit",
    "-framework",
    "WebKit",
  ],
  { stdio: "inherit" }
);
const iconset = path.join(temporary, "Studio.iconset");
await mkdir(iconset);
const master = path.join(temporary, "icon.png");
execFileSync(
  "/usr/bin/swift",
  [path.join(root, "tools/news-editor/mac/Icon.swift"), master],
  { stdio: "inherit" }
);
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    execFileSync(
      "/usr/bin/sips",
      [
        "-z",
        String(size * scale),
        String(size * scale),
        master,
        "--out",
        path.join(
          iconset,
          `icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`
        ),
      ],
      { stdio: "ignore" }
    );
  }
}
execFileSync("/usr/bin/iconutil", [
  "-c",
  "icns",
  iconset,
  "-o",
  path.join(resources, "Studio.icns"),
]);
execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", bundle], {
  stdio: "inherit",
});
await mkdir(applications, { recursive: true });
let exists = false;
try {
  await access(destination);
  exists = true;
} catch {
  /* First installation. */
}
if (exists) {
  const info = await readFile(
    path.join(destination, "Contents/Info.plist"),
    "utf8"
  );
  if (!info.includes("me.noguchy.news-studio"))
    throw new Error("同名の別アプリがあるため上書きできません。");
  const backup = path.join(root, ".local/news-editor/app-backups");
  await mkdir(backup, { recursive: true });
  await rename(destination, path.join(backup, `News Studio-${Date.now()}.app`));
}
await rename(bundle, destination);
console.log(
  `インストールしました: ${destination}\nダブルクリックで起動できます。Dockにドラッグして登録できます。`
);
