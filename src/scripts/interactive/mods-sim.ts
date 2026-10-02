/**
 * Claude Mods 記事のインタラクティブ図解で使うシミュレーション（DOM 非依存）。
 * 実際の Function Hooks と同じく「next(e) を呼ぶ = 自分より内側をすべて実行する」
 * という再帰で動かし、各ステップを記録して UI 側でアニメーションさせる。
 */

/* ========== next() パターン ========== */

export type PatternId = "early" | "after" | "rewrite";
export type SampleId = "rm" | "ls" | "env";
export type Lane = "engine" | "handler" | "core";

export interface Pattern {
  id: PatternId;
  label: string;
  matcher: "Bash" | "Read" | null;
  code: string[];
}

export interface Sample {
  id: SampleId;
  label: string;
  e: { tool: "Bash"; command: string } | { tool: "Read"; file_path: string };
  output: string;
  ms: number;
}

export interface NextStep {
  lane: Lane;
  line: number | null;
  note: string;
  payload?: string;
}

export interface NextRun {
  steps: NextStep[];
  result: string;
  denied: boolean;
  executed: boolean;
}

export const PATTERNS: Pattern[] = [
  {
    id: "early",
    label: "早期リターン",
    matcher: "Bash",
    code: [
      `on("tool.call", { tool: "Bash" }, async ($, e, next) => {`,
      `  if (e.command.includes("rm -rf /")) return { deny: "no" }`,
      `  return next(e)`,
      `})`,
    ],
  },
  {
    id: "after",
    label: "後処理",
    matcher: null,
    code: [
      `on("tool.call", async ($, e, next) => {`,
      `  const start = Date.now()`,
      `  const r = await next(e)`,
      "  $.ui.log(`${e.tool}: ${Date.now() - start}ms`)",
      `  return r`,
      `})`,
    ],
  },
  {
    id: "rewrite",
    label: "結果の書き換え",
    matcher: "Read",
    code: [
      `on("tool.call", { tool: "Read" }, async ($, e, next) => {`,
      `  const r = await next(e)`,
      `  return { ...r, text: r.text.replace(/sk-[a-zA-Z0-9]+/g, "[REDACTED]") }`,
      `})`,
    ],
  },
];

export const SAMPLES: Sample[] = [
  {
    id: "rm",
    label: "Bash: rm -rf /",
    e: { tool: "Bash", command: "rm -rf /" },
    output: "（/ 以下をすべて削除しました）",
    ms: 1840,
  },
  {
    id: "ls",
    label: "Bash: ls",
    e: { tool: "Bash", command: "ls" },
    output: "README.md  package.json  src",
    ms: 12,
  },
  {
    id: "env",
    label: "Read: .env",
    e: { tool: "Read", file_path: ".env" },
    output: "API_KEY=sk-a8F3kd92LxQ\nDEBUG=true",
    ms: 3,
  },
];

export function formatEvent(e: Sample["e"]): string {
  return e.tool === "Bash"
    ? `{ tool: "Bash", command: "${e.command}" }`
    : `{ tool: "Read", file_path: "${e.file_path}" }`;
}

const textResult = (text: string) => `{ text: ${JSON.stringify(text)} }`;

