import { describe, expect, it } from "vitest";
import { fingerprint, type Article } from "./model";
import { acceptAutoSave, canAutoSave, repositoryChange } from "./sync";

const article: Article = {
  id: "sync-test.md",
  revision: "original",
  title: "同期テスト",
  description: "概要",
  pubDatetime: "2026-09-16",
  published: false,
  tags: [],
  contents: [],
  thumbnail: "",
  body: "本文",
};

describe("Studio and repository synchronization", () => {
  it("refreshes clean articles but protects edits and uncommitted tags", () => {
    const baseline = fingerprint(article);
    const remote = { revision: "external" };
    expect(repositoryChange(article, baseline, remote)).toBe("reload");
    expect(
      repositoryChange({ ...article, body: "入力中" }, baseline, remote)
    ).toBe("conflict");
    expect(repositoryChange(article, baseline, remote, true)).toBe("conflict");
    expect(repositoryChange(article, baseline, article)).toBe("unchanged");
  });

  it("keeps deleted articles from being automatically recreated", () => {
    expect(repositoryChange(article, fingerprint(article), undefined)).toBe(
      "missing"
    );
    const fresh = { ...article, revision: null };
    expect(repositoryChange(fresh, fingerprint(fresh), undefined)).toBe(
      "unchanged"
    );
    expect(repositoryChange(fresh, "", article)).toBe("conflict");
  });

  it("retains typing during a save and uses the saved revision for the next write", () => {
    const current = { ...article, body: "保存中に追記" };
    const saved = { ...article, body: "本文\n", revision: "saved" };
    const result = acceptAutoSave(current, article, saved);
    expect(result.draft.body).toBe(current.body);
    expect(result.draft.revision).toBe("saved");
    expect(fingerprint(result.draft)).not.toBe(result.baseline);
    expect(repositoryChange(result.draft, result.baseline, saved)).toBe(
      "unchanged"
    );
  });

  it("does not repeatedly save just because Prettier formatted the body", () => {
    const saved = { ...article, body: "本文\n", revision: "saved" };
    const result = acceptAutoSave(article, article, saved);
    expect(fingerprint(result.draft)).toBe(result.baseline);
  });

  it("waits for required fields before automatic saves", () => {
    expect(canAutoSave(article)).toBe(true);
    expect(canAutoSave({ ...article, title: " " })).toBe(false);
    expect(canAutoSave({ ...article, pubDatetime: "" })).toBe(false);
    expect(canAutoSave({ ...article, published: true, body: "" })).toBe(false);
    expect(canAutoSave({ ...article, published: true, description: "" })).toBe(
      false
    );
    expect(canAutoSave({ ...article, published: true })).toBe(true);
  });
});
