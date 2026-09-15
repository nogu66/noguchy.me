import { mergeConfig } from "astro/config";
import baseConfig from "./astro.config";
import { NEWS } from "./src/news.config";

export default mergeConfig(baseConfig, {
  site: NEWS.website,
  srcDir: "./news-site",
  outDir: "./dist-news",
  cacheDir: "./.astro/news-cache",
  trailingSlash: "always",
  server: { port: 4322 },
});