export function runNext(patternId: PatternId, sampleId: SampleId): NextRun {
  const pattern = PATTERNS.find(p => p.id === patternId)!;
  const sample = SAMPLES.find(s => s.id === sampleId)!;
  const { e } = sample;
  const steps: NextStep[] = [
    {
      lane: "engine",
      line: null,
      note: "エンジンが tool.call を発火",
      payload: `e = ${formatEvent(e)}`,
    },
  ];
  const core = (note: string): NextStep => ({
    lane: "core",
    line: null,
    note,
    payload: sample.output,
  });
  const finish = (result: string, denied = false): NextRun => {
    steps.push({
      lane: "engine",
      line: null,
      note: denied
        ? "拒否を受け取る。ツールは実行されない"
        : "結果を受け取り、モデルに渡す",
      payload: result,
    });
    return { steps, result, denied, executed: !denied };
  };

  if (pattern.matcher && e.tool !== pattern.matcher) {
    steps.push({
      lane: "handler",
      line: 0,
      note: `マッチャー { tool: "${pattern.matcher}" } に一致しないので、このハンドラは呼ばれない`,
    });
    steps.push(core("内側のフック → core がそのままツールを実行"));
    return finish(textResult(sample.output));
  }

  steps.push({
    lane: "handler",
    line: 0,
    note: pattern.matcher
      ? `マッチャー { tool: "${pattern.matcher}" } に一致 → ハンドラを実行`
      : "マッチャーなし → すべての tool.call でハンドラを実行",
  });

  if (pattern.id === "early") {
    if (e.tool === "Bash" && e.command.includes("rm -rf /")) {
      steps.push({
        lane: "handler",
        line: 1,
        note: "rm -rf / を含むので、next を呼ばずに { deny } を返す",
      });
      return finish(`{ deny: "no" }`, true);
    }
    steps.push({
      lane: "handler",
      line: 1,
      note: "条件に当たらないので次の行へ",
    });
    steps.push({
      lane: "handler",
      line: 2,
      note: "next(e) で内側（他のフック → core）に処理を渡す",
    });
    steps.push(core("core がツールを実行"));
    steps.push({
      lane: "handler",
      line: 2,
      note: "next の結果をそのまま return",
    });
    return finish(textResult(sample.output));
  }

  if (pattern.id === "after") {
    steps.push({ lane: "handler", line: 1, note: "開始時刻を記録" });
    steps.push({
      lane: "handler",
      line: 2,
      note: "await next(e) で、先に内側のフック → core を実行",
    });
    steps.push(core("core がツールを実行"));
    steps.push({ lane: "handler", line: 2, note: "結果 r が戻ってくる" });
    steps.push({
      lane: "handler",
      line: 3,
      note: "$.ui.log でトランスクリプトに1行出す",
      payload: `${e.tool}: ${sample.ms}ms`,
    });
    steps.push({ lane: "handler", line: 4, note: "r は加工せずに返す" });
    return finish(textResult(sample.output));
  }

  const redacted = sample.output.replace(/sk-[a-zA-Z0-9]+/g, "[REDACTED]");
  steps.push({
    lane: "handler",
    line: 1,
    note: "await next(e) で、先に core に Read を実行させる",
  });
  steps.push(core("core がファイルを読む"));
  steps.push({ lane: "handler", line: 1, note: "結果 r が戻ってくる" });
  steps.push({
    lane: "handler",
    line: 2,
    note: "r.text の sk-... を [REDACTED] に置き換えて返す",
    payload: redacted,
  });
  return finish(textResult(redacted));
}

/* ========== 5層チェーン ========== */

export type Tier = "prepend" | "user" | "append" | "builtin";
export type Behavior = "pass" | "deny" | "input" | "result";

export interface BashEvent {
  tool: "Bash";
  command: string;
}
export type ToolResult = { text: string } | { deny: string };
export type ChainConfig = Record<Tier, Behavior>;

export interface TierSpec {
  id: Tier;
  owner: string;
  behaviors: Partial<Record<Behavior, string>>;
}

export interface ChainStep {
  at: Tier | "core" | "engine";
  dir: "down" | "up";
  note: string;
  e?: BashEvent;
  r?: ToolResult;
}

export interface ChainRun {
  steps: ChainStep[];
  result: ToolResult;
  executed: string | null;
}

/** 外側から順に並べる。prepend(user(append(builtin(core)))) */
export const TIERS: TierSpec[] = [
  {
    id: "prepend",
    owner: "組織ポリシー",
    behaviors: { pass: "素通り", deny: "拒否", result: "結果に監査タグ" },
  },
  {
    id: "user",
    owner: "あなたのMod",
    behaviors: {
      pass: "素通り",
      deny: "拒否",
      input: "--force-with-lease に書き換え",
      result: "結果に所要時間を追記",
    },
  },
  {
    id: "append",
    owner: "組織ポリシー",
    behaviors: { pass: "素通り", deny: "拒否", input: "timeout 60 を付ける" },
  },
  {
    id: "builtin",
    owner: "バイナリ同梱",
    behaviors: { pass: "素通り", deny: "拒否" },
  },
];

export const CHAIN_EVENT: BashEvent = {
  tool: "Bash",
  command: "git push --force",
};

