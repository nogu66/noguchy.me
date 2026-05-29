import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

/**
 * remark プラグインを与えて Markdown → HTML 文字列に変換するテスト用ヘルパー。
 * plugins は [plugin, options?] のタプル配列。
 */
export async function render(md, plugins = []) {
  const processor = unified().use(remarkParse).use(remarkGfm);
  for (const entry of plugins) {
    const [plugin, options] = Array.isArray(entry) ? entry : [entry];
    processor.use(plugin, options);
  }
  processor
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true });
  const file = await processor.process(md);
  return String(file);
}
