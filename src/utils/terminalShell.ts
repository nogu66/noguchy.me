export interface TermPost {
  title: string;
  href: string;
  date: string;
  tags: string[];
  mins: number;
  desc: string;
}

/** Split a raw prompt line into a lower-cased command and its arguments. */
export function parseInput(raw: string) {
  const [head = "", ...args] = raw.trim().split(/\s+/);
  return { cmd: head.toLowerCase(), args };
}

/** Commands that complete the value being typed (only while typing the name). */
export function suggest(commands: string[], value: string) {
  const typed = value.toLowerCase();
  if (!typed.startsWith("/") || /\s/.test(typed)) return [];
  return commands.filter(cmd => cmd.startsWith(typed) && cmd !== typed);
}

export function filterByTag<T extends Pick<TermPost, "tags">>(
  posts: T[],
  tag: string
) {
  return tag === "all" ? posts : posts.filter(post => post.tags.includes(tag));
}

/** Free-text lookup over title, description and tags. Every word must match. */
export function searchPosts(posts: TermPost[], query: string, limit = 4) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length >= 2);
  if (!words.length) return [];
  return posts
    .filter(post => {
      const haystack =
        `${post.title} ${post.desc} ${post.tags.join(" ")}`.toLowerCase();
      return words.every(word => haystack.includes(word));
    })
    .slice(0, limit);
}