export const DEFAULT_CHAIN: ChainConfig = {
  prepend: "pass",
  user: "pass",
  append: "pass",
  builtin: "pass",
};

export const CHAIN_PRESETS: { label: string; config: ChainConfig }[] = [
  { label: "出荷時のまま", config: DEFAULT_CHAIN },
  {
    label: "prepend が先に拒否",
    config: { ...DEFAULT_CHAIN, prepend: "deny", user: "input" },
  },
  {
    label: "user が通しても append が拒否",
    config: { ...DEFAULT_CHAIN, user: "input", append: "deny" },
  },
  {
    label: "最後に入力を見るのは append",
    config: { ...DEFAULT_CHAIN, user: "input", append: "input" },
  },
  {
    label: "最後に結果を見るのは prepend",
    config: { ...DEFAULT_CHAIN, prepend: "result", user: "result" },
  },
];

const DENY_REASON: Record<Tier, string> = {
  prepend: "org: force push は禁止",
  user: "user: 自分で止めた",
  append: "org: force push は禁止",
  builtin: "permission: 未承認",
};

const RESULT_SUFFIX: Partial<Record<Tier, string>> = {
  prepend: " [audit: org]",
  user: " (1.2s)",
};

function rewriteInput(tier: Tier, command: string): string {
  if (tier === "user")
    return command.replace(/--force(?!-with-lease)/, "--force-with-lease");
  if (tier === "append") return `timeout 60 ${command}`;
  return command;
}

export const isDeny = (r: ToolResult): r is { deny: string } => "deny" in r;

export function formatResult(r: ToolResult): string {
  return isDeny(r)
    ? `{ deny: ${JSON.stringify(r.deny)} }`
    : `{ text: ${JSON.stringify(r.text)} }`;
}

export function runChain(
  config: ChainConfig,
  event: BashEvent = CHAIN_EVENT
): ChainRun {
  const order = TIERS.map(t => t.id);
  const steps: ChainStep[] = [
    {
      at: "engine",
      dir: "down",
      note: "エンジンが tool.call を発火",
      e: event,
    },
  ];
  let executed: string | null = null;

  const dispatch = (i: number, e: BashEvent): ToolResult => {
    if (i === order.length) {
      executed = e.command;
      steps.push({ at: "core", dir: "down", note: "ツールを実行", e });
      const r = {
        text: e.command.includes("--force-with-lease")
          ? "main -> main (forced update, lease OK)"
          : "main -> main (forced update)",
      };
      steps.push({ at: "core", dir: "up", note: "実行結果を返す", r });
      return r;
    }

    const tier = order[i];
    const behavior = config[tier];

    if (behavior === "deny") {
      steps.push({ at: tier, dir: "down", note: "e を受け取る", e });
      const r = { deny: DENY_REASON[tier] };
      steps.push({
        at: tier,
        dir: "up",
        note: "next を呼ばずに { deny } を返す。内側には届かない",
        r,
      });
      return r;
    }

    let inner = e;
    if (behavior === "input") {
      inner = { ...e, command: rewriteInput(tier, e.command) };
      steps.push({
        at: tier,
        dir: "down",
        note: "e.command を書き換えて next(e) を呼ぶ",
        e: inner,
      });
    } else {
      steps.push({ at: tier, dir: "down", note: "そのまま next(e) を呼ぶ", e });
    }

    const r = dispatch(i + 1, inner);

    if (behavior === "result") {
      if (isDeny(r)) {
        steps.push({
          at: tier,
          dir: "up",
          note: "拒否された結果なので、加工せずに返す",
          r,
        });
        return r;
      }
      const modified = { text: r.text + (RESULT_SUFFIX[tier] ?? "") };
      steps.push({
        at: tier,
        dir: "up",
        note: "結果を加工して返す",
        r: modified,
      });
      return modified;
    }

    steps.push({ at: tier, dir: "up", note: "結果をそのまま返す", r });
    return r;
  };

  const result = dispatch(0, event);
  steps.push({
    at: "engine",
    dir: "up",
    note: isDeny(result)
      ? "拒否を受け取る。ツールは実行されない"
      : "結果を受け取り、モデルに渡す",
    r: result,
  });
  return { steps, result, executed };
}
