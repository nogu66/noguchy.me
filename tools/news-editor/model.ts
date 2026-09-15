export interface Article {
  id: string;
  revision: string | null;
  title: string;
  description: string;
  pubDatetime: string;
  published: boolean;
  tags: string[];
  contents: string[];
  thumbnail: string;
  body: string;
}

export const fingerprint = (article: Article) =>
  JSON.stringify({ ...article, revision: null });

export function newArticle(): Article {
  const now = new Date();
  const date = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
  }).format(now);
  return {
    id: `${date}-${crypto.randomUUID().slice(0, 8)}.md`,
    revision: null,
    title: "",
    description: "",
    pubDatetime: now.toISOString(),
    published: false,
    tags: [],
    contents: [],
    thumbnail: "",
    body: "",
  };
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "通信に失敗しました。");
  return result;
}

export const uploadImage = (file: File) =>
  api<{ url: string }>("/api/images", {
    method: "POST",
    headers: { "Content-Type": file.type || "image/png" },
    body: file,
  });

// Keep standalone URLs as standalone lines for this site's embed plugins.
export const normalizeMarkdown = (body: string) =>
  body
    .replace(/^\[(https?:\/\/[^\]\s]+)\]\(\1\)$/gm, "$1")
    .replace(/^<(https?:\/\/[^>\s]+)>$/gm, "$1");

// Rich-text schemas cannot preserve arbitrary HTML or Zenn directives.
// Open such articles in source mode instead of silently stripping their syntax.
export const needsSourceMode = (body: string) =>
  /(^:{3,}|^@\[|^```[^\n]*:|^```(?:mermaid|diff)\b|\$\$|\$[^$\n]+\$|<\/?[a-zA-Z!]|^\[\^[^\]]+\]:|=\d+x\))/m.test(
    body
  );

export function dateInput(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}
