import { describe, expect, it } from "vitest";
import { DEFAULT_CHAIN, runChain, runNext } from "./mods-sim";

describe("runNext", () => {
  it("早期リターンは rm -rf / を拒否し、core を実行しない", () => {
    const run = runNext("early", "rm");
    expect(run.denied).toBe(true);
    expect(run.executed).toBe(false);
    expect(run.steps.some(s => s.lane === "core")).toBe(false);
  });

  it("マッチャーに一致しないハンドラは素通りする", () => {
    const run = runNext("early", "env");
    expect(run.steps[1].note).toContain("一致しない");
    expect(run.executed).toBe(true);
  });

  it("後処理は core の後にログを出し、結果は変えない", () => {
    const run = runNext("after", "ls");
    const coreIdx = run.steps.findIndex(s => s.lane === "core");
    const logIdx = run.steps.findIndex(s => s.line === 3);
    expect(coreIdx).toBeLessThan(logIdx);
    expect(run.result).toContain("README.md");
  });

  it("結果の書き換えは sk- キーをマスクする", () => {
    const run = runNext("rewrite", "env");
    expect(run.result).toContain("[REDACTED]");
    expect(run.result).not.toContain("sk-");
  });
});

describe("runChain", () => {
  it("出荷時のままなら e はそのまま core に届く", () => {
    const run = runChain(DEFAULT_CHAIN);
    expect(run.executed).toBe("git push --force");
    expect(run.steps.map(s => `${s.dir}:${s.at}`)).toEqual([
      "down:engine",
      "down:prepend",
      "down:user",
      "down:append",
      "down:builtin",
      "down:core",
      "up:core",
      "up:builtin",
      "up:append",
      "up:user",
      "up:prepend",
      "up:engine",
    ]);
  });

  it("prepend が拒否すると user 以降には届かない", () => {
    const run = runChain({ ...DEFAULT_CHAIN, prepend: "deny", user: "input" });
    expect(run.executed).toBeNull();
    expect(run.steps.some(s => s.at === "user")).toBe(false);
    expect(run.result).toEqual({ deny: "org: force push は禁止" });
  });

  it("user が書き換えても append の拒否で core は実行されない", () => {
    const run = runChain({ ...DEFAULT_CHAIN, user: "input", append: "deny" });
    expect(run.executed).toBeNull();
    const userDown = run.steps.find(s => s.at === "user" && s.dir === "down");
    expect(userDown?.e?.command).toBe("git push --force-with-lease");
  });

  it("入力は append、結果は prepend が最後に加工する", () => {
    const input = runChain({
      ...DEFAULT_CHAIN,
      user: "input",
      append: "input",
    });
    expect(input.executed).toBe("timeout 60 git push --force-with-lease");

    const result = runChain({
      ...DEFAULT_CHAIN,
      prepend: "result",
      user: "result",
    });
    expect(result.result).toEqual({
      text: "main -> main (forced update) (1.2s) [audit: org]",
    });
  });
});
