import { fingerprint, type Article } from "./model";

export function canAutoSave(article: Article) {
  return (
    !!article.title.trim() &&
    Number.isFinite(Date.parse(article.pubDatetime)) &&
    (!article.published ||
      (!!article.description.trim() && !!article.body.trim()))
  );
}

// Keep the input (and caret) intact when formatting changes the saved Markdown.
// Edits made while the request was in flight must remain dirty for the next save.
export function acceptAutoSave(
  current: Article,
  submitted: Article,
  saved: Article
) {
  return {
    draft: { ...current, revision: saved.revision },
    baseline: fingerprint(submitted),
  };
}

export function repositoryChange(
  draft: Article,
  baseline: string,
  remote: Pick<Article, "revision"> | undefined,
  pendingTags = false
): "unchanged" | "reload" | "conflict" | "missing" {
  if (!remote) return draft.revision ? "missing" : "unchanged";
  if (remote.revision === draft.revision) return "unchanged";
  return fingerprint(draft) !== baseline || pendingTags ? "conflict" : "reload";
}
