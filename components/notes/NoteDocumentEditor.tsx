"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useLocale } from "next-intl";
import useSWR from "swr";
import { GIFT_KEYWORD_COLORS } from "@/lib/constants/gift";
import { assetName } from "@/lib/notes/assets";
import { Bold, Italic, Heading2, List, ListOrdered, Quote, Undo2, Redo2, Eye, Pencil, Link2, X } from "lucide-react";
import {
  NoteAutocompleteDropdown,
  buildKeywordPool,
  getNoteAutocompleteContext,
  getNoteAutocompleteSuggestions,
  type AutocompleteSuggestion,
  type CaretAnchor,
} from "./NoteAutocomplete";
import { noteBlockExtensions, NoteInput, notePlaceholder } from "./NoteBlocks";
import { NoteAssetsProvider, fetchNoteAssets } from "./NoteBlockViewer";
import { pendingNoteUploads } from "@/lib/notes/images";
import { useKeywords } from '@/components/providers/KeywordProvider';
import NoteImage from "./NoteImage";
import { NoteFormationContext } from "./NoteAssetPicker";
import NoteDocumentTools from "./NoteDocumentTools";
import {
  markdownToTiptapContent,
  tiptapContentToMarkdown,
} from "@/lib/notes/document";
export default function NoteDocumentEditor({
  formation = [],
  value,
  onChange,
  pool = [],
  preview = false,
  onPreviewChange,
  previewContent,
}: {
  formation?: import("@/lib/notes/assets").NoteFormationMember[];
  value: string;
  onChange: (value: string) => void;
  pool?: AutocompleteSuggestion[];
  preview?: boolean;
  onPreviewChange?: (value:boolean)=>void;
  previewContent?: ReactNode;
}) {
  const lang = useLocale(),
    label = (ko: string, ja: string, en: string) =>
      lang === "ja" ? ja : lang === "en" ? en : ko;
  const keywords=useKeywords();
  const keywordPool=useMemo(()=>buildKeywordPool(keywords).map(item=>({...item,label:(lang==='en'?keywords[item.label]?.nameEn:lang==='ja'?keywords[item.label]?.nameJp:null) || item.label})),[keywords,lang]);
  const combinedPool=useMemo(()=>[...keywordPool,...pool.filter(item=>item.type!=='keyword')],[keywordPool,pool]);
  // Gift names typed in a sentence become inline gifts, like keywords. The whole catalog (about 450) is one cached request.
  const {data:giftCatalog}=useSWR('/api/notes/assets?kind=gift&catalog=1',fetchNoteAssets,{revalidateOnFocus:false});
  const giftPool=useMemo<AutocompleteSuggestion[]>(()=>(giftCatalog ?? []).map(gift=>({
    label:assetName(gift,lang), type:'egogift', typeLabel:label('기프트','ギフト','Gift'), color:GIFT_KEYWORD_COLORS[gift.keyword ?? ''] ?? '#c8b898',
    imageUrl:gift.image_url ?? undefined, token:'[gift:'+gift.id+']', syntax:'inline',
  })),[giftCatalog,lang]);
  const last = useRef(value),
    change = useRef(onChange);
  useEffect(() => {
    change.current = onChange;
  }, [onChange]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (pendingNoteUploads.size) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  const [linkOpen, setLinkOpen] = useState(false), [linkUrl, setLinkUrl] = useState(""), [linkError, setLinkError] = useState(false);
  const composing = useRef(false);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [selected, setSelected] = useState(0);
  const [anchor, setAnchor] = useState<CaretAnchor | null>(null);
  /**
   * The word just typed, if it names a keyword or gift: at the caret, or right before one space (Korean IME only ends a
   * syllable when the next key is typed, often the space). Returns the text before the caret and the name's offset.
   */
  function textBeforeCaret(current: Editor) {
    const selection = current.state.selection;
    return selection.$from.parent.textBetween(0, selection.$from.parentOffset, "\n", "\ufffc");
  }
  function nameEnd(before: string, label: string): number {
    for (const end of [before.length, before.endsWith(' ') ? before.length-1 : -1]) {
      if (end < label.length || before.slice(end-label.length, end) !== label) continue;
      if (end-label.length === 0 || /[\s(\[（]/u.test(before[end-label.length-1])) return end;
    }
    return -1;
  }
  // Suggestions are computed while a syllable is still being composed; only choosing waits for the composition to end.
  function refresh(current: Editor) {
    if (!current.state.selection.empty) {
      setSuggestions([]);
      return;
    }
    const selection = current.state.selection;
    const before = textBeforeCaret(current);
    const context=getNoteAutocompleteContext(before,before.length);
    const named=(item:AutocompleteSuggestion)=>nameEnd(before,item.label)>=0;
    // A name that is both a keyword and a gift (데스페라도) offers both; the keyword stays first.
    const exact=[...keywordPool.filter(named),...giftPool.filter(named)].sort((a,b)=>b.label.length-a.label.length || (a.type==='keyword'?-1:1));
    const query=context.query.toLowerCase();
    const items = exact.length && !context.query.startsWith('/') && context.mode!=='type' && context.mode!=='value' ? exact.slice(0,6)
      : context.mode==='word' && !context.query.startsWith('/')
      ? (query ? [
        ...keywordPool.filter(item=>item.label.toLowerCase().startsWith(query)).slice(0,4),
        ...(query.length>=2 ? giftPool.filter(item=>item.label.toLowerCase().startsWith(query)).slice(0,4) : []),
      ].slice(0,6) : [])
      : getNoteAutocompleteSuggestions(before, before.length, combinedPool);
    setSuggestions(items);
    setSelected(0);
    if (items.length) {
      const point = current.view.coordsAtPos(selection.from);
      setAnchor({ left: point.left, top: point.bottom + 6, width: 260 });
    }
  }
  const pendingSelect = useRef<AutocompleteSuggestion | null>(null);
  function select(item: AutocompleteSuggestion) {
    if (!editor) return;
    if (composing.current) {
      // Finish the syllable being typed first (blurring ends the composition); compositionend inserts the choice.
      pendingSelect.current = item;
      editor.commands.blur();
      return;
    }
    const selection = editor.state.selection;
    const before = textBeforeCaret(editor);
    const inline = item.type==='keyword' || item.token.startsWith('[gift:');
    const end = inline ? nameEnd(before, item.label) : -1;
    const context = getNoteAutocompleteContext(before, before.length);
    if (end < 0 && context.mode === "closed") return;
    const start = selection.$from.start();
    const range = end >= 0 ? { from: start + end - item.label.length, to: selection.from }
      : { from: start + context.replaceStart, to: start + context.replaceEnd };
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .deleteRange(range)
      .insertContent(item.type==='keyword' && /^\[k:.+\]$/.test(item.token) ? [{type:'noteKeyword',attrs:{id:item.token.slice(3,-1)}},{type:'text',text:' '}]
        : /^\[gift:.+\]$/.test(item.token) ? [{type:'noteGift',attrs:{id:item.token.slice(6,-1),name:item.label}},{type:'text',text:' '}] : item.token)
      .run();
    setSuggestions([]);
  }
  const selectRef = useRef(select);
  selectRef.current = select;
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        link: { openOnClick: false },
      }),
      NoteImage,
      ...noteBlockExtensions,
      NoteInput.configure({lang}),
      Placeholder.configure({
        includeChildren: true,
        // Only the line being typed on shows the hint (every empty line showed it before).
        showOnlyCurrent: true,
        placeholder: ({node}) => notePlaceholder(lang, node.type.name),
      }),
    ],
    content: markdownToTiptapContent(value),
    editorProps: {
      handleDOMEvents: {
        compositionstart: () => {
          composing.current = true;
          return false;
        },
        compositionend: () => {
          composing.current = false;
          // The view has the final syllable after this event: choose the pending suggestion or recompute.
          setTimeout(() => {
            const current = editorRef.current;
            if (!current || current.isDestroyed) return;
            const pending = pendingSelect.current;
            pendingSelect.current = null;
            if (pending) { current.commands.focus(); selectRef.current(pending); }
            else refresh(current);
          });
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
  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor;
  useEffect(() => {
    let cancelled=false;
    // React node views flush synchronously; update them after the effect completes.
    queueMicrotask(()=>{
      if (!cancelled && editor && !editor.isDestroyed && last.current !== value) {
        last.current=value;
        editor.commands.setContent(markdownToTiptapContent(value), {emitUpdate:false});
      }
    });
    return ()=>{cancelled=true};
  }, [editor, value]);
  return (
    <NoteFormationContext.Provider value={formation}><div className="note-editor-shell rounded-md bg-[var(--bg-deep)]">
      <div
        className="note-editor-toolbar flex flex-wrap items-center gap-1 border-b border-[var(--border)] p-2"
        role="toolbar"
        aria-label={label("메모 편집", "メモ編集", "Note formatting")}
      >
        <NoteDocumentTools editor={preview ? null : editor} />
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
          { Icon: Italic, title: label("기울임", "斜体", "Italic"), run: () => editor?.chain().focus().toggleItalic().run() },
          { Icon: ListOrdered, title: label("번호 목록", "番号リスト", "Numbered list"), run: () => editor?.chain().focus().toggleOrderedList().run() },
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
            disabled={preview || !editor}
            onClick={run}
            className="flex h-9 w-9 items-center justify-center text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-panel)]"
          >
            <Icon size={16} />
          </button>
        ))}
        <button type="button" disabled={preview || !editor} aria-label={label("링크", "リンク", "Link")} className="flex h-9 w-9 items-center justify-center text-[var(--text-primary)]" onClick={()=>{setLinkUrl(editor?.getAttributes('link').href ?? '');setLinkError(false);setLinkOpen(!linkOpen)}}><Link2 size={16}/></button>
        {onPreviewChange && <button type="button" className="note-preview-button" aria-pressed={preview} onClick={()=>onPreviewChange(!preview)}>{preview ? <Pencil size={16}/> : <Eye size={16}/>}{preview ? label("편집", "編集", "Edit") : label("미리보기", "プレビュー", "Preview")}</button>}
      </div>
      {!preview && <p className="px-3 py-1 text-xs text-[var(--text-secondary)]">{label('키워드 자동 인식 끄기: \\못 → 못', 'キーワードの自動認識を切る: \\火傷 → 火傷', 'Disable keyword detection: \\Burn → Burn')}</p>}
      {linkOpen && !preview && <form noValidate className="note-link-form" onSubmit={e=>{
        e.preventDefault();
        if (!editor) return;
        if (!linkUrl.trim()) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkOpen(false); return; }
        try {
          const url=new URL(linkUrl);
          if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw Error();
          if (editor.state.selection.empty && !editor.isActive('link')) editor.chain().focus().insertContent({type:'text',text:url.href,marks:[{type:'link',attrs:{href:url.href}}]}).run();
          else editor.chain().focus().extendMarkRange('link').setLink({href:url.href}).run();
          setLinkOpen(false);
        } catch { setLinkError(true); }
      }}><input autoFocus type="url" value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} aria-label={label("링크 주소", "リンクURL", "Link URL")} placeholder="https://"/><button type="submit">{label("적용", "適用", "Apply")}</button><button type="button" onClick={()=>setLinkOpen(false)} aria-label={label("닫기", "閉じる", "Close")}><X size={16}/></button>{linkError && <span role="alert">{label("올바른 웹 주소를 입력하세요", "有効なURLを入力してください", "Enter a valid web URL")}</span>}</form>}
      {preview && <div className="note-editor-preview">{previewContent}</div>}
      <div hidden={preview}><NoteAssetsProvider doc={markdownToTiptapContent(value)}><EditorContent
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
            event.stopPropagation();
            select(suggestions[selected]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setSuggestions([]);
          }
        }}
      />
      </NoteAssetsProvider></div>
      <NoteAutocompleteDropdown
        suggestions={suggestions}
        selectedIdx={selected}
        onSelect={select}
        onHover={setSelected}
        anchor={anchor}
      />
    </div></NoteFormationContext.Provider>
  );
}
