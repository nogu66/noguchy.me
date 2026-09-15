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

type Summary = Omit<Article, "body">;
type Cache = { article: Article; baseline: string; at: number };
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

function App() {
  const [articles, setArticles] = useState<Summary[]>([]);
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
  const [uploading, setUploading] = useState(false);
  const [localSaved, setLocalSaved] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [settings, setSettings] = useState(false);
  const [tagText, setTagText] = useState("");
  const [editorVersion, setEditorVersion] = useState(0);
  const coverInput = useRef<HTMLInputElement>(null);
  const latest = useRef({ draft, session, baseline });
  latest.current = { draft, session, baseline };
  const saveRef = useRef<() => void>(() => {});
  const busy = saving || uploading || loading;
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
    const result = await api<{ articles: Summary[]; warnings: string[] }>(
      "/api/articles"
    );
    setArticles(result.articles);
    if (result.warnings.length) setError(result.warnings.join("\n"));
    return result.articles;
  }
  function activate(article: Article, key: string, recover = true) {
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
    setLocalSaved(false);
    const timeout = window.setTimeout(persist, 500);
    return () => window.clearTimeout(timeout);
  }, [draft, baseline, session]);

  function update(patch: Partial<Article>) {
    setDraft(current => (current ? { ...current, ...patch } : current));
  }
  async function save() {
    if (!draft || busy) return;
    setSaving(true);
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
      try {
        localStorage.removeItem(storageKey(session));
      } catch {
        /* Save succeeded even if browser storage is unavailable. */
      }
      activate(result, result.id, false);
      setNotice(
        "記事ファイルに保存しました。公開サイトへの反映はデプロイ後です。"
      );
      await refreshList();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setSaving(false);
    }
  }
  saveRef.current = save;
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

  return (
    <div className={`studio ${sidebar ? "" : "sidebar-hidden"}`}>
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
        <button className="new-button" disabled={busy} onClick={createNew}>
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
              label: "公開対象",
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
              <small>このブラウザに自動退避</small>
            </button>
          )}
          {visible.map(article => (
            <button
              className={`article-item ${session === article.id ? "active" : ""}`}
              key={article.id}
              disabled={busy}
              onClick={() => openArticle(article.id)}
            >
              <span
                className={`article-status ${article.published ? "ready" : ""}`}
              >
                <Circle size={8} fill="currentColor" />
                {article.published ? "公開対象" : "下書き"}
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
            このMacで編集中<small>noguchy.me のニュース</small>
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
              {saving || uploading ? (
                <>
                  <Loader2 size={14} className="spin" />
                  {uploading ? "画像を追加中" : "保存中"}
                </>
              ) : dirty ? (
                <>
                  <CloudCheck size={14} />
                  {localSaved ? "ブラウザに退避済み" : "編集中"}
                </>
              ) : (
                <>
                  <Check size={14} />
                  {draft?.revision ? "保存済み" : "ローカル専用"}
                </>
              )}
            </span>
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
              className="primary-button"
              disabled={!draft || busy}
              onClick={save}
            >
              <Check size={15} />
              保存する<kbd>⌘S</kbd>
            </button>
          </div>
        </header>
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
                        className={`status-dot ${draft.published ? "ready" : ""}`}
                      />
                      {draft.published ? "公開対象" : "下書き"}
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
                        保存後のデプロイで反映
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
                  <span>入力内容を自動退避 · 保存は ⌘S</span>
                </footer>
              </article>
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
