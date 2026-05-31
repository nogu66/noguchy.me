import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";

/**
 * 画像のみ、もしくは「画像 + 直後の *caption*」で構成される段落を
 * <figure>（+ <figcaption>）の raw HTML に変換する。
 * キャプションが無い画像は変換せず Astro の画像最適化に任せる。
 */
export default function remarkZennFigure() {
  return tree => {
    visit(tree, "paragraph", (node, index, parent) => {
      if (!parent || index === null) return;
      const children = node.children;
      const image = children[0];
      if (!image || image.type !== "image") return;

      // 画像の後ろにある空白テキストを無視し、残りを取得
      const rest = children
        .slice(1)
        .filter(n => !(n.type === "text" && /^\s*$/.test(n.value)));

      let caption = null;
      if (rest.length === 0) return; // キャプション無し → 変換しない
      if (rest.length === 1 && rest[0].type === "emphasis") {
        caption = toString(rest[0]);
      } else {
        return; // 想定外の構成は触らない
      }

      const alt = escapeHtml(image.alt || "");
      const title = image.title ? ` title="${escapeHtml(image.title)}"` : "";
      parent.children[index] = {
        type: "html",
        value:
          `<figure class="zenn-figure">` +
          `<img src="${escapeHtml(image.url)}" alt="${alt}"${title} />` +
          `<figcaption>${escapeHtml(caption)}</figcaption>` +
          `</figure>`,
      };
    });
  };
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
