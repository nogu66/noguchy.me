import { createPlayer, h } from "./dom";
import {
  PATTERNS,
  SAMPLES,
  runNext,
  type Lane,
  type NextRun,
  type PatternId,
  type SampleId,
} from "./mods-sim";

const LANES: { id: Lane; label: string }[] = [
  { id: "engine", label: "エンジン" },
  { id: "handler", label: "あなたのハンドラ" },
  { id: "core", label: "内側のフック → core" },
];

export function mount(root: HTMLElement) {
  let patternId: PatternId = "early";
  let sampleId: SampleId = "rm";
  let run: NextRun = runNext(patternId, sampleId);

  const segment = <T extends string>(
    label: string,
    items: { id: T; label: string }[],
    current: () => T,
    select: (id: T) => void
  ) => {
    const buttons = items.map(item =>
      h(
        "button",
        {
          type: "button",
          class: "ix-chip",
          "aria-pressed": String(item.id === current()),
          onclick: () => {
            select(item.id);
            for (const [i, b] of buttons.entries())
              b.setAttribute("aria-pressed", String(items[i].id === current()));
          },
        },
        item.label
      )
    );
    return h(
      "div",
      { class: "ix-field", role: "group", "aria-label": label },
      h("span", { class: "ix-label" }, label),
      h("div", { class: "ix-chips" }, buttons)
    );
  };

  const lanes = LANES.map(l =>
    h("div", { class: "ix-lane", "data-lane": l.id }, l.label)
  );
  const code = h("div", { class: "ix-code", "aria-label": "ハンドラのコード" });
  const log = h("ol", { class: "ix-log", "aria-live": "polite" });
  const result = h("div", { class: "ix-result", hidden: true });
  const playButton = h(
    "button",
    { type: "button", class: "ix-btn ix-btn-primary" },
    "▶ 実行"
  );

  const renderCode = () => {
    const pattern = PATTERNS.find(p => p.id === patternId)!;
    code.replaceChildren(
      ...pattern.code.map((line, i) =>
        h("div", { class: "ix-code-line", "data-line": i }, line || " ")
      )
    );
  };

  const resetView = () => {
    player.reset();
    run = runNext(patternId, sampleId);
    renderCode();
    for (const lane of lanes) lane.classList.remove("is-active");
    log.replaceChildren(
      h(
        "li",
        { class: "ix-log-empty" },
        "「▶ 実行」を押すと、1ステップずつ進みます"
      )
    );
    result.hidden = true;
  };

  const showStep = (index: number) => {
    const step = run.steps[index];
    for (const lane of lanes)
      lane.classList.toggle("is-active", lane.dataset.lane === step.lane);
    for (const line of code.children)
      line.classList.toggle(
        "is-active",
        step.line !== null &&
          (line as HTMLElement).dataset.line === String(step.line)
      );

    if (index === 0) log.replaceChildren();
    log.querySelector(".is-current")?.classList.remove("is-current");
    log.append(
      h(
        "li",
        { class: "is-current" },
        h(
          "span",
          { class: "ix-log-at", "data-lane": step.lane },
          LANES.find(l => l.id === step.lane)!.label
        ),
        h("span", { class: "ix-log-note" }, step.note),
        step.payload
          ? h("code", { class: "ix-log-payload" }, step.payload)
          : null
      )
    );

    if (index === run.steps.length - 1) showResult();
  };

  const showResult = () => {
    const dangerous = run.executed && sampleId === "rm";
    const status = run.denied
      ? { tone: "deny", text: "拒否：ツールは実行されませんでした" }
      : dangerous
        ? { tone: "warn", text: "実行されてしまった：このハンドラは止めません" }
        : { tone: "ok", text: "実行されました" };
    result.replaceChildren(
      h("span", { class: `ix-status ix-status-${status.tone}` }, status.text),
      h("span", { class: "ix-label" }, "エンジンに返った値"),
      h("code", { class: "ix-result-value" }, run.result)
    );
    result.hidden = false;
  };

  const player = createPlayer(
    root,
    () => run.steps.length,
    showStep,
    playing => {
      playButton.textContent = playing ? "再生中…" : "▶ 実行";
      playButton.disabled = playing;
    }
  );
  playButton.addEventListener("click", () => {
    if (player.index === -1 || player.done) resetView();
    player.play();
  });

  root.replaceChildren(
    h(
      "div",
      { class: "ix not-prose", "data-pagefind-ignore": true },
      h(
        "div",
        { class: "ix-head" },
        h("span", { class: "ix-badge" }, "試してみる"),
        h("span", { class: "ix-title" }, "next() の3パターンを動かす")
      ),
      h(
        "div",
        { class: "ix-controls" },
        segment(
          "パターン",
          PATTERNS,
          () => patternId,
          id => {
            patternId = id;
            resetView();
          }
        ),
        segment(
          "ツール呼び出し",
          SAMPLES,
          () => sampleId,
          id => {
            sampleId = id;
            resetView();
          }
        )
      ),
      h(
        "div",
        { class: "ix-lanes" },
        lanes.flatMap((lane, i) =>
          i === 0
            ? [lane]
            : [
                h(
                  "span",
                  { class: "ix-lane-arrow", "aria-hidden": "true" },
                  "⇄"
                ),
                lane,
              ]
        )
      ),
      code,
      h(
        "div",
        { class: "ix-actions" },
        playButton,
        h(
          "button",
          {
            type: "button",
            class: "ix-btn",
            onclick: () => {
              if (player.index === -1 || player.done) resetView();
              player.step();
            },
          },
          "1ステップ"
        ),
        h(
          "button",
          { type: "button", class: "ix-btn", onclick: resetView },
          "リセット"
        )
      ),
      log,
      result
    )
  );
  resetView();
}
