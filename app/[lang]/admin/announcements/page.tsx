'use client'
import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Plus, Eye, PenLine, Trash2, Pin, Megaphone } from 'lucide-react'
import { showError, showSuccess } from '@/lib/toast'
import dynamic from 'next/dynamic'
import ConfirmModal from '@/components/ui/ConfirmModal'
import Button from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'
import AnnouncementBody from '@/features/admin/components/AnnouncementBody'
import {
  type Announcement,
  type RichNode,
  plainAnnouncementDocument,
  announcementText,
} from '@/lib/announcements'
const AnnouncementEditor = dynamic(
  () => import('@/features/admin/components/AnnouncementEditor'),
  { ssr: false },
)
export default function AdminAnnouncements() {
  const locale = useLocale()
  const t = useTranslations('adminShell')
  const ko = locale === 'ko',
    ja = locale === 'ja'
  const [items, setItems] = useState<Announcement[]>([]),
    [editing, setEditing] = useState<Announcement | null>(null),
    [creating, setCreating] = useState(false),
    [title, setTitle] = useState(''),
    [doc, setDoc] = useState<RichNode>(plainAnnouncementDocument('')),
    [lang, setLang] = useState('ko'),
    [pinned, setPinned] = useState(false),
    [popup, setPopup] = useState(false),
    [discordEveryone, setDiscordEveryone] = useState(false),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(''),
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
      setError('')
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
    setPopup(row?.popup ?? false)
    setDiscordEveryone(false)
    setPreview(false)
    setDirty(false)
  }
  async function save(published: boolean) {
    setBusy(true)
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
            popup,
            published,
            discord_everyone: discordEveryone,
          }),
        },
      )
      const row = await r.json()
      if (!r.ok) throw Error(row.error)
      setEditing(row)
      setCreating(false)
      setDirty(false)
      showSuccess(
        ko
          ? published
            ? '공지가 게시되었습니다.'
            : '임시 저장되었습니다.'
          : ja
            ? '保存しました。'
            : 'Saved.',
      )
      if (row.discord === 'sent') showSuccess(ko ? '디스코드에도 보냈습니다.' : ja ? 'Discordにも送信しました。' : 'Posted to Discord.')
      else if (row.discord === 'failed') showError(ko ? '디스코드 전송에 실패했습니다. 웹후크 설정을 확인해 주세요.' : ja ? 'Discordへの送信に失敗しました。' : 'Could not post to Discord.')
      else if (row.discord === 'unconfigured') showError(ko ? '서버에 디스코드 웹후크(DISCORD_ANNOUNCEMENT_WEBHOOK_URL)가 설정되지 않아 보내지 못했습니다.' : ja ? 'サーバーにDiscord Webhookが設定されていません。' : 'The server has no Discord webhook configured.')
      await load()
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : failure)
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
      showSuccess(t('deleted'))
      await load()
    } catch {
      showError(failure)
    } finally {
      setBusy(false)
    }
  }
  const status = (published: boolean) =>
    ko ? (published ? '게시됨' : '임시 저장') : ja ? (published ? '公開' : '下書き') : published ? 'Published' : 'Draft'
  return (
    <section className="admin-page announcement-manager">
      <header className="admin-topbar">
        <div>
          <h1>{ko ? '공지 관리' : ja ? 'お知らせ管理' : 'Announcements'}</h1>
          <p>
            {ko
              ? '작성하고, 미리 보고, 준비되면 게시하세요.'
              : ja
                ? '編集・プレビュー・公開をひとつの画面で。'
                : 'Write, preview, and publish when ready.'}
          </p>
        </div>
        <div className="admin-topbar-actions">
          <Button variant="primary" icon={Plus} onClick={() => open('new')}>
            {ko ? '새 공지' : ja ? '新規' : 'New'}
          </Button>
        </div>
      </header>
      <div className="admin-body is-flush announcement-manager-grid">
        <aside className="admin-pane announcement-manager-list" aria-label={ko ? '공지 목록' : ja ? 'お知らせ一覧' : 'Announcements'}>
          {error ? (
            <div className="admin-state" role="alert">
              <p>{error}</p>
              <Button variant="secondary" onClick={load}>
                {ko ? '다시 시도' : ja ? '再試行' : 'Retry'}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="admin-state">
              <p>
                {ko
                  ? '첫 공지를 작성해보세요.'
                  : ja
                    ? 'お知らせを作成してください。'
                    : 'Write your first announcement.'}
              </p>
            </div>
          ) : (
            <ul className="admin-list">
              {items.map((i) => (
                <li key={i.id}>
                  <button
                    className="admin-list-row"
                    aria-current={editing?.id === i.id ? 'true' : undefined}
                    onClick={() => open(i)}
                  >
                    <strong>{i.title}</strong>
                    <span className="admin-list-meta">
                      <span className="admin-chip" data-tone={i.published ? 'ok' : 'warn'}>
                        {status(i.published)}
                      </span>
                      <span>{i.lang.toUpperCase()}</span>
                      {i.pinned && (
                        <Pin size={12} aria-label={ko ? '메인 우선 표시' : ja ? 'ホームに優先表示' : 'Featured on home'} />
                      )}
                      {i.popup && (
                        <Megaphone size={12} aria-label={ko ? '팝업 공지' : ja ? 'ポップアップ' : 'Popup'} />
                      )}
                      <time>{new Date(i.created_at).toLocaleDateString(locale)}</time>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        {editing || creating ? (
          <section className="admin-pane announcement-compose">
            <div className="announcement-compose-body">
              <label className="announcement-title-field">
                <span>{ko ? '제목' : ja ? '件名' : 'Title'}</span>
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
                  <span>{ko ? '언어' : ja ? '言語' : 'Language'}</span>
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
                  <Switch
                    checked={pinned}
                    onChange={(next) => {
                      setPinned(next)
                      setDirty(true)
                    }}
                  />
                  <span>{ko ? '메인 우선 표시' : ja ? 'ホームに優先表示' : 'Feature on home'}</span>
                </label>
                <label title={ko ? '게시하면 이 언어 사이트에 들어온 사람에게 한 번 팝업으로 띄웁니다' : ja ? '公開すると、この言語のサイト訪問者に一度だけ表示します' : 'Once published, shown once as a popup to visitors of this language'}>
                  <Switch
                    checked={popup}
                    onChange={(next) => {
                      setPopup(next)
                      setDirty(true)
                    }}
                  />
                  <span>{ko ? '팝업으로 띄우기' : ja ? 'ポップアップ表示' : 'Show as popup'}</span>
                </label>
                {lang === 'ko' && !editing?.published && (
                  <label title={ko ? '게시할 때 디스코드 공지에 @everyone을 붙입니다' : undefined}>
                    <Switch checked={discordEveryone} onChange={setDiscordEveryone} />
                    <span>{ko ? '디스코드 @everyone' : ja ? 'Discord @everyone' : 'Discord @everyone'}</span>
                  </label>
                )}
                {editing && (
                  <span className="admin-chip" data-tone={editing.published ? 'ok' : 'warn'}>
                    {status(editing.published)}
                  </span>
                )}
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
            </div>
            <footer className="announcement-compose-actions">
              <div>
                {editing && (
                  <Button variant="danger" icon={Trash2} className="max-[48rem]:flex-1" disabled={busy} onClick={() => setDeleteTarget(editing)}>
                    {ko ? '삭제' : ja ? '削除' : 'Delete'}
                  </Button>
                )}
              </div>
              <div>
                <Button variant="secondary" icon={preview ? PenLine : Eye} className="max-[48rem]:flex-1" disabled={uploading} onClick={() => setPreview(!preview)}>
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
                </Button>
                <Button variant="secondary" className="max-[48rem]:flex-1" disabled={busy || uploading || !title.trim()} onClick={() => save(false)}>
                  {ko ? (editing?.published ? '게시 내리기' : '임시 저장') : ja ? '下書き保存' : 'Save draft'}
                </Button>
                <Button
                  variant="primary"
                  className="max-[48rem]:flex-1"
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
                </Button>
              </div>
            </footer>
          </section>
        ) : (
          <div className="admin-pane admin-state">
            <PenLine size={28} aria-hidden="true" />
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
        variant="danger"
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        title={ko ? '공지를 삭제할까요?' : ja ? '削除しますか？' : 'Delete announcement?'}
        message={deleteTarget?.title ?? ''}
      />
      <ConfirmModal
        open={Boolean(pending)}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) start(pending)
          setPending(null)
        }}
        variant="danger"
        confirmLabel={t('discard')}
        cancelLabel={t('cancel')}
        title={ko ? '저장하지 않은 내용을 버릴까요?' : ja ? '変更を破棄しますか？' : 'Discard unsaved changes?'}
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
