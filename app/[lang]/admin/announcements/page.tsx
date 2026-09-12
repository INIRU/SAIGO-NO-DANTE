'use client'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Plus, Eye, PenLine, Trash2, Pin } from 'lucide-react'
import dynamic from 'next/dynamic'
import ConfirmModal from '@/components/ui/ConfirmModal'
import AnnouncementBody from '@/components/announcements/AnnouncementBody'
import {
  type Announcement,
  type RichNode,
  plainAnnouncementDocument,
  announcementText,
} from '@/lib/announcements'
import '@/components/support/support.css'
const AnnouncementEditor = dynamic(
  () => import('@/components/announcements/AnnouncementEditor'),
  { ssr: false },
)
export default function AdminAnnouncements() {
  const locale = useLocale()
  const ko = locale === 'ko',
    ja = locale === 'ja'
  const [items, setItems] = useState<Announcement[]>([]),
    [editing, setEditing] = useState<Announcement | null>(null),
    [creating, setCreating] = useState(false),
    [title, setTitle] = useState(''),
    [doc, setDoc] = useState<RichNode>(plainAnnouncementDocument('')),
    [lang, setLang] = useState('ko'),
    [pinned, setPinned] = useState(false),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null),
    [dirty, setDirty] = useState(false),
    [pending, setPending] = useState<Announcement | 'new' | null>(null)
  const [editorRevision, setEditorRevision] = useState(0)
  const failure = ko
    ? '처리하지 못했습니다. 다시 시도해주세요.'
    : ja
      ? '処理できませんでした。再試行してください。'
      : 'Unable to complete the request. Please retry.'
  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/announcements')
      if (!r.ok) throw Error()
      setItems(await r.json())
    } catch {
      setError(failure)
    }
  }, [failure])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])
  function open(item: Announcement | 'new') {
    if (busy || uploading) return
    if (dirty) {
      setPending(item)
      return
    }
    start(item)
  }
  function start(item: Announcement | 'new') {
    setEditorRevision((n) => n + 1)
    const row = item === 'new' ? null : item
    setEditing(row)
    setCreating(!row)
    setTitle(row?.title ?? '')
    setDoc(row?.content_doc ?? plainAnnouncementDocument(row?.content ?? ''))
    setLang(row?.lang ?? 'ko')
    setPinned(row?.pinned ?? false)
    setPreview(false)
    setError('')
    setNotice('')
    setDirty(false)
  }
  async function save(published: boolean) {
    setBusy(true)
    setError('')
    try {
      const r = await fetch(
        editing
          ? `/api/admin/announcements/${editing.id}`
          : '/api/admin/announcements',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content: announcementText(doc),
            content_doc: doc,
            lang,
            pinned,
            published,
          }),
        },
      )
      const row = await r.json()
      if (!r.ok) throw Error(row.error)
      setEditing(row)
      setCreating(false)
      setDirty(false)
      setNotice(
        ko
          ? published
            ? '공지가 게시되었습니다.'
            : '임시 저장되었습니다.'
          : ja
            ? '保存しました。'
            : 'Saved.',
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : failure)
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      const r = await fetch(`/api/admin/announcements/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!r.ok) throw Error()
      if (editing?.id === deleteTarget.id) {
        setEditing(null)
        setCreating(false)
        setDirty(false)
      }
      setDeleteTarget(null)
      await load()
    } catch {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="announcement-manager">
      <header className="desk-heading">
        <div>
          <span className="desk-eyebrow">ANNOUNCEMENTS</span>
          <h1>{ko ? '공지 관리' : ja ? 'お知らせ管理' : 'Announcements'}</h1>
          <p>
            {ko
              ? '작성하고, 미리 보고, 준비되면 게시하세요.'
              : ja
                ? '編集・プレビュー・公開をひとつの画面で。'
                : 'Write, preview, and publish when ready.'}
          </p>
        </div>
        <button className="desk-button primary" onClick={() => open('new')}>
          <Plus size={16} />
          {ko ? '새 공지' : ja ? '新規' : 'New'}
        </button>
      </header>
      {error && (
        <p role="alert" className="desk-feedback error">
          {error}
          <button onClick={load}>{ko ? '다시 시도' : 'Retry'}</button>
        </p>
      )}
      {notice && (
        <p className="desk-feedback" role="status">
          {notice}
        </p>
      )}
      <div className="announcement-manager-grid">
        <aside className="announcement-manager-list">
          {items.length === 0 ? (
            <p className="desk-empty">
              {ko
                ? '첫 공지를 작성해보세요.'
                : ja
                  ? 'お知らせを作成してください。'
                  : 'Write your first announcement.'}
            </p>
          ) : (
            items.map((i) => (
              <button
                key={i.id}
                className={`desk-row ${editing?.id === i.id ? 'active' : ''}`}
                onClick={() => open(i)}
              >
                <span className="desk-row-meta">
                  <span
                    className={`desk-status ${i.published ? 'answered' : 'open'}`}
                  >
                    {ko
                      ? i.published
                        ? '게시됨'
                        : '임시 저장'
                      : ja
                        ? i.published
                          ? '公開'
                          : '下書き'
                        : i.published
                          ? 'Published'
                          : 'Draft'}
                  </span>
                  <span>{i.lang.toUpperCase()}</span>
                </span>
                <strong>{i.title}</strong>
                <span className="flex items-center gap-2">
                  {i.pinned && <Pin size={12} />}
                  <time>
                    {new Date(i.updated_at ?? i.created_at).toLocaleDateString(
                      locale,
                    )}
                  </time>
                </span>
              </button>
            ))
          )}
        </aside>
        {editing || creating ? (
          <section className="announcement-compose">
            <label>
              {ko ? '제목' : ja ? '件名' : 'Title'}
              <input
                className="announcement-title"
                value={title}
                maxLength={160}
                onChange={(e) => {
                  setTitle(e.target.value)
                  setDirty(true)
                }}
              />
            </label>
            <div className="announcement-options">
              <label>
                {ko ? '언어' : ja ? '言語' : 'Language'}
                <select
                  value={lang}
                  onChange={(e) => {
                    setLang(e.target.value)
                    setDirty(true)
                  }}
                >
                  <option value="ko">한국어</option>
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => {
                    setPinned(e.target.checked)
                    setDirty(true)
                  }}
                />
                {ko
                  ? '메인 우선 표시'
                  : ja
                    ? 'ホームに優先表示'
                    : 'Feature on home'}
              </label>

            </div>
            {preview ? (
              <div className="announcement-preview">
                <h2>{title}</h2>
                <AnnouncementBody doc={doc} text="" />
              </div>
            ) : (
              <AnnouncementEditor
                key={`${editing?.id ?? 'new'}-${editorRevision}`}
                initial={doc}
                onChange={(d) => {
                  setDoc(d)
                  setDirty(true)
                }}
                onUploadingChange={setUploading}
                lang={locale}
              />
            )}
            <footer className="announcement-compose-actions">
              <div>
                {editing && (
                  <button
                    className="desk-button"
                    disabled={busy}
                    onClick={() => setDeleteTarget(editing)}
                  >
                    <Trash2 size={15} />
                    {ko ? '삭제' : ja ? '削除' : 'Delete'}
                  </button>
                )}
              </div>
              <div>
              <button
                className="desk-button"
                disabled={uploading}
              onClick={() => setPreview(!preview)}
              >
                {preview ? <PenLine size={16} /> : <Eye size={16} />}{' '}
                {ko
                  ? preview
                    ? '편집'
                    : '미리보기'
                  : ja
                    ? preview
                      ? '編集'
                      : 'プレビュー'
                    : preview
                      ? 'Edit'
                      : 'Preview'}
              </button>
                <button
                  className="desk-button"
                  disabled={busy || uploading || !title.trim()}
                  onClick={() => save(false)}
                >
                  {ko
                    ? editing?.published
                      ? '게시 내리기'
                      : '임시 저장'
                    : ja
                      ? '下書き保存'
                      : 'Save draft'}
                </button>
                <button
                  className="desk-button primary"
                  disabled={busy || uploading || !title.trim()}
                  onClick={() => save(true)}
                >
                  {busy
                    ? '…'
                    : ko
                      ? editing?.published
                        ? '변경 게시'
                        : '게시하기'
                      : ja
                        ? '公開'
                        : 'Publish'}
                </button>
              </div>
            </footer>
          </section>
        ) : (
          <div className="desk-empty">
            <PenLine size={32} />
            <p>
              {ko
                ? '새 공지를 작성하거나 왼쪽 목록에서 선택하세요.'
                : ja
                  ? 'お知らせを作成または選択してください。'
                  : 'Create an announcement or select one from the list.'}
            </p>
          </div>
        )}
      </div>
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={remove}
        title={
          ko
            ? '공지를 삭제할까요?'
            : ja
              ? '削除しますか？'
              : 'Delete announcement?'
        }
        message={deleteTarget?.title ?? ''}
      />
      <ConfirmModal
        open={Boolean(pending)}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) start(pending)
          setPending(null)
        }}
        title={
          ko
            ? '저장하지 않은 내용을 버릴까요?'
            : ja
              ? '変更を破棄しますか？'
              : 'Discard unsaved changes?'
        }
        message={
          ko
            ? '저장하지 않은 변경 사항이 사라집니다.'
            : ja
              ? '未保存の変更は失われます。'
              : 'Unsaved changes will be lost.'
        }
      />
    </section>
  )
}
