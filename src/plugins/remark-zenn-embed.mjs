import { visit } from "unist-util-visit";

const ogpCache = new Map();
/** テスト用にキャッシュをクリアする */
export function __clearCache() {
  ogpCache.clear();
}

/**
 * 裸 URL（単独行）と @[provider](arg) を埋め込み/リンクカードに変換する。
 * - YouTube / X(Twitter) / GitHub / Gist: 既知プロバイダの埋め込み
 * - それ以外の URL: ビルド時に OGP を取得してカード化（失敗時は通常リンク）
 */
export default function remarkZennEmbed() {
  return async tree => {
    const tasks = [];

    visit(tree, "paragraph", (node, index, parent) => {
      if (!parent || index === null) return;

      // パターン1: 裸 URL（段落が単一リンクで、表示テキスト === URL）
      // Zenn 互換: トップレベルの単独行のみカード化（箇条書き・文中・引用内は除外）
      if (
        parent.type === "root" &&
        node.children.length === 1 &&
        node.children[0].type === "link" &&
        node.children[0].children.length === 1 &&
        node.children[0].children[0].type === "text" &&
        node.children[0].children[0].value === node.children[0].url
      ) {
        const url = node.children[0].url;
        tasks.push(async () => {
          parent.children[index] = await urlToNode(url);
        });
        return;
      }

      // パターン2: @[provider](arg)（text が "@" で終わり + 直後が link）
      for (let i = 0; i < node.children.length - 1; i++) {
        const a = node.children[i];
        const b = node.children[i + 1];
        if (
          a.type === "text" &&
          a.value.endsWith("@") &&
          b.type === "link" &&
          b.children[0]?.type === "text"
        ) {
          const provider = b.children[0].value;
          const arg = b.url;
          if (provider === "youtube" || provider === "tweet") {
            a.value = a.value.slice(0, -1);
            node.children[i + 1] = {
              type: "html",
              value: providerEmbed(provider, arg),
            };
          } else if (provider === "card" || provider === "github") {
            a.value = a.value.slice(0, -1);
            const childIndex = i + 1;
            tasks.push(async () => {
              node.children[childIndex] = await urlToNode(arg);
            });
          }
        }
      }
    });

    await Promise.all(tasks.map(t => t()));
  };
}

/** 裸 URL を埋め込み or OGP カード or 通常リンクのノードに変換 */
async function urlToNode(url) {
  const known = providerEmbedFromUrl(url);
  if (known) return { type: "html", value: known };
  const ogp = await fetchOgp(url, ogpUserAgent(url));
  if (ogp) {
    if (isGithubUrl(url)) return { type: "html", value: githubCard(url, ogp) };
    if (isXUrl(url)) return { type: "html", value: xCard(url, ogp) };
    return { type: "html", value: linkCard(url, ogp) };
  }
  return {
    type: "paragraph",
    children: [{ type: "link", url, children: [{ type: "text", value: url }] }],
  };
}

/** github.com 配下の URL（リポジトリ/ファイル/PR/Issue 等）か。gist は対象外 */
function isGithubUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname.replace(/^www\./, "") === "github.com" && u.pathname.length > 1
    );
  } catch {
    return false;
  }
}

/** x.com / twitter.com の URL か（ツイートは別途埋め込みになる） */
function isXUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "x.com" || host === "twitter.com";
  } catch {
    return false;
  }
}

const DEFAULT_UA = "noguchy.me-ogp-bot";
// X はクローラー UA でないと OGP メタを返さないため Twitterbot を名乗る
const X_UA = "Mozilla/5.0 (compatible; Twitterbot/1.0)";

/** URL に応じた OGP 取得用 User-Agent を返す */
function ogpUserAgent(url) {
  return isXUrl(url) ? X_UA : DEFAULT_UA;
}

/** @[provider](arg) → 埋め込み HTML */
function providerEmbed(provider, arg) {
  switch (provider) {
    case "youtube":
      return youtubeIframe(arg);
    case "tweet":
      return tweetEmbed(arg);
    default:
      return null;
  }
}

