export const ADVENT_DAYS = 25;

export type AdventPlatform = "site" | "zenn" | "x";

export type AdventEntry = {
  day: number;
  title: string;
  // 省略すると「予定」として表示する
  url?: string;
  description?: string;
};

export type AdventCalendar = {
  year: number;
  title: string;
  description: string;
  entries: AdventEntry[];
};

export const PLATFORM_LABELS: Record<AdventPlatform, string> = {
  site: "noguchy.me",
  zenn: "Zenn",
  x: "X",
};

const SITE_HOSTS = ["noguchy.me", "www.noguchy.me", "news.noguchy.me"];

export function detectPlatform(url: string): AdventPlatform {
  if (url.startsWith("/")) return "site";
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`Advent Calendar: invalid url "${url}"`);
  }
  if (SITE_HOSTS.includes(host)) return "site";
  if (host === "zenn.dev") return "zenn";
  if (["x.com", "twitter.com", "www.x.com", "www.twitter.com"].includes(host))
    return "x";
  throw new Error(`Advent Calendar: "${url}" is not on noguchy.me, Zenn or X`);
}

export type AdventDay = {
  day: number;
  // 0 = Sunday
  weekday: number;
  entry?: AdventEntry & { platform?: AdventPlatform };
};

export function buildAdventDays(calendar: AdventCalendar): AdventDay[] {
  const byDay = new Map<number, AdventEntry>();
  for (const entry of calendar.entries) {
    if (!Number.isInteger(entry.day) || entry.day < 1) {
      throw new Error(`Advent Calendar ${calendar.year}: bad day ${entry.day}`);
    }
    if (entry.day > ADVENT_DAYS) {
      throw new Error(
        `Advent Calendar ${calendar.year}: day ${entry.day} is after the 25th`
      );
    }
    if (byDay.has(entry.day)) {
      throw new Error(
        `Advent Calendar ${calendar.year}: day ${entry.day} appears twice`
      );
    }
    byDay.set(entry.day, entry);
  }

  return Array.from({ length: ADVENT_DAYS }, (_, i) => {
    const day = i + 1;
    const entry = byDay.get(day);
    return {
      day,
      weekday: new Date(Date.UTC(calendar.year, 11, day)).getUTCDay(),
      entry: entry && {
        ...entry,
        platform: entry.url ? detectPlatform(entry.url) : undefined,
      },
    };
  });
}

export function countPublished(days: AdventDay[]) {
  return days.filter(d => d.entry?.url).length;
}
