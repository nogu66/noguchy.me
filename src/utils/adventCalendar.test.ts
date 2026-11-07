import { describe, expect, it } from "vitest";
import {
  buildAdventDays,
  countPublished,
  detectPlatform,
  type AdventCalendar,
} from "./adventCalendar";

const calendar = (entries: AdventCalendar["entries"]): AdventCalendar => ({
  year: 2026,
  title: "test",
  description: "",
  entries,
});

describe("detectPlatform", () => {
  it("recognises this site, Zenn and X", () => {
    expect(detectPlatform("/posts/hello/")).toBe("site");
    expect(detectPlatform("https://noguchy.me/posts/hello/")).toBe("site");
    expect(detectPlatform("https://zenn.dev/nogu66/articles/abc")).toBe("zenn");
    expect(detectPlatform("https://x.com/_nogu66/status/1")).toBe("x");
    expect(detectPlatform("https://twitter.com/_nogu66/status/1")).toBe("x");
  });

  it("rejects other hosts", () => {
    expect(() => detectPlatform("https://example.com/")).toThrow();
  });
});

describe("buildAdventDays", () => {
  it("returns 25 days with weekdays for that December", () => {
    const days = buildAdventDays(calendar([]));
    expect(days).toHaveLength(25);
    // 2026-12-01 is a Tuesday, 2026-12-25 a Friday
    expect(days[0]).toMatchObject({ day: 1, weekday: 2 });
    expect(days[24]).toMatchObject({ day: 25, weekday: 5 });
  });

  it("places entries on their day and counts only published ones", () => {
    const days = buildAdventDays(
      calendar([
        { day: 3, title: "a", url: "https://zenn.dev/x/articles/a" },
        { day: 4, title: "planned" },
      ])
    );
    expect(days[2].entry).toMatchObject({ title: "a", platform: "zenn" });
    expect(days[3].entry).toMatchObject({ title: "planned" });
    expect(days[3].entry?.platform).toBeUndefined();
    expect(countPublished(days)).toBe(1);
  });

  it("rejects duplicate and out-of-range days", () => {
    expect(() =>
      buildAdventDays(
        calendar([
          { day: 1, title: "a" },
          { day: 1, title: "b" },
        ])
      )
    ).toThrow(/twice/);
    expect(() => buildAdventDays(calendar([{ day: 26, title: "a" }]))).toThrow(
      /25th/
    );
    expect(() => buildAdventDays(calendar([{ day: 0, title: "a" }]))).toThrow();
  });
});
