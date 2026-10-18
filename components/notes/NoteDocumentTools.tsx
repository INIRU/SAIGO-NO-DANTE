"use client";
import NoteEditorGuide from "./NoteEditorGuide";
import { NoteBlockMenu, uploadNoteFiles } from "./NoteBlocks";
import { useRef, useState } from "react";
import { useLocale } from "next-intl";
import { ImagePlus, LayoutTemplate } from "lucide-react";
import { useEditorState, type Editor } from "@tiptap/react";
export default function NoteDocumentTools({
  editor,
}: {
  editor: Editor | null;
}) {
  const locale = useLocale(),
    label = (ko: string, ja: string, en: string) =>
      locale === "ja" ? ja : locale === "en" ? en : ko;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const inTable = useEditorState({ editor, selector: (state) => Boolean(state.editor?.isActive("table")) });
  async function upload(file?: File) {
    if (!file || !editor) return;
    setBusy(true);
    try {
      await uploadNoteFiles(editor, [file], locale);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-1 text-sm">
      <NoteBlockMenu editor={editor} />
      <button
        type="button"
        disabled={!editor || busy}
        onClick={() =>
          editor
            ?.chain()
            .focus()
            .insertContent(
              label(
                ["운용 순서", "핵심 기프트", "대체 편성"].join("|"),
                "運用手順|重要ギフト|代替編成",
                "Rotation|Key gifts|Alternatives",
              )
                .split("|")
                .flatMap((text) => [
                  {
                    type: "heading",
                    attrs: { level: 2 },
                    content: [{ type: "text", text }],
                  },
                  { type: "paragraph" },
                ]),
            )
            .run()
        }
        className="flex min-h-9 items-center gap-1.5 px-2 text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-panel)] disabled:opacity-40"
      >
        <LayoutTemplate size={15} />
        {label("양식 넣기", "テンプレート", "Template")}
      </button>
      <button
        type="button"
        disabled={!editor || busy}
        onClick={() => fileRef.current?.click()}
        className="flex min-h-9 items-center gap-1.5 px-2 text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-panel)] disabled:opacity-40"
      >
        <ImagePlus size={15} />
        {busy
          ? label("첨부 중…", "添付中…", "Uploading…")
          : label("이미지", "画像", "Image")}
      </button>
      {inTable && (
        <>
          {(
            [
              ["addRowAfter", label("행 추가", "行を追加", "Add row")],
              ["addColumnAfter", label("열 추가", "列を追加", "Add column")],
              ["deleteRow", label("행 삭제", "行を削除", "Delete row")],
              ["deleteColumn", label("열 삭제", "列を削除", "Delete column")],
              ["deleteTable", label("표 삭제", "表を削除", "Delete table")],
            ] as const
          ).map(([command, text]) => (
            <button
              key={command}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor?.chain().focus()[command]().run()}
              className="flex min-h-9 items-center px-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-panel)] hover:text-[var(--text-primary)]"
            >
              {text}
            </button>
          ))}
        </>
      )}
      <NoteEditorGuide compact/>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0])}
      />

    </div>
  );
}
