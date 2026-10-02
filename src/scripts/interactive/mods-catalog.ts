import { h } from "./dom";

type Scope = "all" | "api" | "effect" | "pure";

interface Row {
  el: HTMLTableRowElement;
  kind: "api" | "effect" | "pure";
  text: string;
  /** 名詞セルが空の継続行（例: `.list`）に、絞り込み中だけ補う名詞 */
  ghost?: { cell: HTMLTableCellElement; noun: string };
}

const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "api", label: "$ API" },
  { id: "effect", label: "◆ 副作用あり" },
  { id: "pure", label: "◇ 副作用なし" },
];

/** 直前の見出し（h3 / h2）を探す。表だけ残って見出しが迷子にならないよう一緒に隠す */
function headingOf(table: HTMLElement): HTMLElement | null {
  let el = table.previousElementSibling;
  while (el && !/^H[23]$/.test(el.tagName)) el = el.previousElementSibling;
  return el?.tagName === "H3" ? (el as HTMLElement) : null;
}

/**
 * ラッパー内の Markdown の表（$ API / イベント一覧）を、その場で絞り込めるようにする。
 * 表そのものは Markdown のまま残すので、JS なしでも検索インデックスでも内容は変わらない。
 */
export function mount(root: HTMLElement) {
  const tables = [...root.querySelectorAll<HTMLTableElement>("table")];
  const groups = tables.map(table => {
    let noun = "";
    const rows: Row[] = [...table.tBodies[0].rows].map(el => {
      const first = el.cells[0];
      const mark = first.textContent?.trim() ?? "";
      if (mark === "◆" || mark === "◇") {
        return {
          el,
          kind: mark === "◆" ? "effect" : "pure",
          text: el.textContent!.toLowerCase(),
        };
      }
      if (mark) noun = mark;
      // `$.ui` + `.log` のように、名詞と動詞をつないだ形でも引けるようにする
      const verbs = [...el.cells[1].querySelectorAll("code")].map(
        c => noun + c.textContent
      );
      return {
        el,
        kind: "api",
        text: [noun, el.textContent, ...verbs].join(" ").toLowerCase(),
        ghost: mark ? undefined : { cell: first, noun },
      };
    });
    return { table, heading: headingOf(table), rows };
  });

  let scope: Scope = "all";
  const input = h("input", {
    type: "search",
    class: "ix-input",
    placeholder: "例: fs.read / 描画 / deny",
    "aria-label": "API とイベントを絞り込む",
  });
  const count = h("span", { class: "ix-count", "aria-live": "polite" });
  const empty = h(
    "p",
    { class: "ix-empty", hidden: true },
    "該当する API・イベントはありません"
  );

  const apply = () => {
    const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    const filtering = terms.length > 0 || scope !== "all";
    let shown = 0;
    let total = 0;
    for (const group of groups) {
      let groupShown = 0;
      for (const row of group.rows) {
        const visible =
          (scope === "all" || scope === row.kind) &&
          terms.every(t => row.text.includes(t));
        row.el.hidden = !visible;
        if (row.ghost) {
          row.ghost.cell.textContent = filtering ? row.ghost.noun : "";
          row.ghost.cell.classList.toggle("ix-ghost", filtering);
        }
        total += 1;
        if (visible) groupShown += 1;
      }
      group.table.hidden = groupShown === 0;
      if (group.heading) group.heading.hidden = groupShown === 0;
      shown += groupShown;
    }
    count.textContent = filtering ? `${shown} / ${total} 件` : `${total} 件`;
    empty.hidden = shown > 0;
  };

  const scopeButtons = SCOPES.map(s =>
    h(
      "button",
      {
        type: "button",
        class: "ix-chip",
        "aria-pressed": String(s.id === scope),
        onclick: () => {
          scope = s.id;
          for (const [i, b] of scopeButtons.entries())
            b.setAttribute("aria-pressed", String(SCOPES[i].id === scope));
          apply();
        },
      },
      s.label
    )
  );
  input.addEventListener("input", apply);

  root.prepend(
    h(
      "div",
      { class: "ix ix-filter not-prose", "data-pagefind-ignore": true },
      h("div", { class: "ix-filter-row" }, input, count),
      h(
        "div",
        { class: "ix-chips", role: "group", "aria-label": "種類" },
        scopeButtons
      ),
      empty
    )
  );
  apply();
}
