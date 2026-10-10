import { navigate } from "astro:transitions/client";
import {
  filterByTag,
  parseInput,
  searchPosts,
  suggest,
  type TermPost,
} from "@/utils/terminalShell";

interface TermTag {
  tag: string;
  name: string;
  count: number;
}

interface TermActivity {
  label: string;
  title: string;
  href: string;
  date: string;
}

interface TermData {
  featured: TermPost[];
  posts: TermPost[];
  tags: TermTag[];
  activities: TermActivity[];
  links: { news: string; github: string; x: string };
}

const PAGE_SIZE = 5;
const THEMES: Record<string, string> = {
  light: "ライトテーマ",
  dark: "ダークテーマ",
};

// [name, usage, description]. Commands whose usage starts with "<" need an argument.
const COMMANDS: [string, string, string][] = [
  ["/help", "", "コマンド一覧を表示"],
  ["/posts", "", "記事をさらに 5 件読み込む"],
  ["/read", "[n]", "n 番目の記事を開く（省略で一覧）"],
  ["/tags", "[tag]", "タグで記事を絞り込む"],
  ["/search", "<word>", "サイト内を検索"],
  ["/activities", "", "登壇・受賞歴を表示"],
  ["/about", "", "プロフィールを開く"],
  ["/news", "", "NEWS サイトを開く"],
  ["/links", "", "リンク集を開く"],
  ["/github", "", "GitHub を開く"],
  ["/x", "", "X を開く"],
  ["/theme", "[light|dark]", "カラーテーマを切り替える"],
  ["/home", "", "ホームに戻る"],
  ["/clear", "", "出力を消去"],
];
const COMMAND_NAMES = COMMANDS.map(([name]) => name);

