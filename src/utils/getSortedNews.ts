import type { CollectionEntry } from "astro:content";
import { SITE } from "@/config";

const getSortedNews = (news: CollectionEntry<"news">[]) => {
  return news
    .filter(({ data }) => {
      const isPublishTimePassed =
        Date.now() >
        new Date(data.pubDatetime).getTime() - SITE.scheduledPostMargin;

      return data.published && (import.meta.env.DEV || isPublishTimePassed);
    })
    .sort(
      (a, b) =>
        new Date(b.data.modDatetime ?? b.data.pubDatetime).getTime() -
        new Date(a.data.modDatetime ?? a.data.pubDatetime).getTime()
    );
};

export default getSortedNews;
