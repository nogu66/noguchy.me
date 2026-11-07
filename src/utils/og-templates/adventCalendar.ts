import satori from "satori";
import { SITE } from "@/config";
import { loadGoogleFont } from "../loadGoogleFont";
import {
  ADVENT_DAYS,
  buildAdventDays,
  countPublished,
  type AdventCalendar,
} from "../adventCalendar";

// Cobalt Wave (light) colors
const SURFACE = "#ffffff";
const SURFACE_SOFT = "#e8eef9";
const INK = "#000000";
const INK_MUTED = "#6b6b6b";
const LINE = "#cccccc";
const COBALT = "#003894";
const SALE = "#cc0000";

const CELL = 60;
const GAP = 8;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

type Node = {
  type: string;
  props: { style?: Record<string, unknown>; children?: unknown };
};

const el = (
  type: string,
  style: Record<string, unknown>,
  children?: unknown
): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children },
});

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
    if (day === null) return el("div", { width: CELL, height: CELL }, null);
    const done = isPublished.has(day);
    return el(
      "div",
      {
        width: CELL,
        height: CELL,
        alignItems: "center",
        justifyContent: "center",
        border: `${done ? 3 : 2}px solid ${done ? COBALT : INK}`,
        background: done ? COBALT : SURFACE,
        color: done ? SURFACE : INK,
        fontFamily: "Roboto",
        fontWeight: 900,
        fontSize: 26,
      },
      String(day)
    );
  };

  const calendarGrid = el("div", { flexDirection: "column", gap: GAP }, [
    el(
      "div",
      { gap: GAP },
      WEEKDAYS.map((w, i) =>
        el(
          "div",
          {
            width: CELL,
            justifyContent: "center",
            fontSize: 18,
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
      fontFamily: "Roboto",
      fontWeight: 900,
      fontSize: 92,
      lineHeight: 0.95,
      color: INK,
      letterSpacing: "-0.01em",
    },
    [
      el("div", {}, "ADVENT"),
      el("div", {}, "CALENDAR"),
      el("div", { alignItems: "baseline" }, [
        el("span", {}, String(calendar.year)),
        el("span", { color: COBALT }, "."),
      ]),
    ]
  );

  const progressWidth = 360;
  const progress = el("div", { flexDirection: "column", gap: 12 }, [
    el(
      "div",
      { fontFamily: "Roboto", fontWeight: 900, fontSize: 26, color: INK },
      `${calendar.year}.12.01 — 12.25`
    ),
    el("div", { alignItems: "center", gap: 16 }, [
      el(
        "div",
        {
          width: progressWidth,
          height: 14,
          border: `3px solid ${INK}`,
          background: SURFACE,
        },
        el("div", {
          width: (published / ADVENT_DAYS) * (progressWidth - 6),
          height: "100%",
          background: COBALT,
        })
      ),
      el(
        "div",
        {
          alignItems: "baseline",
          gap: 8,
          fontSize: 22,
          fontWeight: 700,
          color: INK_MUTED,
        },
        [
          el(
            "span",
            { fontFamily: "Roboto", fontWeight: 900, color: COBALT },
            String(published)
          ),
          el("span", {}, `/ ${ADVENT_DAYS} 本公開`),
        ]
      ),
    ]),
  ]);

  const logo = el(
    "div",
    {
      alignSelf: "flex-start",
      padding: "8px 16px",
      background: COBALT,
      color: SURFACE,
      fontFamily: "Roboto",
      fontWeight: 900,
      fontSize: 24,
      letterSpacing: "0.02em",
    },
    domain.toUpperCase()
  );

  const root = el(
    "div",
    {
      width: "100%",
      height: "100%",
      background: SURFACE,
      padding: 28,
      fontFamily: "Noto Sans JP",
    },
    el(
      "div",
      {
        flex: 1,
        border: `4px solid ${INK}`,
        background: `linear-gradient(135deg, ${SURFACE} 0%, ${SURFACE} 62%, ${SURFACE_SOFT} 62%, ${SURFACE_SOFT} 100%)`,
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
            border: `2px solid ${LINE}`,
            background: SURFACE,
          },
          calendarGrid
        ),
      ]
    )
  );

  const latin = `ADVENTCALENDAR0123456789.—/ ${domain.toUpperCase()}`;
  const japanese = `${WEEKDAYS.join("")} / 0123456789本公開`;
  const [roboto, noto] = await Promise.all([
    loadGoogleFont("Roboto", latin, 900),
    loadGoogleFont("Noto+Sans+JP", japanese, 700),
  ]);

  return satori(root as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    embedFont: true,
    fonts: [
      { name: "Roboto", data: roboto, weight: 900, style: "normal" },
      { name: "Noto Sans JP", data: noto, weight: 700, style: "normal" },
    ],
  });
}