function el(tag: string, className: string, text = "") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function initTerminal() {
  const root = document.getElementById("term-root");
  const dataEl = document.getElementById("term-data");
  if (!root || !dataEl) return;

  const data: TermData = JSON.parse(dataEl.textContent ?? "{}");
  const rows = root.querySelector<HTMLElement>("#term-rows")!;
  const feed = root.querySelector<HTMLElement>("#term-feed")!;
  const tabs = root.querySelector<HTMLElement>("#term-tabs")!;
  const more = root.querySelector<HTMLButtonElement>("#term-more")!;
  const out = root.querySelector<HTMLElement>("#term-out")!;
  const form = root.querySelector<HTMLFormElement>("#term-form")!;
  const input = root.querySelector<HTMLInputElement>("#term-input")!;
  const sugBox = root.querySelector<HTMLElement>("#term-suggest")!;
  const sideMenu = root.querySelector<HTMLElement>("#term-menu")!;

  const ctrl = new AbortController();
  const { signal } = ctrl;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  const allPosts = [...data.featured, ...data.posts];
  let activeTag = "all";
  let shown = PAGE_SIZE;

  const scrollEnd = () => {
    rows.scrollTop = rows.scrollHeight;
  };

  /* ---------- navigation ---------- */

  const go = (href: string) => {
    if (/^https?:/.test(href)) {
      window.open(href, "_blank", "noopener");
      return;
    }
    later(() => navigate(href), 350);
  };

  /* ---------- feed ---------- */

  const feedList = () => filterByTag(data.posts, activeTag);
  const visibleFeed = () => feedList().slice(0, shown);

  const feedRow = (post: TermPost, order: number) => {
    const row = el("a", "frow") as HTMLAnchorElement;
    row.href = post.href;
    row.style.setProperty("--i", String(Math.max(0, order)));
    row.append(
      el("span", "f-l", post.date),
      el("span", "f-t", post.title),
      el("span", "f-d", `${post.mins} min`)
    );
    return row;
  };

  const renderFeed = (animateFrom: number) => {
    const list = feedList();
    const visible = list.slice(0, shown);
    feed.replaceChildren(
      ...visible.map((post, i) => feedRow(post, i - animateFrom))
    );
    if (!visible.length) {
      const empty = el("div", "f-empty");
      empty.append(
        el("span", "gt", ">"),
        `ls ./posts/${activeTag} — まだ記事がありません。`
      );
      feed.append(empty);
    }
    more.hidden = shown >= list.length;
    tabs.querySelectorAll<HTMLButtonElement>("button").forEach(tab => {
      const on = tab.dataset.tag === activeTag;
      tab.classList.toggle("on", on);
      tab.setAttribute("aria-pressed", String(on));
    });
  };

  const setTag = (tag: string) => {
    activeTag = tag;
    shown = PAGE_SIZE;
    renderFeed(0);
  };

  /** Returns how many rows were added. */
  const loadMore = () => {
    const before = visibleFeed().length;
    shown += PAGE_SIZE;
    renderFeed(before);
    scrollEnd();
    return visibleFeed().length - before;
  };

  /* ---------- scrollback ---------- */

  const print = (text: string, className = "t-out") => {
    const line = el("div", className, text);
    out.append(line);
    scrollEnd();
    return line;
  };

  const option = (
    label: string,
    desc: string,
    action: { cmd?: string; href?: string; fill?: string }
  ) => {
    const line = el("div", "t-out t-opt");
    line.append(el("span", "t-k", label), el("span", "t-v", desc));
    Object.assign(line.dataset, action);
    out.append(line);
    return line;
  };

  /* ---------- selectable option menu (/help, /theme, ...) ---------- */

  let menu: HTMLElement[] | null = null;
  let menuIndex = 0;
  let themeBefore: string | null = null;

  const currentTheme = () =>
    document.documentElement.getAttribute("data-theme") ?? "light";
  const previewTheme = (theme: string) =>
    document.documentElement.setAttribute("data-theme", theme);
  const commitTheme = (theme: string) =>
    document.dispatchEvent(new CustomEvent("theme:set", { detail: theme }));

  const openMenu = (items: HTMLElement[], index: number, hint: string) => {
    if (!items.length) return;
    menu = items;
    menuIndex = Math.max(0, index);
    menu[menuIndex].classList.add("on");
    print(hint, "t-out t-hint");
  };

  const closeMenu = ({ revert = true } = {}) => {
    menu?.forEach(item => item.classList.remove("on"));
    menu = null;
    if (themeBefore && revert) previewTheme(themeBefore);
    themeBefore = null;
  };

  const moveMenu = (step: number) => {
    if (!menu) return;
    menu[menuIndex].classList.remove("on");
    menuIndex = (menuIndex + step + menu.length) % menu.length;
    const item = menu[menuIndex];
    item.classList.add("on");
    item.scrollIntoView({ block: "nearest" });
    const cmd = item.dataset.cmd ?? "";
    if (themeBefore && cmd.startsWith("/theme ")) previewTheme(cmd.slice(7));
  };

  const activate = (item: HTMLElement) => {
    const { cmd, href, fill } = item.dataset;
    closeMenu({ revert: false });
    if (fill) {
      input.value = fill;
      input.focus();
    } else if (href) {
      print(`${item.querySelector(".t-v")?.textContent ?? href} を開きます…`);
      go(href);
    } else if (cmd) {
      run(cmd);
    }
  };

  /* ---------- commands ---------- */

  const open = (label: string, href: string) => {
    print(`${label} を開きます…`);
    go(href);
  };

  const handlers: Record<string, (args: string[]) => void> = {
    "/help": () => {
      const items = COMMANDS.map(([name, usage, desc]) =>
        option(
          `${name} ${usage}`.trim(),
          desc,
          usage.startsWith("<") ? { fill: `${name} ` } : { cmd: name }
        )
      );
      openMenu(items, 0, "↑↓ で選択 · enter で実行 · esc で閉じる");
    },
    "/posts": () => {
      if (shown >= feedList().length) {
        print("これで全部です。/tags で絞り込みもできます。");
        return;
      }
      print(`${loadMore()} 件読み込みました。`);
    },
    "/read": ([n]) => {
      const list = [...data.featured, ...visibleFeed()];
      if (!n) {
        const items = list.map((post, i) =>
          option(String(i + 1).padStart(2, "0"), post.title, {
            href: post.href,
          })
        );
        openMenu(items, 0, "↑↓ で選択 · enter で開く · esc で閉じる");
        return;
      }
      const post = list[Number.parseInt(n, 10) - 1];
      if (post) open(`「${post.title}」`, post.href);
      else print(`${n} 番目の記事はありません。/read で一覧を表示します。`);
    },
    "/tags": ([name]) => {
      if (!name) {
        const items = [
          option("all", `${data.posts.length} 件`, { cmd: "/tags all" }),
          ...data.tags.map(({ tag, name, count }) =>
            option(`#${name}`, `${count} 件`, { cmd: `/tags ${tag}` })
          ),
        ];
        openMenu(items, 0, "↑↓ で選択 · enter で絞り込み · esc で閉じる");
        return;
      }
      const wanted = name.replace(/^#/, "").toLowerCase();
      const hit =
        wanted === "all"
          ? { tag: "all", name: "all" }
          : data.tags.find(
              t => t.tag === wanted || t.name.toLowerCase() === wanted
            );
      if (!hit) {
        print(`タグ「${name}」は見つかりません。/tags で一覧を表示します。`);
        return;
      }
      setTag(hit.tag);
      print(`#${hit.name}: ${feedList().length} 件`);
    },
    "/search": args => {
      const query = args.join(" ");
      if (!query) {
        print("使い方: /search <word>");
        return;
      }
      open(`「${query}」の検索結果`, `/search?q=${encodeURIComponent(query)}`);
    },
    "/activities": () => {
      if (!data.activities.length) {
        print("まだ登録がありません。");
        return;
      }
      const items = data.activities.map(({ label, title, href, date }) =>
        option(`${date} ${label}`, title, { href })
      );
      openMenu(items, 0, "↑↓ で選択 · enter で開く · esc で閉じる");
    },
    "/theme": ([name]) => {
      const theme = (name ?? "").toLowerCase();
      if (theme in THEMES) {
        commitTheme(theme);
        print(`テーマを ${theme} に変更しました。サイト全体に反映されます。`);
        return;
      }
      const current = currentTheme();
      const names = Object.keys(THEMES);
      const items = names.map(key =>
        option(key, THEMES[key], { cmd: `/theme ${key}` })
      );
      openMenu(
        items,
        names.indexOf(current),
        "↑↓ でプレビュー · enter で適用 · esc でキャンセル"
      );
      themeBefore = current;
    },
    "/about": () => open("プロフィール", "/about"),
    "/home": () => open("ホーム", "/"),
    "/links": () => open("リンク集", "/links"),
    "/news": () => open("NEWS ↗", data.links.news),
    "/github": () => open("GitHub ↗", data.links.github),
    "/x": () => open("X ↗", data.links.x),
    "/whoami": () => print("guest — ようこそ。/about で中の人がわかります。"),
    "/clear": () => out.replaceChildren(),
  };

  const fallback = (line: string) => {
    const lower = line.toLowerCase();
    const has = (...words: string[]) => words.some(w => lower.includes(w));

    if (line.startsWith("/")) {
      print(
        `command not found: ${line.split(/\s+/)[0]} — /help で一覧を表示します。`
      );
      return;
    }
    if (has("sudo")) {
      print("Permission denied. ここの root は nogu だけです。");
      return;
    }
    if (has("hello", "こんにちは", "こんばんは") || /^(hi|hey)\b/.test(lower)) {
      print("こんにちは。このシェルで記事を読めます。/help からどうぞ。");
      return;
    }
    if (has("ありがとう", "thank")) {
      print("どういたしまして。");
      return;
    }
    const hits = searchPosts(allPosts, line);
    if (hits.length) {
      print("コマンドではありませんが、こんな記事があります:");
      const items = hits.map(post =>
        option("└", post.title, { href: post.href })
      );
      openMenu(items, 0, "↑↓ で選択 · enter で開く · esc で閉じる");
      return;
    }
    print(
      `「${line.slice(0, 40)}」は見つかりませんでした。/help か /search <word> を試してください。`
    );
  };

  function run(raw: string) {
    const line = raw.trim();
    if (!line) return;
    closeMenu();
    print(line, "t-cmd");
    const { cmd, args } = parseInput(line);
    const handler = handlers[cmd];
    if (handler) handler(args);
    else fallback(line);
    scrollEnd();
  }

  /* ---------- command suggestions while typing ---------- */

  let sugs: string[] = [];
  let sugIndex = 0;

  const renderSugs = () => {
    sugBox.classList.toggle("open", sugs.length > 0);
    sugBox.replaceChildren(
      ...sugs.map((name, i) => {
        const item = el("div", i === sugIndex ? "sug on" : "sug");
        item.dataset.cmd = name;
        const [, usage, desc] = COMMANDS.find(([n]) => n === name)!;
        item.append(
          el("span", "sc", `${name} ${usage}`.trim()),
          el("span", "sd", desc)
        );
        return item;
      })
    );
  };

  const closeSugs = () => {
    sugs = [];
    renderSugs();
  };

  const needsArg = (name: string) =>
    COMMANDS.find(([n]) => n === name)?.[1].startsWith("<") ?? false;

  /* ---------- events ---------- */

  const history: string[] = [];
  let historyIndex = -1;

  form.addEventListener(
    "submit",
    event => {
      event.preventDefault();
      const value = input.value;
      if (value.trim()) history.unshift(value);
      historyIndex = -1;
      input.value = "";
      closeSugs();
      run(value);
    },
    { signal }
  );

  input.addEventListener(
    "input",
    () => {
      sugs = suggest(COMMAND_NAMES, input.value);
      sugIndex = 0;
      renderSugs();
    },
    { signal }
  );

  input.addEventListener(
    "keydown",
    event => {
      // Enter that confirms an IME composition must not submit the line
      if (event.isComposing || event.keyCode === 229) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
        return;
      const { key } = event;

      if (sugs.length) {
        if (key === "ArrowUp" || key === "ArrowDown") {
          sugIndex =
            (sugIndex + (key === "ArrowDown" ? 1 : -1) + sugs.length) %
            sugs.length;
          renderSugs();
        } else if (key === "Tab" || key === "Enter") {
          const name = sugs[sugIndex];
          closeSugs();
          if (key === "Enter" && !needsArg(name)) {
            input.value = name;
            form.requestSubmit();
          } else {
            input.value = `${name} `;
          }
        } else if (key === "Escape") {
          closeSugs();
        } else {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // the option menu owns the arrow keys while it is open
      if (menu) return;

      if (key === "ArrowUp" && history.length) {
        event.preventDefault();
        historyIndex = Math.min(historyIndex + 1, history.length - 1);
        input.value = history[historyIndex];
      } else if (key === "ArrowDown" && historyIndex >= 0) {
        event.preventDefault();
        historyIndex -= 1;
        input.value = historyIndex >= 0 ? history[historyIndex] : "";
      } else if (key === "Tab" && input.value) {
        const match = COMMAND_NAMES.find(name =>
          name.startsWith(input.value.toLowerCase())
        );
        if (match) {
          event.preventDefault();
          input.value = match;
        }
      }
    },
    { signal }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const { key } = event;
      const target = event.target as HTMLElement;
      const inPrompt = target === input;
      const typing =
        !inPrompt &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (typing) return;

      if (menu) {
        if (key === "ArrowUp" || key === "ArrowDown") {
          event.preventDefault();
          moveMenu(key === "ArrowDown" ? 1 : -1);
          return;
        }
        if (key === "Escape") {
          closeMenu();
          return;
        }
        if (
          key === "Enter" &&
          !input.value.trim() &&
          (inPrompt || target === document.body)
        ) {
          event.preventDefault();
          activate(menu[menuIndex]);
          return;
        }
        // typing a new command dismisses the menu
        if (inPrompt && key.length === 1) closeMenu();
      }

      if (inPrompt || event.shiftKey || event.repeat) return;
      if (key === "/") {
        // focus now so this keystroke lands in the prompt
        input.focus();
        return;
      }
      const link = sideMenu.querySelector<HTMLAnchorElement>(
        `a[data-key="${CSS.escape(key.toUpperCase())}"]`
      );
      if (link && target.closest("a, button") === null) link.click();
    },
    { signal }
  );

  sugBox.addEventListener(
    "mousedown",
    event => {
      const item = (event.target as HTMLElement).closest<HTMLElement>(".sug");
      if (!item?.dataset.cmd) return;
      event.preventDefault();
      input.value = `${item.dataset.cmd} `;
      closeSugs();
      input.focus();
    },
    { signal }
  );

  out.addEventListener(
    "click",
    event => {
      const item = (event.target as HTMLElement).closest<HTMLElement>(".t-opt");
      if (item) activate(item);
    },
    { signal }
  );

  tabs.addEventListener(
    "click",
    event => {
      const tab = (event.target as HTMLElement).closest<HTMLElement>("button");
      if (tab?.dataset.tag) setTag(tab.dataset.tag);
    },
    { signal }
  );

  more.addEventListener("click", () => loadMore(), { signal });

  // clicking empty space focuses the prompt, like a real terminal
  root.querySelector(".term-main")!.addEventListener(
    "click",
    event => {
      const target = event.target as HTMLElement;
      if (target.closest("a, button, input, .t-opt, .sug")) return;
      if (window.getSelection()?.toString()) return;
      input.focus({ preventScroll: true });
    },
    { signal }
  );

  // rotate the placeholder through a few commands worth trying
  const hints = ["/help", "/posts", "/read", "/tags", "/theme", "/activities"];
  let hintIndex = 0;
  const hintTimer = window.setInterval(() => {
    hintIndex = (hintIndex + 1) % hints.length;
    input.placeholder = hints[hintIndex];
  }, 2600);

  signal.addEventListener("abort", () => {
    window.clearInterval(hintTimer);
    timers.forEach(id => window.clearTimeout(id));
    closeMenu();
  });
  document.addEventListener("astro:before-swap", () => ctrl.abort(), {
    once: true,
  });

  scrollEnd();
  // skip autofocus on touch devices so the keyboard doesn't cover the feed
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    input.focus({ preventScroll: true });
  }
}

document.addEventListener("astro:page-load", initTerminal);
