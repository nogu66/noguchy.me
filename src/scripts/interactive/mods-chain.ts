import { createPlayer, h } from "./dom";
import {
  CHAIN_EVENT,
  CHAIN_PRESETS,
  DEFAULT_CHAIN,
  TIERS,
  formatResult,
  isDeny,
  runChain,
  type Behavior,
  type ChainConfig,
  type ChainRun,
  type Tier,
} from "./mods-sim";

type At = Tier | "core";

const sameConfig = (a: ChainConfig, b: ChainConfig) =>
  TIERS.every(t => a[t.id] === b[t.id]);

export function mount(root: HTMLElement) {
  let config: ChainConfig = { ...DEFAULT_CHAIN };
  let run: ChainRun = runChain(config);

  const boxes = new Map<At, HTMLElement>();
  const marks = new Map<At, HTMLElement>();
  const selects = new Map<Tier, HTMLSelectElement>();

  const presetButtons = CHAIN_PRESETS.map(preset =>
    h(
      "button",
      {
        type: "button",
        class: "ix-chip",
        onclick: () => {
          config = { ...preset.config };
          for (const [tier, select] of selects) select.value = config[tier];
          resetView();
        },
      },
      preset.label
    )
  );

  // 内側から組み立てて入れ子にする: prepend(user(append(builtin(core))))
  const mark = (at: At) => {
    const el = h("span", { class: "ix-tier-mark", "aria-hidden": "true" });
    marks.set(at, el);
    return el;
  };
  let inner: HTMLElement = h(
    "div",
    { class: "ix-tier ix-tier-core" },
    h(
      "div",
      { class: "ix-tier-head" },
      h("span", { class: "ix-tier-name" }, "core"),
      h("span", { class: "ix-tier-owner" }, "エンジン本体：ツールを実行"),
      mark("core")
    )
  );
  boxes.set("core", inner);

  for (const tier of [...TIERS].reverse()) {
    const select = h(
      "select",
      {
        class: "ix-select",
        "aria-label": `${tier.id} の振る舞い`,
        onchange: () => {
          config = { ...config, [tier.id]: select.value as Behavior };
          resetView();
        },
      },
      Object.entries(tier.behaviors).map(([value, label]) =>
        h("option", { value }, label)
      )
    );
    select.value = config[tier.id];
    selects.set(tier.id, select);

    inner = h(
      "div",
      { class: "ix-tier", "data-tier": tier.id },
      h(
        "div",
        { class: "ix-tier-head" },
        h("span", { class: "ix-tier-name" }, tier.id),
        h("span", { class: "ix-tier-owner" }, tier.owner),
        mark(tier.id),
        select
      ),
      inner
    );
    boxes.set(tier.id, inner);
  }
  const onion = inner;

  const log = h("ol", { class: "ix-log", "aria-live": "polite" });
  const result = h("div", { class: "ix-result", hidden: true });
  const playButton = h(
    "button",
    { type: "button", class: "ix-btn ix-btn-primary" },
    "▶ 実行"
  );

  const resetView = () => {
    player.reset();
    run = runChain(config);
    for (const [i, b] of presetButtons.entries())
      b.setAttribute(
        "aria-pressed",
        String(sameConfig(CHAIN_PRESETS[i].config, config))
      );
    for (const box of boxes.values())
      box.classList.remove("is-active", "is-visited", "is-unreached");
    for (const m of marks.values()) m.textContent = "";
    log.replaceChildren(
      h(
        "li",
        { class: "ix-log-empty" },
        "「▶ 実行」を押すと、イベントが外側から内側へ進み、結果が外側へ戻ります"
      )
    );
    result.hidden = true;
  };

  const showStep = (index: number) => {
    const step = run.steps[index];
    for (const [at, box] of boxes) {
      const active = at === step.at;
      box.classList.toggle("is-active", active);
      if (active) box.classList.add("is-visited");
      marks.get(at)!.textContent = active
        ? step.dir === "down"
          ? "↓ 下り"
          : "↑ 上り"
        : "";
    }

    if (index === 0) log.replaceChildren();
    log.querySelector(".is-current")?.classList.remove("is-current");
    const payload = step.e
      ? `command: "${step.e.command}"`
      : step.r
        ? formatResult(step.r)
        : null;
    log.append(
      h(
        "li",
        { class: "is-current" },
        h(
          "span",
          { class: "ix-log-dir", "data-dir": step.dir },
          step.dir === "down" ? "↓" : "↑"
        ),
        h("span", { class: "ix-log-at" }, step.at),
        h("span", { class: "ix-log-note" }, step.note),
        payload ? h("code", { class: "ix-log-payload" }, payload) : null
      )
    );

    if (index === run.steps.length - 1) showResult();
  };

  const showResult = () => {
    for (const box of boxes.values()) {
      box.classList.remove("is-active");
      if (!box.classList.contains("is-visited"))
        box.classList.add("is-unreached");
    }
    for (const [at, m] of marks)
      m.textContent = boxes.get(at)!.classList.contains("is-unreached")
        ? "届かず"
        : "";

    const denied = isDeny(run.result);
    result.replaceChildren(
      h(
        "span",
        { class: `ix-status ix-status-${denied ? "deny" : "ok"}` },
        denied
          ? "拒否：core は実行されませんでした"
          : "core でツールが実行されました"
      ),
      h("span", { class: "ix-label" }, "core で実行されたコマンド"),
      h("code", { class: "ix-result-value" }, run.executed ?? "（実行されず）"),
      h("span", { class: "ix-label" }, "エンジンに返った値"),
      h("code", { class: "ix-result-value" }, formatResult(run.result))
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
    },
    650
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
        h("span", { class: "ix-title" }, "5層チェーン・シミュレーター")
      ),
      h(
        "p",
        { class: "ix-desc" },
        "各層の振る舞いを切り替えて、",
        h(
          "code",
          null,
          `e = { tool: "Bash", command: "${CHAIN_EVENT.command}" }`
        ),
        " がどこまで届き、何が返るかを確かめてみてください。"
      ),
      h(
        "div",
        { class: "ix-field", role: "group", "aria-label": "プリセット" },
        h("span", { class: "ix-label" }, "プリセット"),
        h("div", { class: "ix-chips" }, presetButtons)
      ),
      h("div", { class: "ix-onion" }, onion),
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
