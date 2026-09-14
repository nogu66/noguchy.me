import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { getPath } from "@/utils/getPath";
import getSortedPosts from "@/utils/getSortedPosts";
import getSortedNews from "@/utils/getSortedNews";
import { getNewsPath } from "@/utils/getNewsPath";
import { SITE } from "@/config";
import { NEWS } from "@/news.config";

export async function GET() {
  const posts = await getCollection("blog");
  const news = await getCollection("news");
  const sortedPosts = getSortedPosts(posts);
  const sortedNews = getSortedNews(news);
  const items = [
    ...sortedPosts.map(({ data, id, filePath }) => ({
      link: getPath(id, filePath),
      title: data.title,
      description: data.description,
      pubDate: new Date(data.modDatetime ?? data.pubDatetime),
    })),
    ...sortedNews.map(({ data, id, filePath }) => ({
      link: new URL(getNewsPath(id, filePath), NEWS.website).href,
      title: data.title,
      description: data.description,
      pubDate: new Date(data.modDatetime ?? data.pubDatetime),
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: SITE.title,
    description: SITE.desc,
    site: SITE.website,
    items,
  });
}
