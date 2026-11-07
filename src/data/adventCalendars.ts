import type { AdventCalendar } from "@/utils/adventCalendar";

// Advent Calendar の記事一覧（年ごと）
// 記事を公開したら、その日の entry に url を足す。url がない entry は「予定」として表示する。
// platform は url から自動判定する（noguchy.me / zenn.dev / x.com）。
//
// 例:
//   { day: 1, title: "Claude Code の始め方", url: "/posts/claude-code-start/" },
//   { day: 2, title: "Codex と並べて使う", url: "https://zenn.dev/nogu66/articles/xxxx" },
//   { day: 3, title: "1日1本書いてみて", url: "https://x.com/_nogu66/status/xxxx" },
//   { day: 4, title: "MCP サーバーを自作する" }, // 予定
export const ADVENT_CALENDARS: AdventCalendar[] = [
  {
    year: 2026,
    title: "nogu Advent Calendar 2026",
    description:
      "12月1日から25日まで、毎日1本記事を書きます。このサイト・Zenn・X のどこかに公開した記事を、日付ごとにまとめています。",
    entries: [],
  },
];
