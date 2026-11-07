import type { APIRoute } from "astro";
import { ADVENT_CALENDARS } from "@/data/adventCalendars";
import type { AdventCalendar } from "@/utils/adventCalendar";
import { generateOgImageForAdventCalendar } from "@/utils/generateOgImages";

export function getStaticPaths() {
  return ADVENT_CALENDARS.map(calendar => ({
    params: { year: String(calendar.year) },
    props: { calendar },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const { calendar } = props as { calendar: AdventCalendar };
  const buffer = await generateOgImageForAdventCalendar(calendar);
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/png" },
  });
};
