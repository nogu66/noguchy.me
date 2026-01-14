import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { SITE } from "@/config";

export const BLOG_PATH = "src/content/blog";
export const TALKS_PATH = "src/content/talks";
export const AWARDS_PATH = "src/content/awards";

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z.object({
      author: z.string().default(SITE.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      published: z.boolean().default(false),
      tags: z.array(z.string()).default(["others"]),
      ogImage: image().or(z.string()).optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
      hideEditPost: z.boolean().optional(),
      timezone: z.string().optional(),
    }),
});

// 登壇情報
const talks = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `./${TALKS_PATH}` }),
  schema: () =>
    z.object({
      title: z.string(), // 登壇タイトル
      event: z.string(), // イベント名
      date: z.date(), // 登壇日
      venue: z.string().optional(), // 会場
      slideUrl: z.string().url().optional(), // スライドURL
      videoUrl: z.string().url().optional(), // 動画URL
      eventUrl: z.string().url().optional(), // イベントURL
      ogpImage: z.string().url().optional(), // OGP画像URL
      tags: z.array(z.string()).default([]),
    }),
});

// ハッカソン・コンテスト入賞情報
const awards = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `./${AWARDS_PATH}` }),
  schema: () =>
    z.object({
      title: z.string(), // プロジェクト名
      event: z.string(), // イベント名
      date: z.date(), // 開催日
      award: z.string(), // 受賞名（最優秀賞、優秀賞など）
      projectUrl: z.string().url().optional(), // プロジェクトURL
      eventUrl: z.string().url().optional(), // イベントURL
      tags: z.array(z.string()).default([]),
    }),
});

export const collections = { blog, talks, awards };
