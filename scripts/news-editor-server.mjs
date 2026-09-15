#!/usr/bin/env node
/* eslint-disable no-console */
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createNewsStore, EditorError } from "./news-editor-store.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.NEWS_EDITOR_PORT || 4323);
const host = `127.0.0.1:${port}`;
const origin = `http://${host}`;
const store = createNewsStore(root);
let deployPromise = null;

function deployNews() {
  if (deployPromise) throw new EditorError("すでに公開処理を実行中です。", 409);
  const packageManager =
    process.env.NEWS_EDITOR_PNPM || process.env.npm_execpath;
  const command = packageManager ? process.execPath : "pnpm";
  const args = packageManager
    ? [packageManager, "run", "deploy:news"]
    : ["run", "deploy:news"];
  deployPromise = new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, CI: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const collect = chunk => {
      output = `${output}${chunk}`.slice(-12_000);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", error => reject(error));
    child.on("close", code => {
      if (code === 0) {
        resolve({
          message: "公開しました。news.noguchy.meに反映されています。",
        });
      } else {
        reject(
          new EditorError(
            `公開に失敗しました。Cloudflareへのログイン状態とログを確認してください。\n${output.trim().slice(-2_000)}`,
            502
          )
        );
      }
    });
  }).finally(() => {
    deployPromise = null;
  });
  return deployPromise;
}

async function readBody(req, limit) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new EditorError("送信内容が大きすぎます。", 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = await createServer({
  configFile: false,
  root: path.join(root, "tools/news-editor"),
  publicDir: false,
  cacheDir: path.join(root, ".local/news-editor/vite"),
  server: { host: "127.0.0.1", port, strictPort: true, cors: false },
  plugins: [
    {
      name: "local-news-editor",
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          const send = (status, data) => {
            res.writeHead(status, {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            });
            res.end(JSON.stringify(data));
          };
          try {
            if (
              req.headers.host !== host ||
              (req.headers.origin && req.headers.origin !== origin) ||
              req.headers["sec-fetch-site"] === "cross-site"
            ) {
              return send(403, {
                error: "ローカルの編集画面からアクセスしてください。",
              });
            }
            const url = new URL(req.url, origin);
            if (req.method === "GET" && url.pathname === "/api/health") {
              return send(200, { app: "noguchy-news-studio", root });
            }
            if (req.method === "GET" && url.pathname.startsWith("/images/")) {
              const image = await store.image(
                decodeURIComponent(url.pathname.slice(8))
              );
              res.writeHead(200, {
                "Content-Type": image.mime,
                "X-Content-Type-Options": "nosniff",
              });
              return res.end(image.buffer);
            }
            if (!url.pathname.startsWith("/api/")) return next();
            if (req.method === "GET" && url.pathname === "/api/articles")
              return send(200, await store.list());
            if (req.method === "GET" && url.pathname === "/api/article")
              return send(200, await store.read(url.searchParams.get("id")));
            if (req.method === "POST" && url.pathname === "/api/article") {
              if (req.headers["content-type"] !== "application/json")
                throw new EditorError("JSON形式で送信してください。");
              const data = JSON.parse(
                (await readBody(req, 2 * 1024 * 1024)).toString("utf8")
              );
              return send(200, await store.save(data));
            }
            if (req.method === "POST" && url.pathname === "/api/deploy")
              return send(200, await deployNews());
            if (req.method === "POST" && url.pathname === "/api/images") {
              if (!req.headers["content-type"]?.startsWith("image/"))
                throw new EditorError("画像ファイルを選択してください。");
              return send(
                201,
                await store.upload(await readBody(req, 10 * 1024 * 1024))
              );
            }
            return send(404, { error: "見つかりません。" });
          } catch (error) {
            if (!(error instanceof EditorError)) console.error(error);
            send(error instanceof EditorError ? error.status : 500, {
              error:
                error instanceof EditorError
                  ? error.message
                  : "処理に失敗しました。入力内容を確認するか、再度お試しください。",
            });
          }
        });
      },
    },
  ],
});
await server.listen();
console.log(
  `\n  noguchy.me News Studio\n  ${origin}\n\n  このMac上で記事を編集・保存できます。\n`
);
