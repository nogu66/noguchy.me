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
      if (
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
          const html = providerEmbed(provider, arg);
          if (html) {
            a.value = a.value.slice(0, -1);
            node.children[i + 1] = { type: "html", value: html };
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
  const ogp = await fetchOgp(url);
  if (ogp) return { type: "html", value: linkCard(url, ogp) };
  return {
    type: "paragraph",
    children: [{ type: "link", url, children: [{ type: "text", value: url }] }],
  };
}

/** @[provider](arg) → 埋め込み HTML */
function providerEmbed(provider, arg) {
  switch (provider) {
    case "youtube":
      return youtubeIframe(arg);
    case "tweet":
      return tweetEmbed(arg);
    case "github":
      return `<a href="${escapeAttr(arg)}">${escapeHtml(arg)}</a>`;
    case "card":
      return `<a class="zenn-link-card-fallback" href="${escapeAttr(arg)}">${escapeHtml(arg)}</a>`;
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
    return tweetEmbed(url);
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

async function fetchOgp(url) {
  if (ogpCache.has(url)) return ogpCache.get(url);
  let result = null;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "noguchy.me-ogp-bot" },
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
