/**
 * remark-zenn-code が付与した zenn-diff メタを読み、
 * 指定行に `diff add` / `diff remove` クラスを付ける Shiki transformer。
 * 既存の notation diff と同じクラス名を使うため CSS を共有できる。
 */
export const transformerZennDiff = () => ({
  name: "zenn-diff",
  code() {
    const raw = this.options.meta?.__raw || "";
    if (!raw.includes("zenn-diff")) {
      this._zennDiffAdd = null;
      this._zennDiffDel = null;
      return;
    }
    this._zennDiffAdd = new Set(parseLineList(raw, "zenn-diff-add"));
    this._zennDiffDel = new Set(parseLineList(raw, "zenn-diff-del"));
  },
  line(node, line) {
    if (!this._zennDiffAdd) return;
    if (this._zennDiffAdd.has(line)) this.addClassToHast(node, "diff add");
    else if (this._zennDiffDel.has(line))
      this.addClassToHast(node, "diff remove");
  },
});

function parseLineList(raw, key) {
  const match = raw.match(new RegExp(`${key}="([^"]*)"`));
  if (!match) return [];
  return match[1].split(",").map(Number);
}
