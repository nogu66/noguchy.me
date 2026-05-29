import { visit } from "unist-util-visit";

/**
 * Zenn のコードブロック記法を Shiki が解釈できるメタに変換する。
 * - ```lang:ファイル名      → lang + `file="ファイル名"`（既存 fileName transformer 用）
 * - ```diff lang[:file]     → lang を実言語にし、+/- 行番号を zenn-diff メタに格納
 */
export default function remarkZennCode() {
  return tree => {
    visit(tree, "code", node => {
      if (!node.lang) return;

      // ```diff lang[:file]
      if (node.lang === "diff") {
        const tokens = (node.meta || "").trim().split(/\s+/).filter(Boolean);
        const langToken = tokens.shift(); // "js" or "js:foo.js" or undefined
        if (!langToken) return; // 素の diff は Shiki の diff 言語に任せる
        const [realLang, ...fileParts] = langToken.split(":");
        node.lang = realLang;
        const file = fileParts.join(":");
        const { add, del } = collectDiffLines(node.value);
        const pieces = [...tokens];
        if (file) pieces.push(`file="${file}"`);
        pieces.push("zenn-diff");
        if (add.length) pieces.push(`zenn-diff-add="${add.join(",")}"`);
        if (del.length) pieces.push(`zenn-diff-del="${del.join(",")}"`);
        node.meta = pieces.join(" ");
        return;
      }

      // ```lang:ファイル名
      if (node.lang.includes(":")) {
        const [realLang, ...fileParts] = node.lang.split(":");
        node.lang = realLang;
        const file = fileParts.join(":");
        node.meta = [node.meta, `file="${file}"`].filter(Boolean).join(" ");
      }
    });
  };
}

/** value の各行先頭の +/- を見て 1 始まりの行番号を集める（マーカー文字は残す） */
function collectDiffLines(code) {
  const add = [];
  const del = [];
  code.split("\n").forEach((line, i) => {
    if (line.startsWith("+")) add.push(i + 1);
    else if (line.startsWith("-")) del.push(i + 1);
  });
  return { add, del };
}
