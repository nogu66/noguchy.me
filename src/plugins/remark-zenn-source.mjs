/**
 * 標準パースで壊れる Zenn 構文をソース段階で raw HTML に変換し、再パースする。
 * - :::message / :::message alert / :::details タイトル（::::によるネスト対応）
 * - ![alt](url =250x) / ![alt](url =250x100) の画像幅指定
 */
export default function remarkZennSource() {
  const parse = this.parse.bind(this);
  return (tree, file) => {
    const original = String(file.value);
    const hasContainer = /^\s*:{3,}\S/m.test(original);
    const hasImageSize = /=\d+x\d*\)/.test(original);
    if (!hasContainer && !hasImageSize) return;

    // 先頭フロントマターは変換対象から除外（残っていれば）
    const fmMatch = original.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    const front = fmMatch ? fmMatch[0] : "";
    const body = original.slice(front.length);

    const transformed = transformSource(body);
    if (transformed === body) return;

    const newTree = parse(transformed);
    tree.children = newTree.children;
  };
}

function transformSource(src) {
  const lines = src.split("\n");
  const out = [];
  const stack = []; // { colons: number, close: string }

  for (let line of lines) {
    const fence = line.match(/^(:{3,})(.*)$/);
    if (fence) {
      const colons = fence[1].length;
      const rest = fence[2].trim();

      if (rest === "") {
        // 閉じフェンス（同じコロン数なら閉じる）
        if (stack.length && stack[stack.length - 1].colons === colons) {
          const top = stack.pop();
          out.push("", top.close, "");
          continue;
        }
      } else {
        // 開きフェンス
        const sp = rest.indexOf(" ");
        const name = sp === -1 ? rest : rest.slice(0, sp);
        const arg = sp === -1 ? "" : rest.slice(sp + 1).trim();
        const tags = openTags(name, arg);
        if (tags) {
          out.push("", tags.open, "");
          stack.push({ colons, close: tags.close });
          continue;
        }
      }
    }
    out.push(transformImageWidth(line));
  }

  // 閉じ忘れを補完
  while (stack.length) {
    out.push("", stack.pop().close, "");
  }
  return out.join("\n");
}

function openTags(name, arg) {
  if (name === "message") {
    const variant = arg === "alert" ? "zenn-msg-alert" : "zenn-msg-info";
    return {
      open: `<div class="zenn-msg ${variant}"><div class="zenn-msg-body">`,
      close: `</div></div>`,
    };
  }
  if (name === "details") {
    const title = escapeHtml(arg || "詳細");
    return {
      open: `<details class="zenn-details"><summary>${title}</summary><div class="zenn-details-body">`,
      close: `</div></details>`,
    };
  }
  return null;
}

function transformImageWidth(line) {
  return line.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\s+=(\d+)x(\d*)\)/g,
    (_, alt, url, w, h) => {
      const height = h ? ` height="${h}"` : "";
      return `<img src="${url}" alt="${escapeHtml(alt)}" width="${w}"${height} />`;
    }
  );
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
