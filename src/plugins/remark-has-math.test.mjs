import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkHasMath from "./remark-has-math.mjs";

async function hasMath(md) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkHasMath);
  const file = { value: md, data: {} };
  await processor.run(processor.parse(md), file);
  return file.data.astro.frontmatter.hasMath;
}

describe("remark-has-math", () => {
  it("数式を含む記事は hasMath = true", async () => {
    expect(await hasMath("式 $a+b$ です\n")).toBe(true);
    expect(await hasMath("$$\nx^2\n$$\n")).toBe(true);
  });

  it("コード中の $ や単独の $ では false", async () => {
    expect(await hasMath("`$.on()` を使う\n")).toBe(false);
    expect(await hasMath("料金は $5 です\n")).toBe(false);
  });
});
