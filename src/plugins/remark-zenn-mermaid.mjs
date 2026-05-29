import { visit } from "unist-util-visit";

/**
 * ```mermaid コードブロックを <pre class="mermaid"> の raw HTML ノードに変換する。
 * code ノードを html ノードに置換することで Shiki のハイライト対象から外し、
 * クライアント側の mermaid.run() がそのまま図に描画できるようにする。
 */
export default function remarkZennMermaid() {
  return tree => {
    visit(tree, "code", (node, index, parent) => {
      if (node.lang !== "mermaid" || !parent || index === null) return;
      parent.children[index] = {
        type: "html",
        value: `<pre class="mermaid">${escapeHtml(node.value)}</pre>`,
      };
    });
  };
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
