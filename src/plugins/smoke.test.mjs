import { describe, it, expect } from "vitest";
import { render } from "./test-helper.mjs";

describe("test-helper", () => {
  it("renders plain markdown", async () => {
    const html = await render("# Hello");
    expect(html).toContain("<h1>Hello</h1>");
  });
});