/** 裸 URL → 既知プロバイダ埋め込み HTML（無ければ null） */
function providerEmbedFromUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com") {
    const id = u.searchParams.get("v");
    return id ? youtubeIframe(id) : null;
  }
  if (host === "youtu.be") {
    return youtubeIframe(u.pathname.slice(1));
  }
  if (host === "twitter.com" || host === "x.com") {
    // ツイートは埋め込み、それ以外（プロフィール等）は OGP カードに回す
    if (/\/status\/\d+/.test(u.pathname)) return tweetEmbed(url);
    return null;
  }
  if (host === "gist.github.com") {
    return `<script src="${escapeAttr(url)}.js"></script>`;
  }
  return null;
}

function youtubeIframe(id) {
  const safe = encodeURIComponent(id);
  return (
    `<div class="zenn-embed zenn-embed-youtube">` +
    `<iframe src="https://www.youtube.com/embed/${safe}" ` +
    `title="YouTube video player" frameborder="0" allowfullscreen loading="lazy"></iframe>` +
    `</div>`
  );
}

function tweetEmbed(url) {
  return (
    `<blockquote class="twitter-tweet"><a href="${escapeAttr(url)}">${escapeHtml(url)}</a></blockquote>` +
    `<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`
  );
}

function linkCard(url, { title, description, image }) {
  const img = image
    ? `<div class="zenn-link-card-image"><img src="${escapeAttr(image)}" alt="" loading="lazy" /></div>`
    : "";
  const desc = description
    ? `<p class="zenn-link-card-desc">${escapeHtml(description)}</p>`
    : "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    host = url;
  }
  return (
    `<a class="zenn-link-card" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">` +
    `<div class="zenn-link-card-body">` +
    `<p class="zenn-link-card-title">${escapeHtml(title)}</p>` +
    desc +
    `<p class="zenn-link-card-host">${escapeHtml(host)}</p>` +
    `</div>` +
    img +
    `</a>`
  );
}

// GitHub マーク（octicon mark-github）
const GITHUB_MARK_SVG =
  `<svg class="zenn-link-card-github-mark" viewBox="0 0 16 16" width="20" height="20" aria-hidden="true">` +
  `<path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>` +
  `</svg>`;

/** GitHub 専用カード: 公式 OGP 画像を大きく見せ、GitHub マークで他リンクと区別する */
function githubCard(url, { title, image }) {
  const img = image
    ? `<div class="zenn-link-card-github-image"><img src="${escapeAttr(image)}" alt="" loading="lazy" /></div>`
    : "";
  return (
    `<a class="zenn-link-card zenn-link-card-github" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">` +
    img +
    `<div class="zenn-link-card-github-footer">` +
    GITHUB_MARK_SVG +
    `<span class="zenn-link-card-github-title">${escapeHtml(title)}</span>` +
    `</div>` +
    `</a>`
  );
}

// X（旧 Twitter）マーク
const X_MARK_SVG =
  `<svg class="zenn-link-card-x-mark" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">` +
  `<path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>` +
  `</svg>`;

/** X 専用カード: プロフィール等の OGP（アバター + bio）を X マーク付きで表示 */
function xCard(url, { title, description, image }) {
  const img = image
    ? `<div class="zenn-link-card-image"><img src="${escapeAttr(image)}" alt="" loading="lazy" /></div>`
    : "";
  const desc = description
    ? `<p class="zenn-link-card-desc">${escapeHtml(description)}</p>`
    : "";
  let host = "x.com";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    host = "x.com";
  }
  return (
    `<a class="zenn-link-card zenn-link-card-x" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">` +
    `<div class="zenn-link-card-body">` +
    `<p class="zenn-link-card-title">${escapeHtml(title)}</p>` +
    desc +
    `<p class="zenn-link-card-host">${X_MARK_SVG}<span>${escapeHtml(host)}</span></p>` +
    `</div>` +
    img +
    `</a>`
  );
}

async function fetchOgp(url, userAgent = DEFAULT_UA) {
  if (ogpCache.has(url)) return ogpCache.get(url);
  let result = null;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": userAgent },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const html = await res.text();
      const title = metaContent(html, "og:title") || htmlTitle(html) || url;
      const description = metaContent(html, "og:description") || "";
      const image = metaContent(html, "og:image") || "";
      result = { title, description, image };
    }
  } catch {
    result = null;
  }
  ogpCache.set(url, result);
  return result;
}

function metaContent(html, property) {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
  }
  return "";
}

function htmlTitle(html) {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? decodeEntities(m[1].trim()) : "";
}

function decodeEntities(str) {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
