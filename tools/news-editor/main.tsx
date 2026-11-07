import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { stringify } from "yaml";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Circle,
  CloudCheck,
  CloudUpload,
  Download,
  FileText,
  ImagePlus,
  LayoutList,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import RichEditor from "./RichEditor";
import {
  api,
  dateInput,
  fingerprint,
  needsSourceMode,
  newArticle,
  uploadImage,
  type Article,
} from "./model";
import "./style.css";
import { acceptAutoSave, canAutoSave, repositoryChange } from "./sync";

type Summary = Omit<Article, "body">;
type Cache = { article: Article; baseline: string; at: number };
type PublishState = {
  deployedAt: string | null;
  articles: Record<string, string>;
};
type Publication = {
  label: string;
  detail: string;
  tone: "published" | "pending" | "draft" | "unknown";
};
type AssistKind = "title" | "summary" | "body" | "outline";
type CodexStatus = {
  available: boolean;
  connected: boolean;
  threadId?: string | null;
};
type AssistantMessage = {
  role: "user" | "assistant";
  text: string;
  kind?: AssistKind;
};
const emptyPublishState: PublishState = { deployedAt: null, articles: {} };
const storageKey = (key: string) => `noguchy.news.studio.v1:${key}`;
const formatDate = (value: string) =>
  Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat("ja-JP", {
        month: "short",
        day: "numeric",
        timeZone: "Asia/Tokyo",
      }).format(new Date(value))
    : "日時未設定";
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "処理に失敗しました。";
const publishDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        timeZone: "Asia/Tokyo",
      }).format(new Date(value))
    : "未確認";

function publicationOf(
  article: Summary | Article,
  state: PublishState,
  dirty = false
): Publication {
  const deployedRevision = state.articles[article.id];
  if (!article.published) {
    return deployedRevision
      ? {
          label: "公開停止待ち",
          detail: "公開ページには前の版が残っています。",
          tone: "pending",
        }
      : {
          label: "下書き",
          detail: "公開設定を「公開対象」にすると公開できます。",
          tone: "draft",
        };
  }
  if (dirty)
    return {
      label: article.revision ? "変更あり・未公開" : "未保存・未公開",
      detail: "「保存して公開」を押すとサイトに反映されます。",
      tone: "pending",
    };
  if (!state.deployedAt)
    return {
      label: "公開状況未確認",
      detail: "「保存して公開」で公開状態を記録できます。",
      tone: "unknown",
    };
  if (deployedRevision === article.revision)
    return {
      label: "公開済み",
      detail: `最終公開 ${publishDate(state.deployedAt)}`,
      tone: "published",
    };
  return {
    label: deployedRevision ? "未公開の変更" : "公開待ち",
    detail: "「保存して公開」を押すとサイトに反映されます。",
    tone: "pending",
  };
}

