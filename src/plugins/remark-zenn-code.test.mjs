import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkZennCode from "./remark-zenn-code.mjs";

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkZennCode);
function parse(md) {
  return processor.runSync(processor.parse(md));
}
function firstCode(tree) {
  return tree.children.find(n => n.type === "code");
}

describe("remark-zenn-code", () => {
  it("converts lang:file into lang + file= meta", () => {
    const code = firstCode(parse("```js:foo.js\nconst a = 1;\n```\n"));
    expect(code.lang).toBe("js");
    expect(code.meta).toContain('file="foo.js"');
  });

  it("converts `diff js` into js lang with diff line metadata", () => {
    const code = firstCode(
      parse("```diff js\n+added\n-removed\n const x = 1;\n```\n")
    );
    expect(code.lang).toBe("js");
    expect(code.meta).toContain("zenn-diff");
    expect(code.meta).toContain('zenn-diff-add="1"');
    expect(code.meta).toContain('zenn-diff-del="2"');
    expect(code.value).toBe("added\nremoved\n const x = 1;");
  });

  it("converts `diff js:foo.js` into js lang + file + diff", () => {
    const code = firstCode(parse("```diff js:foo.js\n+added\n```\n"));
    expect(code.lang).toBe("js");
    expect(code.meta).toContain('file="foo.js"');
    expect(code.meta).toContain("zenn-diff");
  });

  it("leaves plain code blocks untouched", () => {
    const code = firstCode(parse("```js\nconst a = 1;\n```\n"));
    expect(code.lang).toBe("js");
    expect(code.meta).toBeFalsy();
  });
});
