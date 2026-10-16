import { getCollection, type CollectionEntry } from "astro:content";
import { SITE } from "@/config";
import { getPath } from "./getPath";

export type ListedPost = CollectionEntry<"blog"> & { href?: string };

// Standalone pages under src/pages that are listed alongside blog posts
const pagePosts: ListedPost[] = [
  {
    id: "claude-mods",
    collection: "blog",
    href: "/claude-mods/",
    data: {
      author: SITE.author,
      pubDatetime: new Date("2026-10-14T22:00:00+09:00"),
      title: "Claude Mods の全体像",
      published: true,
      tags: ["claude", "claudecode", "ai", "plugin", "hooks", "mod"],
      ogImage: "/claude-mods/ogp.png",
      description:
        "Claude Code の Mods（function hooks）で何ができて、どう書き、どう始めるのかを 1 ページにまとめました。ハッカソンの補足資料として使えます。",
    },
  },
];

export const getListedPostPath = ({ href, id, filePath }: ListedPost) =>
  href ?? getPath(id, filePath);

const getListedPosts = async (): Promise<ListedPost[]> => [
  ...(await getCollection("blog", ({ data }) => data.published)),
  ...pagePosts,
];

export default getListedPosts;
