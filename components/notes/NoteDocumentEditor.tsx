"use client";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useLocale } from "next-intl";
import { Bold, Heading2, List, Quote, Undo2, Redo2 } from "lucide-react";
import {
  NoteAutocompleteDropdown,
  getNoteAutocompleteContext,
  getNoteAutocompleteSuggestions,
  type AutocompleteSuggestion,
  type CaretAnchor,
} from "./NoteAutocomplete";
import NoteImage from "./NoteImage";
import NoteDocumentTools from "./NoteDocumentTools";
import {
  markdownToTiptapContent,
  tiptapContentToMarkdown,
} from "@/lib/notes/document";
export default function NoteDocumentEditor({
  value,
  onChange,
  pool = [],
}: {
  value: string;
  onChange: (value: string) => void;
  pool?: AutocompleteSuggestion[];
}) {
  const lang = useLocale(),
    label = (ko: string, ja: string, en: string) =>
      lang === "ja" ? ja : lang === "en" ? en : ko;
  const last = useRef(value),
    change = useRef(onChange);
  useEffect(() => {
    change.current = onChange;
  }, [onChange]);
  const composing = useRef(false);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [selected, setSelected] = useState(0);
  const [anchor, setAnchor] = useState<CaretAnchor | null>(null);
  function refresh(current: Editor) {
    if (composing.current || !current.state.selection.empty) {
      setSuggestions([]);
      return;
    }
    const selection = current.state.selection;
    const before = selection.$from.parent.textBetween(
      0,
      selection.$from.parentOffset,
      "\n",
    );
    const items = getNoteAutocompleteSuggestions(before, before.length, pool);
    setSuggestions(items);
    setSelected(0);
    if (items.length) {
      const point = current.view.coordsAtPos(selection.from);
      setAnchor({ left: point.left, top: point.bottom + 6, width: 260 });
    }
  }
  function select(item: AutocompleteSuggestion) {
    if (!editor || composing.current) return;
    const selection = editor.state.selection;
    const before = selection.$from.parent.textBetween(
      0,
      selection.$from.parentOffset,
      "\n",
    );
    const context = getNoteAutocompleteContext(before, before.length);
    if (context.mode === "closed" || context.mode === "word") return;
    const start = selection.$from.start();
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .deleteRange({
        from: start + context.replaceStart,
        to: start + context.replaceEnd,
      })
      .insertContent(item.token)
      .run();
    setSuggestions([]);
  }
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        link: { openOnClick: false },
      }),
      NoteImage,
      Placeholder.configure({
        placeholder: label(
          "여기에 내용을 입력하세요…",
          "ここに入力してください…",
          "Write here…",
        ),
      }),
    ],
    content: markdownToTiptapContent(value),
    editorProps: {
      handleDOMEvents: {
        compositionstart: () => {
          composing.current = true;
          setSuggestions([]);
          return false;
        },
        compositionend: () => {
          composing.current = false;
          return false;
        },
      },
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label("상세 메모", "詳細メモ", "Detailed notes"),
        class: "note-document-content",
      },
    },
    onUpdate: ({ editor }) => {
      const text = tiptapContentToMarkdown(editor.getJSON());
      last.current = text;
      change.current(text);
      refresh(editor);
    },
    onSelectionUpdate: ({ editor }) => refresh(editor),
  });
  useEffect(() => {
    if (editor && last.current !== value) {
      last.current = value;
      editor.commands.setContent(markdownToTiptapContent(value), {
        emitUpdate: false,
      });
    }
  }, [editor, value]);
  return (
    <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--bg-deep)]">
      <div
        className="flex flex-wrap items-center gap-1 border-b border-[var(--border)] p-2"
        role="toolbar"
        aria-label={label("메모 편집", "メモ編集", "Note formatting")}
      >
        {[
          {
            Icon: Heading2,
            title: label("제목", "見出し", "Heading"),
            run: () =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run(),
          },
          {
            Icon: Bold,
            title: label("굵게", "太字", "Bold"),
            run: () => editor?.chain().focus().toggleBold().run(),
          },
          {
            Icon: List,
            title: label("목록", "リスト", "List"),
            run: () => editor?.chain().focus().toggleBulletList().run(),
          },
          {
            Icon: Quote,
            title: label("인용", "引用", "Quote"),
            run: () => editor?.chain().focus().toggleBlockquote().run(),
          },
          {
            Icon: Undo2,
            title: label("실행 취소", "元に戻す", "Undo"),
            run: () => editor?.chain().focus().undo().run(),
          },
          {
            Icon: Redo2,
            title: label("다시 실행", "やり直し", "Redo"),
            run: () => editor?.chain().focus().redo().run(),
          },
        ].map(({ Icon, title, run }) => (
          <button
            type="button"
            key={title}
            aria-label={title}
            title={title}
            onClick={run}
            className="flex h-9 w-9 items-center justify-center text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-panel)]"
          >
            <Icon size={16} />
          </button>
        ))}
        <NoteDocumentTools editor={editor} />
      </div>
      <EditorContent
        editor={editor}
        onBlur={() => setSuggestions([])}
        onKeyDownCapture={(event) => {
          if (
            composing.current ||
            event.nativeEvent.isComposing ||
            event.keyCode === 229 ||
            !suggestions.length
          )
            return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setSelected(
              (selected +
                (event.key === "ArrowDown" ? 1 : -1) +
                suggestions.length) %
                suggestions.length,
            );
          } else if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            select(suggestions[selected]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setSuggestions([]);
          }
        }}
      />
      <NoteAutocompleteDropdown
        suggestions={suggestions}
        selectedIdx={selected}
        onSelect={select}
        onHover={setSelected}
        anchor={anchor}
      />
    </div>
  );
}