function App() {
  const [articles, setArticles] = useState<Summary[]>([]);
  const [publishState, setPublishState] =
    useState<PublishState>(emptyPublishState);
  const [draft, setDraft] = useState<Article | null>(null);
  const [session, setSession] = useState("");
  const [baseline, setBaseline] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [mode, setMode] = useState<"write" | "source" | "preview">("write");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [syncIssue, setSyncIssue] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localSaved, setLocalSaved] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [settings, setSettings] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [assistantKind, setAssistantKind] = useState<AssistKind | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<
    AssistantMessage[]
  >([]);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [codexStatus, setCodexStatus] = useState<CodexStatus | null>(null);
  const [tagText, setTagText] = useState("");
  const [editorVersion, setEditorVersion] = useState(0);
  const coverInput = useRef<HTMLInputElement>(null);
  const assistantMessagesRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<() => void>(() => {});
  const busy = saving || publishing || uploading || loading;
  const latest = useRef({ draft, session, baseline, busy, tagText });
  latest.current = { draft, session, baseline, busy, tagText };
  const saveInFlight = useRef(false);
  const failedAutoSave = useRef("");
  const dirty = !!draft && fingerprint(draft) !== baseline;

  function persist() {
    const current = latest.current;
    if (!current.draft || !current.session) return true;
    try {
      if (fingerprint(current.draft) === current.baseline)
        localStorage.removeItem(storageKey(current.session));
      else
        localStorage.setItem(
          storageKey(current.session),
          JSON.stringify({
            article: current.draft,
            baseline: current.baseline,
            at: Date.now(),
          })
        );
      setLocalSaved(true);
      return true;
    } catch {
      setError(
        "ブラウザへの自動退避ができません。画面を閉じる前に保存、またはMarkdownをダウンロードしてください。"
      );
      return false;
    }
  }
  async function refreshList() {
    const result = await api<{
      articles: Summary[];
      warnings: string[];
      deployment?: PublishState;
    }>("/api/articles");
    setArticles(result.articles);
    setPublishState(result.deployment ?? emptyPublishState);
    if (result.warnings.length) setError(result.warnings.join("\n"));
    return result.articles;
  }
  function activate(article: Article, key: string, recover = true) {
    setAssistantMessages([]);
    setAssistantAnswer("");
    setAssistantKind(null);
    setSyncIssue("");
    failedAutoSave.current = "";
    let value = article,
      base = fingerprint(article),
      recovered = false;
    try {
      const stored = localStorage.getItem(storageKey(key));
      if (stored && recover) {
        const cache: Cache = JSON.parse(stored);
        if (
          cache.article &&
          typeof cache.article.body === "string" &&
          typeof cache.article.title === "string" &&
          Array.isArray(cache.article.tags) &&
          Array.isArray(cache.article.contents) &&
          typeof cache.baseline === "string" &&
          fingerprint(cache.article) !== base
        ) {
          value = cache.article;
          base = cache.baseline;
          recovered = true;
        }
      }
      localStorage.setItem("noguchy.news.studio.last", key);
    } catch {
      /* A malformed cache must not prevent opening a repository article. */
    }
    setDraft(value);
    setBaseline(base);
    setSession(key);
    setMode(needsSourceMode(value.body) ? "source" : "write");
    setEditorVersion(version => version + 1);
    setTagText("");
    setLocalSaved(recovered);
    setNotice(recovered ? "保存前の入力内容を復元しました。" : "");
  }
  async function openArticle(id: string, recover = true) {
    if (saveInFlight.current) return;
    if (!persist()) return;
    setLoading(true);
    setError("");
    try {
      activate(
        await api<Article>(`/api/article?id=${encodeURIComponent(id)}`),
        id,
        recover
      );
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setLoading(false);
    }
  }
  function createNew() {
    if (saveInFlight.current) return;
    if (!persist()) return;
    activate(newArticle(), "new");
    setSettings(false);
    setError("");
  }
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await refreshList();
        if (!alive) return;
        let last = "new";
        try {
          last = localStorage.getItem("noguchy.news.studio.last") || "new";
        } catch {
          /* Optional convenience. */
        }
        if (last !== "new" && list.some(article => article.id === last))
          activate(
            await api<Article>(`/api/article?id=${encodeURIComponent(last)}`),
            last
          );
        else activate(newArticle(), "new");
      } catch (error) {
        if (alive) setError(messageOf(error));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const current = latest.current;
      if (current.draft && fingerprint(current.draft) !== current.baseline) {
        persist();
        event.preventDefault();
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", persist);
    window.addEventListener("keydown", keydown);
    return () => {
      alive = false;
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", persist);
      window.removeEventListener("keydown", keydown);
    };
  }, []);
  useEffect(() => {
    if (!assistantOpen || codexStatus) return;
    api<CodexStatus>("/api/codex/status")
      .then(setCodexStatus)
      .catch(() => setCodexStatus({ available: false, connected: false }));
  }, [assistantOpen, codexStatus]);
  useEffect(() => {
    if (assistantOpen && assistantMessagesRef.current)
      assistantMessagesRef.current.scrollTop =
        assistantMessagesRef.current.scrollHeight;
  }, [assistantMessages, assistantBusy, assistantOpen]);
  useEffect(() => {
    setLocalSaved(false);
    const timeout = window.setTimeout(persist, 500);
    return () => window.clearTimeout(timeout);
  }, [draft, baseline, session]);

  useEffect(() => {
    let stopped = false;
    let checking = false;
    const synchronize = async () => {
      if (checking || latest.current.busy || saveInFlight.current) return;
      checking = true;
      try {
        const before = latest.current;
        const list = await refreshList();
        const current = latest.current;
        if (stopped || current.busy || saveInFlight.current || !current.draft)
          return;
        if (
          before.session !== current.session ||
          before.draft?.revision !== current.draft.revision
        )
          return;
        const change = repositoryChange(
          current.draft,
          current.baseline,
          list.find(article => article.id === current.draft?.id),
          !!current.tagText.trim()
        );
        if (change === "unchanged") {
          setSyncIssue("");
          return;
        }
        if (change === "missing" || change === "conflict") {
          persist();
          setSyncIssue(
            change === "missing"
              ? "記事ファイルが削除されたか、読み取れません。入力内容を保持し、自動保存を停止しています。"
              : "この記事はリポジトリでも変更されました。入力内容を保持し、自動保存を停止しています。Markdownをダウンロードしてから、記事ファイルを読み直してください。"
          );
          return;
        }
        const article = await api<Article>(
          `/api/article?id=${encodeURIComponent(current.draft.id)}`
        );
        const now = latest.current;
        if (
          stopped ||
          now.busy ||
          saveInFlight.current ||
          now.session !== current.session ||
          !now.draft ||
          fingerprint(now.draft) !== now.baseline ||
          now.tagText.trim() ||
          now.draft.revision !== current.draft.revision
        )
          return;
        setDraft(article);
        setBaseline(fingerprint(article));
        setSyncIssue("");
        if (needsSourceMode(article.body)) setMode("source");
        setEditorVersion(version => version + 1);
        setNotice("リポジトリの変更を取り込みました。");
      } catch {
        if (!stopped)
          setSyncIssue(
            "同期できません。接続の回復後に再確認します。入力内容は保持されています。"
          );
      } finally {
        checking = false;
      }
    };
    const timer = window.setInterval(synchronize, 1000);
    window.addEventListener("focus", synchronize);
    document.addEventListener("visibilitychange", synchronize);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", synchronize);
      document.removeEventListener("visibilitychange", synchronize);
    };
  }, []);

  useEffect(() => {
    if (
      !draft ||
      !dirty ||
      busy ||
      autoSaving ||
      syncIssue ||
      tagText.trim() ||
      !canAutoSave(draft) ||
      failedAutoSave.current === fingerprint(draft)
    )
      return;
    const timer = window.setTimeout(() => {
      void save(true);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, busy, autoSaving, syncIssue, tagText]);

  function update(patch: Partial<Article>) {
    setDraft(current => (current ? { ...current, ...patch } : current));
  }
  async function save(automatic = false): Promise<Article | null> {
    if (!draft || busy || saveInFlight.current || syncIssue) return null;
    saveInFlight.current = true;
    if (automatic) setAutoSaving(true);
    else setSaving(true);
    setError("");
    persist();
    try {
      const snapshot = {
        ...draft,
        tags: [
          ...new Set([
            ...draft.tags,
            ...tagText
              .split(/[,、]/)
              .map(tag => tag.trim())
              .filter(Boolean),
          ]),
        ],
      };
      const result = await api<Article>("/api/article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      if (automatic && latest.current.draft) {
        const accepted = acceptAutoSave(latest.current.draft, snapshot, result);
        latest.current = { ...latest.current, ...accepted, session: result.id };
        setDraft(accepted.draft);
        setBaseline(accepted.baseline);
        setSession(result.id);
        try {
          localStorage.removeItem(storageKey(session));
          localStorage.setItem("noguchy.news.studio.last", result.id);
        } catch {
          /* Browser storage is optional. */
        }
        persist();
      } else {
        try {
          localStorage.removeItem(storageKey(session));
        } catch {
          /* Save succeeded even if browser storage is unavailable. */
        }
        activate(result, result.id, false);
        setNotice(
          "記事ファイルに保存しました。公開サイトへの反映はデプロイ後です。"
        );
      }
      failedAutoSave.current = "";
      await refreshList();
      return result;
    } catch (error) {
      if (automatic) failedAutoSave.current = fingerprint(draft);
      setError(messageOf(error));
      return null;
    } finally {
      saveInFlight.current = false;
      setAutoSaving(false);
      setSaving(false);
    }
  }
  saveRef.current = () => {
    void save();
  };
  async function publish() {
    if (!draft || busy) return;
    setError("");
    const saved = await save();
    if (!saved) return;
    setPublishing(true);
    setNotice("記事を保存しました。公開処理を実行しています…");
    try {
      const result = await api<{ message: string; deployment: PublishState }>(
        "/api/deploy",
        {
          method: "POST",
        }
      );
      setNotice(result.message);
      setPublishState(result.deployment);
      await refreshList();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setPublishing(false);
    }
  }
  function addTags() {
    if (!draft) return;
    update({
      tags: [
        ...new Set([
          ...draft.tags,
          ...tagText
            .split(/[,、]/)
            .map(tag => tag.trim())
            .filter(Boolean),
        ]),
      ],
    });
    setTagText("");
  }
  async function addCover(file?: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      update({ thumbnail: (await uploadImage(file)).url });
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setUploading(false);
    }
  }
  async function askCodex(kind: AssistKind, prompt: string) {
    if (!draft || assistantBusy) return;
    setAssistantKind(kind);
    setAssistantPrompt("");
    setAssistantAnswer("");
    setAssistantMessages(current => [
      ...current,
      { role: "user", text: prompt },
    ]);
    setError("");
    setAssistantBusy(true);
    try {
      const result = await api<{ answer: string }>("/api/codex/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, article: draft }),
      });
      setAssistantAnswer(result.answer);
      setAssistantMessages(current => [
        ...current,
        { role: "assistant", text: result.answer, kind },
      ]);
      setCodexStatus(current => ({
        ...(current ?? { available: true }),
        available: true,
        connected: true,
      }));
    } catch (error) {
      setError(messageOf(error));
      setCodexStatus(current =>
        current ? { ...current, connected: false } : current
      );
    } finally {
      setAssistantBusy(false);
    }
  }
  function applyAssistantAnswer() {
    if (!assistantAnswer || !assistantKind) return;
    if (assistantKind === "body") {
      update({ body: assistantAnswer });
      setMode(needsSourceMode(assistantAnswer) ? "source" : "write");
      setEditorVersion(version => version + 1);
      setNotice(
        "Codexの下書きを本文に反映しました。内容を確認して保存してください。"
      );
    } else if (assistantKind === "summary") {
      update({ description: assistantAnswer.split("\n")[0].trim() });
      setNotice(
        "Codexの概要案を反映しました。内容を確認して保存してください。"
      );
    } else if (assistantKind === "title") {
      update({ title: assistantAnswer.split("\n")[0].trim() });
      setNotice(
        "Codexのタイトル案を反映しました。内容を確認して保存してください。"
      );
    }
  }
  async function copyAssistantAnswer() {
    if (!assistantAnswer) return;
    try {
      await navigator.clipboard.writeText(assistantAnswer);
      setNotice("Codexの回答をクリップボードにコピーしました。");
    } catch {
      setError("クリップボードにコピーできませんでした。");
    }
  }
  function submitAssistant() {
    const prompt = assistantPrompt.trim();
    if (prompt) void askCodex("outline", prompt);
  }
  function download() {
    if (!draft) return;
    const { id, body } = draft;
    const metadata = {
      title: draft.title,
      description: draft.description,
      pubDatetime: draft.pubDatetime,
      published: draft.published,
      tags: draft.tags,
      contents: draft.contents,
      thumbnail: draft.thumbnail,
    };
    const content = `---\n${stringify({ ...metadata, timezone: "Asia/Tokyo" })}---\n\n${body}`;
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/markdown;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = id.split("/").pop() || "article.md";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function changeMode(next: typeof mode) {
    if (next === "write" && draft && needsSourceMode(draft.body)) {
      setNotice(
        "この記事には独自の記法が含まれています。元の内容を保つため、本文はMarkdownタブで編集してください。"
      );
      return;
    }
    setMode(next);
    setEditorVersion(version => version + 1);
  }
  const visible = articles.filter(
    article =>
      (filter === "all" || (filter === "draft") === !article.published) &&
      `${article.title} ${article.tags.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  const wordCount =
    draft?.body.replace(/[#*`\[\]()>_-]/g, "").replace(/\s/g, "").length ?? 0;
  const currentPublication = draft
    ? publicationOf(draft, publishState, dirty)
    : null;

  return (
    <div
      className={`studio ${sidebar ? "" : "sidebar-hidden"} ${assistantOpen ? "assistant-open" : ""}`}
    >
      <aside className="sidebar" aria-label="記事一覧">
        <a
          className="studio-brand"
          href="/"
          onClick={event => event.preventDefault()}
        >
          <span className="brand-symbol">n.</span>
          <span>
            noguchy.me<small>NEWS STUDIO</small>
          </span>
        </a>
        <button
          className="new-button"
          disabled={busy || autoSaving}
          onClick={createNew}
        >
          <Plus size={17} />
          新しい記事<span>＋</span>
        </button>
        <label className="sidebar-search">
          <Search size={15} />
          <input
            aria-label="記事を検索"
            placeholder="記事を検索"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          <kbd>⌕</kbd>
        </label>
        <div className="library-heading">
          ライブラリ <span>{articles.length}</span>
        </div>
        <nav className="library-filters" aria-label="記事の絞り込み">
          {[
            {
              id: "all",
              label: "すべての記事",
              icon: LayoutList,
              count: articles.length,
            },
            {
              id: "draft",
              label: "下書き",
              icon: FileText,
              count: articles.filter(article => !article.published).length,
            },
            {
              id: "published",
              label: "公開設定",
              icon: BookOpen,
              count: articles.filter(article => article.published).length,
            },
          ].map(item => (
            <button
              key={item.id}
              aria-current={filter === item.id ? "page" : undefined}
              onClick={() => setFilter(item.id)}
            >
              <item.icon size={16} />
              {item.label}
              <span>{item.count}</span>
            </button>
          ))}
        </nav>
        <div className="article-list-title">
          記事 <span>更新する記事を選択</span>
        </div>
        <div className="article-list">
          {session === "new" && draft && (
            <button
              className="article-item active"
              disabled={busy}
              onClick={() => {}}
            >
              <span className="article-status">
                <Circle size={9} />
                作成中
              </span>
              <strong>{draft.title || "無題の記事"}</strong>
              <small>タイトルを入力すると自動保存</small>
            </button>
          )}
          {visible.map(article => (
            <button
              className={`article-item ${session === article.id ? "active" : ""}`}
              key={article.id}
              disabled={busy || autoSaving}
              onClick={() => openArticle(article.id)}
            >
              <span
                className={`article-status ${publicationOf(article, publishState, session === article.id && dirty).tone}`}
              >
                <Circle size={8} fill="currentColor" />
                {
                  publicationOf(
                    article,
                    publishState,
                    session === article.id && dirty
                  ).label
                }
                <time>{formatDate(article.pubDatetime)}</time>
              </span>
              <strong>{article.title || "無題の記事"}</strong>
              <small>{article.tags.join(" · ") || "タグなし"}</small>
            </button>
          ))}
          {!visible.length && (
            <p className="list-empty">
              {search ? "一致する記事がありません" : "記事はまだありません"}
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <span className="local-dot" />
          <div>
            リポジトリと自動同期<small>noguchy.me のニュース</small>
          </div>
          <a
            href="https://news.noguchy.me/"
            target="_blank"
            rel="noreferrer"
            aria-label="ニュースサイトを開く"
          >
            <ArrowUpRight size={17} />
          </a>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button"
              aria-label={sidebar ? "記事一覧を閉じる" : "記事一覧を開く"}
              onClick={() => setSidebar(!sidebar)}
            >
              {sidebar ? (
                <PanelLeftClose size={18} />
              ) : (
                <PanelLeftOpen size={18} />
              )}
            </button>
            <span>ニュース</span>
            <ChevronRight size={13} />
            <span className="breadcrumb-title">
              {draft?.title || "新しい記事"}
            </span>
          </div>
          <div className="header-actions">
            <span className="save-indicator" role="status">
              {saving || autoSaving || uploading ? (
                <>
                  <Loader2 size={14} className="spin" />
                  {uploading ? "画像を追加中" : "保存中"}
                </>
              ) : dirty ? (
                <>
                  <CloudCheck size={14} />
                  {syncIssue
                    ? "同期を確認"
                    : localSaved
                      ? "自動保存待ち"
                      : "編集中"}
                </>
              ) : (
                <>
                  <Check size={14} />
                  {draft?.revision ? "同期済み" : "ローカル専用"}
                </>
              )}
            </span>
            {currentPublication && (
              <span
                className={`publish-indicator ${currentPublication.tone}`}
                role="status"
                title={currentPublication.detail}
              >
                <CloudUpload size={14} />
                {publishing ? "公開中" : currentPublication.label}
              </span>
            )}
            <button
              className="codex-header-button"
              disabled={!draft || busy}
              aria-label="Codexアシスタント"
              title="Codexアシスタント"
              aria-pressed={assistantOpen}
              onClick={() => {
                setAssistantOpen(!assistantOpen);
                setSettings(false);
              }}
            >
              <Sparkles size={16} />
              <span>Codexに相談</span>
            </button>
            <button
              className="icon-button"
              disabled={!draft || busy}
              aria-label="記事設定"
              title="記事設定"
              aria-pressed={settings}
              onClick={() => setSettings(!settings)}
            >
              <Settings2 size={18} />
            </button>
            <button
              className="secondary-header-button"
              disabled={!draft || busy || autoSaving || !!syncIssue}
              onClick={() => {
                void save();
              }}
            >
              <Check size={15} />
              保存する<kbd>⌘S</kbd>
            </button>
            <button
              className="primary-button"
              disabled={!draft || busy || autoSaving || !!syncIssue}
              onClick={publish}
            >
              {publishing ? (
                <Loader2 size={15} className="spin" />
              ) : (
                <CloudUpload size={15} />
              )}
              {publishing ? "公開中" : "保存して公開"}
            </button>
          </div>
        </header>
        {syncIssue && (
          <div className="banner error" role="alert">
            <span>{syncIssue}</span>
            <button className="text-button" onClick={download}>
              Markdownをダウンロード
            </button>
            <button className="text-button" onClick={() => setSettings(true)}>
              記事設定を開く
            </button>
          </div>
        )}
        {error && (
          <div className="banner error" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="エラーを閉じる"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="banner notice" role="status">
            <span>{notice}</span>
            <button
              className="icon-button"
              aria-label="通知を閉じる"
              onClick={() => setNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <main className="main-scroll">
          {!draft ? (
            <div className="loading-screen">
              {loading ? (
                <>
                  <Loader2 className="spin" />
                  記事を読み込んでいます
                </>
              ) : (
                <>
                  <p>記事を読み込めませんでした。</p>
                  <button onClick={() => location.reload()}>再読み込み</button>
                </>
              )}
            </div>
          ) : (
            <div className={`document-area ${settings ? "with-settings" : ""}`}>
              <article
                className={`document ${busy ? "busy" : ""}`}
                aria-busy={busy}
              >
                <fieldset disabled={busy} className="document-fields">
                  <div className="document-overline">
                    <span>
                      <span
                        className={`status-dot ${currentPublication?.tone === "published" ? "ready" : ""}`}
                      />
                      {currentPublication?.label}
                    </span>
                    <span>NEWS / EDITOR</span>
                  </div>
                  {draft.thumbnail ? (
                    <div className="cover-image">
                      <img src={draft.thumbnail} alt="記事のカバー" />
                      <div className="cover-actions">
                        <button onClick={() => coverInput.current?.click()}>
                          変更
                        </button>
                        <button onClick={() => update({ thumbnail: "" })}>
                          外す
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="add-cover"
                      onClick={() => coverInput.current?.click()}
                    >
                      <ImagePlus size={17} />
                      カバー画像を追加
                    </button>
                  )}
                  <input
                    ref={coverInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                    hidden
                    onChange={event => {
                      void addCover(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <textarea
                    className="title-input"
                    aria-label="記事タイトル"
                    placeholder="無題の記事"
                    rows={1}
                    value={draft.title}
                    onChange={event =>
                      update({ title: event.target.value.replace(/\n/g, "") })
                    }
                  />
                  <textarea
                    className="description-input"
                    aria-label="記事の概要"
                    placeholder="この記事で伝えたいことを、ひとことで。"
                    rows={2}
                    value={draft.description}
                    onChange={event =>
                      update({ description: event.target.value })
                    }
                  />
                  <div className="properties">
                    <div className="property">
                      <span className="property-label">公開日時</span>
                      <input
                        aria-label="公開日時"
                        type="datetime-local"
                        value={dateInput(draft.pubDatetime)}
                        onChange={event =>
                          update({
                            pubDatetime: event.target.value
                              ? `${event.target.value}:00+09:00`
                              : "",
                          })
                        }
                      />
                      <span className="timezone">日本時間</span>
                    </div>
                    <div className="property">
                      <span className="property-label">タグ</span>
                      <div className="tag-editor">
                        {draft.tags.map(tag => (
                          <span className="tag" key={tag}>
                            {tag}
                            <button
                              aria-label={`${tag}を削除`}
                              onClick={() =>
                                update({
                                  tags: draft.tags.filter(
                                    value => value !== tag
                                  ),
                                })
                              }
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                        <input
                          aria-label="タグを追加"
                          placeholder="＋ タグを追加"
                          value={tagText}
                          onChange={event => setTagText(event.target.value)}
                          onBlur={addTags}
                          onKeyDown={event => {
                            if (event.key === "Enter" || event.key === ",") {
                              event.preventDefault();
                              addTags();
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="property">
                      <span className="property-label">ステータス</span>
                      <select
                        aria-label="公開設定"
                        value={draft.published ? "published" : "draft"}
                        onChange={event =>
                          update({
                            published: event.target.value === "published",
                          })
                        }
                      >
                        <option value="draft">下書き</option>
                        <option value="published">公開対象</option>
                      </select>
                      <span className="property-note">
                        「保存して公開」で反映
                      </span>
                    </div>
                  </div>
                  <div
                    className="document-tabs"
                    role="tablist"
                    aria-label="本文の表示"
                  >
                    <div>
                      {[
                        { id: "write", label: "エディタ" },
                        { id: "source", label: "Markdown" },
                        { id: "preview", label: "プレビュー" },
                      ].map(tab => (
                        <button
                          key={tab.id}
                          role="tab"
                          aria-selected={mode === tab.id}
                          onClick={() => changeMode(tab.id as typeof mode)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <span>{wordCount.toLocaleString()} 文字</span>
                  </div>
                </fieldset>
                <div className="body-area" inert={busy}>
                  {mode === "write" && (
                    <RichEditor
                      key={editorVersion}
                      body={draft.body}
                      onChange={body => update({ body })}
                      onError={setError}
                      onUploading={setUploading}
                    />
                  )}
                  {mode === "source" && (
                    <>
                      <p className="source-hint">
                        Zenn記法や埋め込みも、そのまま保存できます。
                      </p>
                      <textarea
                        className="markdown-input"
                        aria-label="Markdown本文"
                        spellCheck={false}
                        value={draft.body}
                        onChange={event => update({ body: event.target.value })}
                        placeholder="## 見出しから書き始める…"
                      />
                    </>
                  )}
                  {mode === "preview" && (
                    <div className="preview">
                      <p className="source-hint">
                        本文の簡易プレビューです。Xなどの埋め込み・独自記法は公開サイトで描画されます。
                      </p>
                      <div
                        className="prose-editor"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(
                            marked.parse(draft.body, { async: false }) as string
                          ),
                        }}
                      />
                    </div>
                  )}
                </div>
                <footer className="document-footer">
                  <span>
                    <FileText size={14} />
                    {draft.id}
                  </span>
                  <span>リポジトリと自動同期 · 今すぐ保存は ⌘S</span>
                </footer>
              </article>
              {assistantOpen && (
                <aside className="assistant-panel">
                  <div className="assistant-panel-header">
                    <div className="assistant-title">
                      <span className="assistant-avatar">
                        <Sparkles size={15} />
                      </span>
                      <div>
                        <h2>Codex</h2>
                        <div
                          className={`codex-status ${codexStatus?.available ? "available" : ""}`}
                        >
                          <span />
                          {codexStatus === null
                            ? "接続を確認中"
                            : codexStatus.available
                              ? codexStatus.connected
                                ? "Codexに接続中"
                                : "Codexを利用できます"
                              : "Codex CLIが見つかりません"}
                        </div>
                      </div>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Codexアシスタントを閉じる"
                      onClick={() => setAssistantOpen(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="assistant-quick-access">
                    <div className="assistant-section-label">
                      クイックアクセス <span>記事作成</span>
                    </div>
                    <div className="assistant-presets">
                      <button
                        disabled={assistantBusy || !codexStatus?.available}
                        onClick={() =>
                          void askCodex(
                            "body",
                            "記事のテーマと現在の内容を活かして、公開できる本文の下書きをMarkdownで作成してください。出力は本文だけにし、前置きやコードフェンスは付けないでください。"
                          )
                        }
                      >
                        <FileText size={14} />
                        下書きを作成
                      </button>
                      <button
                        disabled={assistantBusy || !codexStatus?.available}
                        onClick={() =>
                          void askCodex(
                            "title",
                            "記事の内容に合うタイトルを1つだけ作ってください。出力はタイトル本文のみ、説明や記号は不要です。"
                          )
                        }
                      >
                        <Sparkles size={14} />
                        タイトル案
                      </button>
                      <button
                        disabled={assistantBusy || !codexStatus?.available}
                        onClick={() =>
                          void askCodex(
                            "summary",
                            "記事の概要を日本語で1文だけ作ってください。出力は概要文のみ、説明や箇条書きは不要です。"
                          )
                        }
                      >
                        <BookOpen size={14} />
                        概要を書く
                      </button>
                      <button
                        disabled={assistantBusy || !codexStatus?.available}
                        onClick={() =>
                          void askCodex(
                            "outline",
                            "この記事をより読みやすくする構成案を、見出しと各章の要点で提案してください。"
                          )
                        }
                      >
                        <LayoutList size={14} />
                        構成を提案
                      </button>
                    </div>
                  </div>
                  <div
                    className="assistant-messages"
                    aria-live="polite"
                    ref={assistantMessagesRef}
                  >
                    {!assistantMessages.length && !assistantBusy && (
                      <div className="assistant-empty">
                        <Sparkles size={21} />
                        <strong>記事づくりを始めましょう</strong>
                        <span>
                          クイックアクセスを選ぶか、下の入力欄から相談できます。
                        </span>
                      </div>
                    )}
                    {assistantMessages.map((message, index) => {
                      const latestAnswer =
                        message.role === "assistant" &&
                        index === assistantMessages.length - 1;
                      return (
                        <div
                          className={`assistant-message ${message.role}`}
                          key={`${message.role}-${index}`}
                        >
                          <span className="assistant-message-role">
                            {message.role === "user" ? "あなた" : "Codex"}
                          </span>
                          <pre>{message.text}</pre>
                          {latestAnswer && (
                            <div className="assistant-message-actions">
                              <button
                                onClick={() => void copyAssistantAnswer()}
                              >
                                コピー
                              </button>
                              {message.kind !== "outline" && (
                                <button onClick={applyAssistantAnswer}>
                                  {message.kind === "body"
                                    ? "本文に反映"
                                    : message.kind === "summary"
                                      ? "概要に反映"
                                      : "タイトルに反映"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {assistantBusy && (
                      <div className="assistant-message assistant pending">
                        <span className="assistant-message-role">Codex</span>
                        <div className="assistant-typing">
                          <i />
                          <i />
                          <i />
                        </div>
                      </div>
                    )}
                  </div>
                  <form
                    className="assistant-composer"
                    onSubmit={event => {
                      event.preventDefault();
                      submitAssistant();
                    }}
                  >
                    <textarea
                      aria-label="Codexへのメッセージ"
                      rows={3}
                      value={assistantPrompt}
                      disabled={assistantBusy || !codexStatus?.available}
                      onChange={event => setAssistantPrompt(event.target.value)}
                      onKeyDown={event => {
                        if (
                          event.key === "Enter" &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          submitAssistant();
                        }
                      }}
                      placeholder={
                        codexStatus?.available
                          ? "記事についてCodexに相談…"
                          : "Codex CLIを起動すると利用できます"
                      }
                    />
                    <button
                      className="assistant-send"
                      type="submit"
                      aria-label="Codexに送信"
                      disabled={
                        assistantBusy ||
                        !codexStatus?.available ||
                        !assistantPrompt.trim()
                      }
                    >
                      {assistantBusy ? (
                        <Loader2 size={15} className="spin" />
                      ) : (
                        <ArrowUpRight size={15} />
                      )}
                    </button>
                  </form>
                  <p className="assistant-note">
                    読み取り専用接続 · 提案を確認してから保存・公開してください
                  </p>
                </aside>
              )}
              {settings && (
                <aside className="settings-panel">
                  <div className="settings-heading">
                    <h2>記事設定</h2>
                    <button
                      className="icon-button"
                      aria-label="記事設定を閉じる"
                      onClick={() => setSettings(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <fieldset disabled={busy}>
                    <label>
                      記事のファイル名
                      <input
                        aria-label="記事のファイル名"
                        disabled={!!draft.revision}
                        value={draft.id.replace(/\.md$/, "")}
                        onChange={event =>
                          update({ id: `${event.target.value}.md` })
                        }
                      />
                      <small>
                        半角英数字・ハイフン。保存後は固定されます。
                      </small>
                    </label>
                    <label>
                      記事の要点
                      <textarea
                        aria-label="記事の要点"
                        rows={5}
                        placeholder={
                          "1行につき1つの要点\n記事の目次として表示します"
                        }
                        value={draft.contents.join("\n")}
                        onChange={event =>
                          update({ contents: event.target.value.split("\n") })
                        }
                      />
                    </label>
                    <label>
                      カバー画像のURL
                      <input
                        aria-label="カバー画像のURL"
                        placeholder="https://… または /images/…"
                        value={draft.thumbnail}
                        onChange={event =>
                          update({ thumbnail: event.target.value })
                        }
                      />
                    </label>
                    <div className="settings-note">
                      <BookOpen size={18} />
                      <p>
                        記事はこのリポジトリに保存されます。
                        <br />
                        公開対象の記事は、次のニュースサイトのデプロイで反映されます。
                      </p>
                    </div>
                    <button className="secondary-button" onClick={download}>
                      <Download size={15} />
                      Markdownをダウンロード
                    </button>
                    {draft.revision && (
                      <button
                        className="text-button"
                        onClick={() => {
                          if (
                            window.confirm(
                              "保存前の入力内容を破棄して、記事ファイルを読み直しますか？必要なら先にMarkdownをダウンロードしてください。"
                            )
                          ) {
                            try {
                              localStorage.removeItem(storageKey(session));
                            } catch {
                              /* Optional cache. */
                            }
                            void openArticle(session, false);
                          }
                        }}
                      >
                        記事ファイルから読み直す
                      </button>
                    )}
                  </fieldset>
                  <div className="shortcut-guide">
                    <h3>書くためのショートカット</h3>
                    <p>
                      <span>ブロックを追加</span>
                      <kbd>/</kbd>
                    </p>
                    <p>
                      <span>太字</span>
                      <kbd>⌘ B</kbd>
                    </p>
                    <p>
                      <span>元に戻す</span>
                      <kbd>⌘ Z</kbd>
                    </p>
                    <p>
                      <span>画像を貼り付け</span>
                      <kbd>⌘ V</kbd>
                    </p>
                    <p>
                      <span>記事を保存</span>
                      <kbd>⌘ S</kbd>
                    </p>
                  </div>
                </aside>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
