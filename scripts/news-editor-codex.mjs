import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const clientInfo = {
  name: "noguchy-news-studio",
  title: "News Studio",
  version: "1.0.0",
};

const errorText = error =>
  error instanceof Error ? error.message : String(error);

export function createCodexClient({ cwd }) {
  const executable = process.env.NEWS_EDITOR_CODEX || "codex";
  let child = null;
  let lines = null;
  let nextId = 1;
  let threadId = null;
  let startup = null;
  let activeTurn = null;
  const pending = new Map();

  function reset(error) {
    const reason = error instanceof Error ? error : new Error(String(error));
    for (const request of pending.values()) request.reject(reason);
    pending.clear();
    activeTurn?.reject(reason);
    activeTurn = null;
    threadId = null;
    startup = null;
    lines?.close();
    lines = null;
    child = null;
  }

  function send(message) {
    if (!child?.stdin.writable)
      throw new Error("Codex App Serverとの接続が切れました。");
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      try {
        send({ id, method, params });
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  }

  function handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.id !== undefined && pending.has(message.id)) {
      const pendingRequest = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        pendingRequest.reject(
          new Error(
            message.error.message || "Codex App Serverでエラーが発生しました。"
          )
        );
      } else pendingRequest.resolve(message.result);
    }
    if (message.method === "item/agentMessage/delta" && activeTurn) {
      const params = message.params || {};
      if (!activeTurn.turnId || params.turnId === activeTurn.turnId)
        activeTurn.output +=
          typeof params.delta === "string" ? params.delta : "";
    }
    if (message.method === "turn/completed" && activeTurn) {
      const params = message.params || {};
      const turn = params.turn || {};
      if (!activeTurn.turnId || turn.id === activeTurn.turnId) {
        if (turn.status === "failed" || turn.error) {
          activeTurn.reject(
            new Error(turn.error?.message || "Codexの回答生成に失敗しました。")
          );
        } else if (activeTurn.output.trim()) {
          activeTurn.resolve(activeTurn.output.trim());
        } else {
          const item = turn.items?.find(item => item.type === "agentMessage");
          activeTurn.resolve(typeof item?.text === "string" ? item.text : "");
        }
      }
    }
  }

  async function ensureThread() {
    if (threadId) return threadId;
    if (startup) return startup;
    startup = (async () => {
      child = spawn(executable, ["app-server", "--stdio"], {
        cwd,
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      lines = createInterface({ input: child.stdout });
      lines.on("line", handleLine);
      child.on("error", error => reset(error));
      child.on("close", code => {
        if (child)
          reset(
            new Error(`Codex App Serverが終了しました（${code ?? "不明"}）。`)
          );
      });
      const stderr = [];
      child.stderr.on("data", chunk => {
        stderr.push(String(chunk));
        if (stderr.length > 8) stderr.shift();
      });
      try {
        await request("initialize", { clientInfo });
        send({ method: "initialized", params: {} });
        const result = await request("thread/start", {
          cwd,
          approvalPolicy: "never",
          sandbox: "read-only",
          serviceName: "noguchy-news-studio",
        });
        threadId = result?.thread?.id || null;
        if (!threadId)
          throw new Error("Codexの編集スレッドを開始できませんでした。");
        return threadId;
      } catch (error) {
        const detail = stderr.join("").trim();
        throw new Error(
          detail
            ? `${errorText(error)}\n${detail.slice(-1000)}`
            : errorText(error)
        );
      } finally {
        startup = null;
      }
    })();
    return startup;
  }

  async function status() {
    if (child && threadId)
      return { available: true, connected: true, threadId };
    return new Promise(resolve => {
      const probe = spawn(executable, ["--version"], {
        cwd,
        env: process.env,
        stdio: ["ignore", "ignore", "ignore"],
      });
      const timer = setTimeout(() => {
        probe.kill();
        resolve({ available: false, connected: false });
      }, 2000);
      probe.once("error", () => {
        clearTimeout(timer);
        resolve({ available: false, connected: false });
      });
      probe.once("close", code => {
        clearTimeout(timer);
        resolve({ available: code === 0, connected: false });
      });
    });
  }

  async function ask(prompt) {
    if (activeTurn)
      throw new Error("別の回答を生成中です。しばらくお待ちください。");
    const currentThreadId = await ensureThread();
    const answer = new Promise((resolve, reject) => {
      activeTurn = { turnId: null, output: "", resolve, reject };
      setTimeout(() => {
        if (activeTurn?.resolve === resolve) {
          activeTurn = null;
          reject(new Error("Codexの回答がタイムアウトしました。"));
        }
      }, 120000).unref();
    });
    try {
      const result = await request("turn/start", {
        threadId: currentThreadId,
        input: [{ type: "text", text: prompt }],
      });
      if (activeTurn) activeTurn.turnId = result?.turn?.id || null;
      return await answer;
    } finally {
      activeTurn = null;
    }
  }

  return { ask, status };
}
