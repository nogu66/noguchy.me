import { NEWS } from "@/news.config";

export function GET() {
  return new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${NEWS.website}sitemap-index.xml\n`,
    {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }
  );
}
