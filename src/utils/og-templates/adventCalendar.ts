import { readFile } from "node:fs/promises";
import { join } from "node:path";
import satori from "satori";
import { SITE } from "@/config";
import { loadGoogleFont } from "../loadGoogleFont";
import {
  ADVENT_DAYS,
  buildAdventDays,
  countPublished,
  type AdventCalendar,
} from "../adventCalendar";

// Light theme colors, kept in step with the tokens in src/styles/global.css
const SURFACE = "#ffffff";
const SURFACE_SOFT = "#e6f2fd";
const INK = "#1e2433";
const INK_MUTED = "#5d6678";
const LINE = "#e1e6ee";
const COBALT = "#1a63c4";
const SALE = "#d63a3a";

const CELL = 70;
const CELL_HEIGHT = 88;
const GAP = 8;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const SHADOW_SOFT = "0 12px 32px rgba(26, 99, 196, 0.12)";

type Node = {
  type: string;
  props: Record<string, unknown>;
};

const el = (
  type: string,
  style: Record<string, unknown>,
  children?: unknown
): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children },
});

async function loadAvatar() {
  const file = await readFile(join(process.cwd(), "public", "favicon.png"));
  return `data:image/png;base64,${file.toString("base64")}`;
}

export default async function adventCalendarOgImage(calendar: AdventCalendar) {
  const days = buildAdventDays(calendar);
  const published = countPublished(days);
  const startWeekday = days[0].weekday;
  const domain = new URL(SITE.website).hostname;

  // Calendar cells: blanks before the 1st, then 25 days, padded to full weeks
  const cells: (number | null)[] = [
    ...Array<null>(startWeekday).fill(null),
    ...days.map(d => d.day),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7)
  );
  const isPublished = new Set(days.filter(d => d.entry?.url).map(d => d.day));

  const cell = (day: number | null) => {
    if (day === null)
      return el("div", { width: CELL, height: CELL_HEIGHT }, null);
    const done = isPublished.has(day);
    return el(
      "div",
      {
        width: CELL,
        height: CELL_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${done ? COBALT : LINE}`,
        borderRadius: 18,
        background: done ? COBALT : SURFACE,
        color: done ? SURFACE : INK,
        fontFamily: "Roboto",
        fontWeight: 900,
        fontSize: 30,
      },
      String(day)
    );
  };

  const calendarGrid = el("div", { flexDirection: "column", gap: GAP }, [
    el(
      "div",
      { gap: GAP, marginBottom: 4 },
      WEEKDAYS.map((w, i) =>
        el(
          "div",
          {
            width: CELL,
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 700,
            color: i === 0 ? SALE : INK_MUTED,
          },
          w
        )
      )
    ),
    ...weeks.map(week => el("div", { gap: GAP }, week.map(cell))),
  ]);

  const heading = el(
    "div",
    {
      flexDirection: "column",
      fontFamily: "Zen Maru Gothic",
      fontWeight: 900,
      fontSize: 86,
      lineHeight: 1.08,
      color: INK,
    },
    [
      el("div", {}, "Advent"),
      el("div", {}, "Calendar"),
      el("div", { color: COBALT }, String(calendar.year)),
    ]
  );

  const progressWidth = 380;
  const progress = el("div", { flexDirection: "column", gap: 12 }, [
    el(
      "div",
      {
        alignItems: "baseline",
        gap: 10,
        fontSize: 26,
        fontWeight: 700,
        color: INK_MUTED,
      },
      [
        el(
          "span",
          {
            fontFamily: "Roboto",
            fontWeight: 900,
            fontSize: 44,
            lineHeight: 1,
            color: COBALT,
          },
          String(published)
        ),
        el("span", {}, `/ ${ADVENT_DAYS} 本公開`),
      ]
    ),
    el(
      "div",
      {
        width: progressWidth,
        height: 14,
        borderRadius: 9999,
        background: SURFACE_SOFT,
        overflow: "hidden",
      },
      el("div", {
        width: (published / ADVENT_DAYS) * progressWidth,
        height: "100%",
        borderRadius: 9999,
        background: COBALT,
      })
    ),
  ]);

  const logo = el(
    "div",
    {
      alignItems: "center",
      gap: 12,
      fontFamily: "Zen Maru Gothic",
      fontWeight: 900,
      fontSize: 30,
      color: INK,
    },
    [
      {
        type: "img",
        props: {
          src: await loadAvatar(),
          width: 48,
          height: 48,
          style: { borderRadius: 9999 },
        },
      },
      el("span", {}, domain),
    ]
  );

  const root = el(
    "div",
    {
      width: "100%",
      height: "100%",
      background: SURFACE_SOFT,
      padding: 36,
      fontFamily: "Noto Sans JP",
    },
    el(
      "div",
      {
        flex: 1,
        border: `1px solid ${LINE}`,
        borderRadius: 40,
        background: SURFACE,
        boxShadow: SHADOW_SOFT,
        padding: "44px 52px",
        justifyContent: "space-between",
        alignItems: "center",
      },
      [
        el(
          "div",
          {
            flexDirection: "column",
            justifyContent: "space-between",
            height: "100%",
          },
          [logo, heading, progress]
        ),
        el(
          "div",
          {
            padding: 24,
            borderRadius: 28,
            background: SURFACE_SOFT,
          },
          calendarGrid
        ),
      ]
    )
  );

  const display = `AdventCalendar0123456789${domain}`;
  const latin = "0123456789";
  const japanese = `${WEEKDAYS.join("")} / 0123456789本公開`;
  const [zenMaru, roboto, noto] = await Promise.all([
    loadGoogleFont("Zen+Maru+Gothic", display, 900),
    loadGoogleFont("Roboto", latin, 900),
    loadGoogleFont("Noto+Sans+JP", japanese, 700),
  ]);

  return satori(root as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    embedFont: true,
    fonts: [
      { name: "Zen Maru Gothic", data: zenMaru, weight: 900, style: "normal" },
      { name: "Roboto", data: roboto, weight: 900, style: "normal" },
      { name: "Noto Sans JP", data: noto, weight: 700, style: "normal" },
    ],
  });
}
