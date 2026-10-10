import { describe, expect, it } from "vitest";
import {
  filterByTag,
  parseInput,
  searchPosts,
  suggest,
  type TermPost,
} from "./terminalShell";

const post = (title: string, tags: string[], desc = ""): TermPost => ({
  title,
  href: `/posts/${title}`,
  date: "2026-01-01",
  tags,
  mins: 1,
  desc,
});

const posts = [
  post("Claude Mods 入門", ["claude", "mod"], "Claude Code をカスタマイズ"),
  post("Codex App Server", ["codex", "agent"]),
  post("サブスクアプリのリリース", ["others"]),
];

describe("parseInput", () => {
  it("lower-cases the command and keeps argument case", () => {
    expect(parseInput("  /Read  2 ")).toEqual({ cmd: "/read", args: ["2"] });
    expect(parseInput("/search Claude Code")).toEqual({
      cmd: "/search",
      args: ["Claude", "Code"],
    });
  });

  it("returns an empty command for blank input", () => {
    expect(parseInput("   ")).toEqual({ cmd: "", args: [] });
  });
});

describe("suggest", () => {
  const commands = ["/help", "/home", "/posts"];

  it("completes a partially typed command", () => {
    expect(suggest(commands, "/h")).toEqual(["/help", "/home"]);
    expect(suggest(commands, "/HE")).toEqual(["/help"]);
  });

  it("stops once the command is complete or has arguments", () => {
    expect(suggest(commands, "/help")).toEqual([]);
    expect(suggest(commands, "/posts 2")).toEqual([]);
    expect(suggest(commands, "hello")).toEqual([]);
  });
});

describe("filterByTag", () => {
  it("returns everything for the all tab", () => {
    expect(filterByTag(posts, "all")).toHaveLength(3);
  });

  it("keeps only posts carrying the tag", () => {
    expect(filterByTag(posts, "codex").map(p => p.title)).toEqual([
      "Codex App Server",
    ]);
  });
});

describe("searchPosts", () => {
  it("matches title, description and tags case-insensitively", () => {
    expect(searchPosts(posts, "CLAUDE").map(p => p.title)).toEqual([
      "Claude Mods 入門",
    ]);
    expect(searchPosts(posts, "agent").map(p => p.title)).toEqual([
      "Codex App Server",
    ]);
    expect(searchPosts(posts, "カスタマイズ")).toHaveLength(1);
  });

  it("requires every word to match", () => {
    expect(searchPosts(posts, "claude server")).toEqual([]);
  });

  it("ignores queries with no usable word", () => {
    expect(searchPosts(posts, "a")).toEqual([]);
  });
});
