/**
 * remark-zenn-code が付与した zenn-diff メタを読み、
 * 指定行に `diff add` / `diff remove` クラスを付ける Shiki transformer。
 * 既存の notation diff と同じクラス名を使うため CSS を共有できる。
 */
export const transformerZennDiff = () => ({
  name: "zenn-diff",
  line(node, line) {
    const raw = this.options.meta?.__raw || "";
    if (!raw.includes("zenn-diff")) return;
    const add = parseLineList(raw, "zenn-diff-add");
    const del = parseLineList(raw, "zenn-diff-del");
    if (add.includes(line)) this.addClassToHast(node, "diff add");
    else if (del.includes(line)) this.addClassToHast(node, "diff remove");
  },
});

function parseLineList(raw, key) {
  const match = raw.match(new RegExp(`${key}="([^"]*)"`));
  if (!match) return [];
  return match[1].split(",").map(Number);
}
