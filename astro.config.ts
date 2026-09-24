import { defineConfig, envField } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import AutoImport from "astro-auto-import";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import remarkZennSource from "./src/plugins/remark-zenn-source.mjs";
import remarkZennCode from "./src/plugins/remark-zenn-code.mjs";
import remarkZennMermaid from "./src/plugins/remark-zenn-mermaid.mjs";
import remarkZennFigure from "./src/plugins/remark-zenn-figure.mjs";
import remarkZennEmbed from "./src/plugins/remark-zenn-embed.mjs";
import remarkMath from "remark-math";
import remarkHasMath from "./src/plugins/remark-has-math.mjs";
import rehypeContentImages from "./src/plugins/rehype-content-images.mjs";
import rehypeKatex from "rehype-katex";
import { transformerZennDiff } from "./src/utils/transformers/zennDiff";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { SITE } from "./src/config";

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  integrations: [
    react(),
    AutoImport({
      imports: [
        "@/components/shortcodes/Accordion",
        "@/components/shortcodes/Notice",
        "@/components/shortcodes/Tab",
        "@/components/shortcodes/Tabs",
      ],
    }),
    mdx(),
    sitemap({
      filter: page =>
        (SITE.showArchives || !page.endsWith("/archives")) &&
        !page.includes("/welcome") &&
        !page.endsWith("/search/") &&
        !new URL(page).pathname.startsWith("/news"),
    }),
  ],
  build: {
    // 共通 CSS は外部ファイル化して immutable キャッシュに乗せる（always だと
    // ClientRouter の遷移ごとに約 13KB gzip を HTML と一緒に再取得していた）
    inlineStylesheets: "auto",
  },
  markdown: {
    remarkPlugins: [
      // remarkZennSource はソースを再パースしてツリーを置き換えるため必ず先頭に置くこと
      remarkZennSource,
      remarkZennCode,
      remarkZennMermaid,
      remarkZennFigure,
      remarkZennEmbed,
      remarkMath,
      remarkHasMath,
      remarkToc,
      [remarkCollapse, { test: "Table of contents" }],
    ],
    rehypePlugins: [rehypeKatex, rehypeContentImages],
    shikiConfig: {
      // For more themes, visit https://shiki.style/themes
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
        transformerZennDiff(),
      ],
    },
  },
  vite: {
    // eslint-disable-next-line
    // @ts-ignore
    // This will be fixed in Astro 6 with Vite 7 support
    // See: https://github.com/withastro/astro/issues/14030
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
      // mermaid is imported lazily from PostDetails; pre-bundle it so the dev
      // server doesn't re-optimize mid-session and serve "Outdated Optimize Dep"
      include: ["mermaid"],
    },
  },
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      PUBLIC_GOOGLE_ANALYTICS_ID: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    preserveScriptOrder: true,
  },
});
