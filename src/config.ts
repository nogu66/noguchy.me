export const SITE = {
  website: "https://noguchy.me/",
  author: "nogu",
  profile: "https://noguchy.me/",
  desc: "noguの個人サイト。AIエージェント開発・生成AI推進に取り組むソフトウェアエンジニア。Claude Code、Manus等のAIツールやプロダクト開発、SNSマーケティングについて発信中。",
  title: "noguchy.me",
  ogImage: "ogp.png",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: false,
    text: "Edit page",
    url: "",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "ja", // html lang code. Set this empty and default will be "en"
  timezone: "Asia/Tokyo", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  twitterId: "@_nogu66", // Twitter account for og:site and og:creator
} as const;

export const NEWS_SITE_URL = "https://news.noguchy.me/";
