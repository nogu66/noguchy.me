import { visit } from "unist-util-visit";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * 本文中の <img> に loading / decoding を付け、public/ 配下のローカル画像には
 * 実寸の width / height を補って CLS を防ぐ。
 * 先頭の画像は LCP 候補になり得るので lazy にしない。
 * width / height のどちらかが既に指定されている画像（`=250x` 記法など）は寸法を触らない。
 */
export default function rehypeContentImages({
  publicDir = path.resolve("public"),
} = {}) {
  const sizeCache = new Map();

  async function getSize(src) {
    if (!sizeCache.has(src)) {
      sizeCache.set(src, readSize(publicDir, src));
    }
    return sizeCache.get(src);
  }

  return async tree => {
    const images = [];
    visit(tree, "element", node => {
      if (node.tagName === "img") images.push(node);
    });

    await Promise.all(
      images.map(async (node, i) => {
        const props = node.properties;
        if (i > 0) props.loading ??= "lazy";
        props.decoding ??= "async";

        const src = typeof props.src === "string" ? props.src : "";
        if (props.width != null || props.height != null) return;
        if (!src.startsWith("/") || src.startsWith("//")) return;

        const size = await getSize(src);
        if (size) {
          props.width = size.width;
          props.height = size.height;
        }
      })
    );
  };
}

async function readSize(publicDir, src) {
  let pathname;
  try {
    pathname = decodeURIComponent(src.split(/[?#]/)[0]);
  } catch {
    return null;
  }
  const file = path.join(publicDir, pathname);
  if (!file.startsWith(publicDir) || !existsSync(file)) return null;
  try {
    const { width, height } = await sharp(file).metadata();
    return width && height ? { width, height } : null;
  } catch {
    return null;
  }
}
