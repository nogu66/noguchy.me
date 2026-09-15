import { useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  ImagePlus,
  Minus,
  Undo2,
  Redo2,
  Table,
  SquareCheck,
  Type,
  X,
} from "lucide-react";
import { normalizeMarkdown, uploadImage } from "./model";

type Props = {
  body: string;
  onChange: (body: string) => void;
  onError: (message: string) => void;
  onUploading: (active: boolean) => void;
};
type Command = {
  label: string;
  hint: string;
  search: string;
  icon: typeof Type;
  action: (editor: Editor) => void;
};
const bubbleOptions = { placement: "top" as const };

export default function RichEditor({
  body,
  onChange,
  onError,
  onUploading,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [slash, setSlash] = useState<{
    from: number;
    to: number;
    query: string;
    x: number;
    y: number;
  } | null>(null);
  const [selected, setSelected] = useState(0);
  const [link, setLink] = useState<string | null>(null);
  const [, rerender] = useState(0);
  const keyHandler = useRef<(event: KeyboardEvent) => boolean>(() => false);
  const uploadHandler = useRef<(files: File[], position?: number) => void>(
    () => {}
  );
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        underline: false,
        link: { openOnClick: false },
      }),
      Image,
      Placeholder.configure({
        placeholder: "本文を書き始める、または / でブロックを追加…",
      }),
      Markdown,
      TableKit,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: body,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "prose-editor",
        role: "textbox",
        "aria-label": "記事本文",
        "aria-multiline": "true",
      },
      handleKeyDown: (_view, event) => keyHandler.current(event),
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter(
          file => file.type.startsWith("image/")
        );
        if (!files.length) return false;
        event.preventDefault();
        uploadHandler.current(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = Array.from(event.dataTransfer?.files ?? []).filter(file =>
          file.type.startsWith("image/")
        );
        if (!files.length) return false;
        event.preventDefault();
        uploadHandler.current(
          files,
          view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        );
        return true;
      },
    },
    onUpdate: ({ editor: current }) =>
      onChange(normalizeMarkdown(current.getMarkdown())),
    onTransaction: ({ editor: current, transaction }) => {
      if (!transaction.docChanged && !transaction.selectionSet) return;
      rerender(n => n + 1);
      const { $from, empty } = current.state.selection;
      const match =
        empty &&
        $from.parent.type.name === "paragraph" &&
        $from.parent.textContent.match(/^\/([^\n]*)$/);
      if (match) {
        const coords = current.view.coordsAtPos($from.pos);
        setSlash(previous => {
          if (previous?.query !== match[1]) setSelected(0);
          return {
            from: $from.start(),
            to: $from.end(),
            query: match[1],
            x: Math.min(coords.left, window.innerWidth - 300),
            y: Math.max(
              70,
              Math.min(coords.bottom + 10, window.innerHeight - 380)
            ),
          };
        });
      } else setSlash(null);
    },
  });

  uploadHandler.current = async (files, position) => {
    if (!editor || !files.length) return;
    const cursor = editor.state.doc.resolve(
      position ?? editor.state.selection.from
    );
    // Store images as top-level blocks; images inside task lists can serialize
    // as indented code in Markdown. Insert below the containing block.
    let insertion = cursor.depth > 0 ? cursor.after(1) : cursor.pos;
    onUploading(true);
    // Freeze editing so the insertion point cannot move while files upload.
    editor.setEditable(false);
    try {
      for (const file of files) {
        const { url } = await uploadImage(file);
        if (editor.isDestroyed) return;
        editor
          .chain()
          .focus()
          .insertContentAt(insertion, {
            type: "image",
            attrs: { src: url, alt: file.name.replace(/\.[^.]+$/, "") },
          })
          .run();
        insertion += 1;
      }
    } catch (error) {
      onError((error as Error).message);
    } finally {
      if (!editor.isDestroyed) editor.setEditable(true);
      onUploading(false);
    }
  };

  const commands: Command[] = [
    {
      label: "テキスト",
      hint: "通常の段落",
      search: "text paragraph",
      icon: Type,
      action: e => {
        e.chain().focus().setParagraph().run();
      },
    },
    {
      label: "見出し 2",
      hint: "セクションを分ける",
      search: "h2 heading",
      icon: Heading2,
      action: e => {
        e.chain().focus().toggleHeading({ level: 2 }).run();
      },
    },
    {
      label: "見出し 3",
      hint: "小さな見出し",
      search: "h3 heading",
      icon: Heading3,
      action: e => {
        e.chain().focus().toggleHeading({ level: 3 }).run();
      },
    },
    {
      label: "箇条書き",
      hint: "要点をリストに",
      search: "bullet list",
      icon: List,
      action: e => {
        e.chain().focus().toggleBulletList().run();
      },
    },
    {
      label: "番号付きリスト",
      hint: "順序のある内容に",
      search: "number ordered list",
      icon: ListOrdered,
      action: e => {
        e.chain().focus().toggleOrderedList().run();
      },
    },
    {
      label: "チェックリスト",
      hint: "タスクを並べる",
      search: "todo task",
      icon: SquareCheck,
      action: e => {
        e.chain().focus().toggleTaskList().run();
      },
    },
    {
      label: "引用",
      hint: "引用文を目立たせる",
      search: "quote",
      icon: Quote,
      action: e => {
        e.chain().focus().toggleBlockquote().run();
      },
    },
    {
      label: "コードブロック",
      hint: "コードやコマンド",
      search: "code",
      icon: Code,
      action: e => {
        e.chain().focus().toggleCodeBlock().run();
      },
    },
    {
      label: "画像",
      hint: "ファイルから追加",
      search: "image photo",
      icon: ImagePlus,
      action: () => fileInput.current?.click(),
    },
    {
      label: "区切り線",
      hint: "内容を区切る",
      search: "divider line",
      icon: Minus,
      action: e => {
        e.chain().focus().setHorizontalRule().run();
      },
    },
    {
      label: "テーブル",
      hint: "3列の表を追加",
      search: "table",
      icon: Table,
      action: e => {
        e.chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
  ];
  const filtered = commands.filter(command =>
    `${command.label} ${command.search}`
      .toLowerCase()
      .includes(slash?.query.toLowerCase() ?? "")
  );
  function runCommand(command: Command) {
    if (!editor) return;
    if (slash)
      editor
        .chain()
        .focus()
        .deleteRange({ from: slash.from, to: slash.to })
        .run();
    setSlash(null);
    command.action(editor);
  }
  keyHandler.current = event => {
    if (!slash || event.isComposing) return false;
    if (event.key === "Escape") {
      setSlash(null);
      return true;
    }
    if (["ArrowDown", "ArrowUp"].includes(event.key) && filtered.length) {
      setSelected(
        index =>
          (index + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) %
          filtered.length
      );
      return true;
    }
    if (event.key === "Enter" && filtered[selected]) {
      runCommand(filtered[selected]);
      return true;
    }
    return false;
  };

  if (!editor) return null;
  const marks = [
    {
      name: "bold",
      label: "太字",
      icon: Bold,
      action: () => editor.chain().focus().toggleBold().run(),
    },
    {
      name: "italic",
      label: "斜体",
      icon: Italic,
      action: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      name: "strike",
      label: "取り消し線",
      icon: Strikethrough,
      action: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      name: "code",
      label: "インラインコード",
      icon: Code,
      action: () => editor.chain().focus().toggleCode().run(),
    },
  ];
  const markButtons = marks.map(mark => (
    <button
      key={mark.name}
      type="button"
      className="icon-button"
      title={mark.label}
      aria-label={mark.label}
      aria-pressed={editor.isActive(mark.name)}
      onMouseDown={event => event.preventDefault()}
      onClick={mark.action}
    >
      <mark.icon size={16} />
    </button>
  ));

  return (
    <div className="rich-editor">
      <div className="editor-toolbar" aria-label="本文の書式">
        {markButtons}
        <span className="toolbar-separator" />
        {commands
          .filter(command =>
            ["見出し 2", "箇条書き", "引用", "画像"].includes(command.label)
          )
          .map(command => (
            <button
              type="button"
              key={command.label}
              className="icon-button"
              aria-label={command.label}
              title={command.label}
              onMouseDown={event => event.preventDefault()}
              onClick={() => command.action(editor)}
            >
              <command.icon size={17} />
            </button>
          ))}
        <button
          className="icon-button"
          type="button"
          aria-label="リンクを追加"
          title="リンクを追加"
          onClick={() => setLink(editor.getAttributes("link").href || "")}
        >
          <Link size={16} />
        </button>
        <span className="toolbar-spacer" />
        <button
          className="icon-button"
          type="button"
          aria-label="元に戻す"
          title="元に戻す ⌘Z"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={16} />
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="やり直す"
          title="やり直す ⇧⌘Z"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={16} />
        </button>
      </div>
      {editor.isActive("table") && (
        <div className="table-actions">
          <button onClick={() => editor.chain().focus().addRowAfter().run()}>
            行を追加
          </button>
          <button onClick={() => editor.chain().focus().addColumnAfter().run()}>
            列を追加
          </button>
          <button onClick={() => editor.chain().focus().deleteRow().run()}>
            行を削除
          </button>
          <button onClick={() => editor.chain().focus().deleteColumn().run()}>
            列を削除
          </button>
          <button onClick={() => editor.chain().focus().deleteTable().run()}>
            表を削除
          </button>
        </div>
      )}
      {editor.isActive("codeBlock") && (
        <label className="code-language">
          コードの言語{" "}
          <input
            aria-label="コードの言語"
            placeholder="javascript"
            value={editor.getAttributes("codeBlock").language || ""}
            onChange={event =>
              editor
                .chain()
                .updateAttributes("codeBlock", { language: event.target.value })
                .run()
            }
          />
        </label>
      )}
      {editor.isActive("image") && (
        <label className="code-language">
          画像の説明{" "}
          <input
            aria-label="画像の説明"
            value={editor.getAttributes("image").alt || ""}
            onChange={event =>
              editor
                .chain()
                .updateAttributes("image", { alt: event.target.value })
                .run()
            }
          />
        </label>
      )}
      <EditorContent editor={editor} />
      <BubbleMenu editor={editor} options={bubbleOptions}>
        <div className="bubble-menu">
          {markButtons}
          <button
            type="button"
            className="icon-button"
            aria-label="選択範囲にリンク"
            onClick={() => setLink(editor.getAttributes("link").href || "")}
          >
            <Link size={16} />
          </button>
        </div>
      </BubbleMenu>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        hidden
        multiple
        onChange={event => {
          uploadHandler.current(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      {slash && (
        <div
          className="slash-menu"
          role="listbox"
          aria-label="ブロックを追加"
          style={{ left: slash.x, top: slash.y }}
        >
          <div className="menu-label">
            ブロックを追加 <kbd>esc</kbd>
          </div>
          {filtered.length ? (
            filtered.map((command, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === selected}
                key={command.label}
                onMouseDown={event => event.preventDefault()}
                onMouseEnter={() => setSelected(index)}
                onClick={() => runCommand(command)}
              >
                <span className="command-icon">
                  <command.icon size={19} />
                </span>
                <span>
                  {command.label}
                  <small>{command.hint}</small>
                </span>
              </button>
            ))
          ) : (
            <p>一致するブロックがありません</p>
          )}
        </div>
      )}
      {link !== null && (
        <div className="modal-backdrop">
          <form
            className="link-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="リンクを設定"
            onSubmit={event => {
              event.preventDefault();
              if (link && !/^https?:\/\//i.test(link)) {
                onError(
                  "リンクは https:// または http:// で入力してください。"
                );
                return;
              }
              if (link)
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .setLink({ href: link })
                  .run();
              else
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .unsetLink()
                  .run();
              setLink(null);
            }}
          >
            <div className="dialog-heading">
              <h3>リンクを設定</h3>
              <button
                className="icon-button"
                type="button"
                aria-label="閉じる"
                onClick={() => setLink(null)}
              >
                <X size={18} />
              </button>
            </div>
            <label>
              URL
              <input
                autoFocus
                aria-label="リンクURL"
                placeholder="https://"
                value={link}
                onChange={event => setLink(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "Escape") setLink(null);
                }}
              />
            </label>
            <button type="submit" className="primary-button">
              適用
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
