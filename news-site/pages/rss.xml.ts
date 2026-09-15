import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { NEWS } from "@/news.config";
import getSortedNews from "@/utils/getSortedNews";
import { getNewsPath } from "@/utils/getNewsPath";

export async function GET() {
  return rss({
    title: NEWS.title,
    description: NEWS.description,
    site: NEWS.website,
    items: getSortedNews(await getCollection("news")).map(
      ({ data, id, filePath }) => ({
        link: getNewsPath(id, filePath),
        title: data.title,
        description: data.description,
        pubDate: data.pubDatetime,
      })
    ),
  });
}
