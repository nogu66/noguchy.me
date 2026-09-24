import { visit, EXIT } from "unist-util-visit";

/**
 * remark-math が数式ノードを生成した記事だけ frontmatter.hasMath = true を立てる。
 * PostDetails はこれを見て KaTeX CSS を読み込む（本文の "$" 有無では誤検出するため）。
 * remark-math より後ろに登録すること。
 */
export default function remarkHasMath() {
  return (tree, file) => {
    let hasMath = false;
    visit(tree, ["math", "inlineMath"], () => {
      hasMath = true;
      return EXIT;
    });
    const astro = (file.data.astro ??= {});
    astro.frontmatter = { ...astro.frontmatter, hasMath };
  };
}
