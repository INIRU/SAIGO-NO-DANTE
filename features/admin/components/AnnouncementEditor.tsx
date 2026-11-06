'use client'
import { useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import ImageExtension from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link2,
  ImagePlus,
  Undo2,
  Redo2,
} from 'lucide-react'
import { type RichNode, safeAnnouncementLink } from '@/lib/announcements'
import './editor.css'
export default function AnnouncementEditor({
  initial,
  onChange,
  onUploadingChange,
  lang,
}: {
  initial: RichNode
  onChange: (doc: RichNode) => void
  onUploadingChange: (busy: boolean) => void
  lang: string
}) {
  const ko = lang === 'ko',
    ja = lang === 'ja'
  const [error, setError] = useState(''),
    [uploading, setUploading] = useState(false),
    [showLink, setShowLink] = useState(false),
    [url, setUrl] = useState(''),
    [alt, setAlt] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: { openOnClick: false },
      }),
      ImageExtension,
      Placeholder.configure({
        placeholder: ko
          ? '관리자 소식을 작성하세요. 이미지와 링크도 넣을 수 있습니다.'
          : ja
            ? 'お知らせを入力してください。'
            : 'Write your announcement. Add images and links.',
      }),
    ],
    content: initial,
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichNode),
    editorProps: {
      attributes: {
        class: 'announcement-body',
        role: 'textbox',
        'aria-label': ko
          ? '공지 본문'
          : ja
            ? 'お知らせ本文'
            : 'Announcement body',
        'aria-multiline': 'true',
      },
    },
  })
  async function upload(file?: File) {
    if (!file || !editor) return
    setUploading(true)
    onUploadingChange(true)
    setError('')
    try {
      const body = new FormData()
      body.set('file', file)
      const r = await fetch('/api/admin/announcements/images', {
        method: 'POST',
        body,
      })
      const data = await r.json()
      if (!r.ok) throw Error(data.error)
      editor
        .chain()
        .focus()
        .setImage({ src: data.url, alt })
        .createParagraphNear()
        .run()
      setAlt('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      onUploadingChange(false)
      if (input.current) input.current.value = ''
    }
  }
  const tools = [
    {
      label: ko ? '굵게' : 'Bold',
      icon: Bold,
      active: 'bold',
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: ko ? '기울임' : 'Italic',
      icon: Italic,
      active: 'italic',
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: ko ? '소제목' : 'Heading',
      icon: Heading2,
      active: 'heading',
      run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: ko ? '글머리 기호' : 'Bullet list',
      icon: List,
      active: 'bulletList',
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: ko ? '번호 목록' : 'Ordered list',
      icon: ListOrdered,
      active: 'orderedList',
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: ko ? '인용' : 'Quote',
      icon: Quote,
      active: 'blockquote',
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
  ]
  return (
    <div className="announcement-editor">
      <div
        className="announcement-toolbar"
        role="toolbar"
        aria-label={ko ? '본문 서식' : 'Formatting'}
      >
        {tools.map((t) => (
          <button
            type="button"
            key={t.active}
            title={t.label}
            aria-label={t.label}
            aria-pressed={editor?.isActive(t.active) ?? false}
            onClick={t.run}
          >
            <t.icon size={17} />
          </button>
        ))}
        <span />
        <button
          type="button"
          title={ko ? '링크' : 'Link'}
          aria-label={ko ? '링크' : 'Link'}
          onClick={() => setShowLink(!showLink)}
        >
          <Link2 size={17} />
        </button>
        <button
          type="button"
          title={ko ? '이미지 삽입' : 'Insert image'}
          aria-label={ko ? '이미지 삽입' : 'Insert image'}
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={17} />
        </button>
        <span />
        <button
          type="button"
          aria-label={ko ? '실행 취소' : 'Undo'}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 size={17} />
        </button>
        <button
          type="button"
          aria-label={ko ? '다시 실행' : 'Redo'}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 size={17} />
        </button>
      </div>
      {showLink && (
        <div className="editor-link">
          <input
            type="url"
            aria-label="URL"
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="button"
            disabled={!safeAnnouncementLink(url)}
            onClick={() => {
              editor
                ?.chain()
                .focus()
                .extendMarkRange('link')
                .setLink({ href: url })
                .run()
              setShowLink(false)
              setUrl('')
            }}
          >
            {ko ? '링크 적용' : ja ? '適用' : 'Apply'}
          </button>
          <button
            type="button"
            onClick={() => {
              editor?.chain().focus().unsetLink().run()
              setShowLink(false)
            }}
          >
            {ko ? '링크 해제' : ja ? '解除' : 'Remove'}
          </button>
        </div>
      )}
      <input
        hidden
        ref={input}
        data-testid="announcement-image-input"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <EditorContent editor={editor} />
      <div className="editor-image-help">
        <input
          aria-label={ko ? '삽입할 이미지 설명' : 'Image description'}
          placeholder={
            ko
              ? '삽입할 이미지 설명 (선택)'
              : ja
                ? '画像の説明（任意）'
                : 'Image description (optional)'
          }
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
        />
        <small>
          {uploading
            ? ko
              ? '이미지 업로드 중…'
              : 'Uploading…'
            : ko
              ? '공개 이미지 · PNG / JPG / WebP · 최대 8MB'
              : ja
                ? '公開画像 · 最大8MB'
                : 'Public images · Up to 8MB'}
        </small>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
