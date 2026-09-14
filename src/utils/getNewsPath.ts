import { NEWS_PATH } from "@/content.config";
import { slugifyStr } from "./slugify";

export function getNewsPath(
  id: string,
  filePath: string | undefined,
  includeBase = true
) {
  const pathSegments = filePath
    ?.replace(NEWS_PATH, "")
    .split("/")
    .filter(path => path !== "")
    .filter(path => !path.startsWith("_"))
    .slice(0, -1)
    .map(segment => slugifyStr(segment));

  const basePath = includeBase ? "/news" : "";
  const newsId = id.split("/");
  const slug = newsId.length > 0 ? newsId.slice(-1) : newsId;

  if (!pathSegments || pathSegments.length < 1) {
    return [basePath, slug].join("/");
  }

  return [basePath, ...pathSegments, slug].join("/");
}
