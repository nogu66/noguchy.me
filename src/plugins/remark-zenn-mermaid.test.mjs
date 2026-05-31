import { describe, it, expect } from "vitest";
import { render } from "./test-helper.mjs";
import remarkZennMermaid from "./remark-zenn-mermaid.mjs";

describe("remark-zenn-mermaid", () => {
  it("converts a mermaid code block into a pre.mermaid element", async () => {
    const md = "```mermaid\ngraph TD\n  A-->B\n```\n";
    const html = await render(md, [remarkZennMermaid]);
    expect(html).toContain('<pre class="mermaid"');
    expect(html).toContain("graph TD");
    expect(html).not.toContain("<code");
  });

  it("escapes html-sensitive chars in the diagram source", async () => {
    const md = "```mermaid\ngraph LR\n  a --> b & c\n```\n";
    const html = await render(md, [remarkZennMermaid]);
    expect(html).toContain("&amp;");
  });

  it("leaves non-mermaid code blocks untouched", async () => {
    const html = await render("```js\nconst a=1;\n```\n", [remarkZennMermaid]);
    expect(html).toContain("<code");
  });
});
