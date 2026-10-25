'use client'
import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Construction, Plus, Trash2 } from 'lucide-react'
import { showError, showSuccess } from '@/lib/toast'
import Switch from '@/components/ui/Switch'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { maintenanceStatus, type MaintenanceRow, type MaintenanceStatus } from '@/lib/maintenance'

type Draft = { path: string; reason: string; message: string; starts: string; ends: string; is_active: boolean }
const EMPTY: Draft = { path: '/', reason: '', message: '', starts: '', ends: '', is_active: true }
const PATHS = ['/', '/planner', '/planner/run', '/decks', '/mirror-dungeon', '/sinners', '/meta', '/tools']

/** ISO instant -> value for <input type="datetime-local"> in the admin's own time zone. */
function toLocalInput(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null)

export default function AdminMaintenance() {
  const locale = useLocale()
  const t = useTranslations('adminShell')
  const L = (ko: string, ja: string, en: string) => (locale === 'ko' ? ko : locale === 'ja' ? ja : en)
  const [items, setItems] = useState<MaintenanceRow[]>([])
  const [edge, setEdge] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<MaintenanceRow | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceRow | null>(null)
  const [now, setNow] = useState(() => new Date())
  const failure = L('처리하지 못했습니다. 다시 시도해주세요.', '処理できませんでした。再試行してください。', 'Unable to complete the request. Please retry.')

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/maintenance')
      if (!r.ok) throw Error()
      const body = await r.json()
      setItems(body.items)
      setEdge(body.edge)
      setError('')
    } catch {
      setError(failure)
    }
  }, [failure])
  useEffect(() => {
    void load()
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [load])

  function open(row: MaintenanceRow | 'new') {
    setSelected(row)
    setDraft(row === 'new' ? EMPTY : {
      path: row.path, reason: row.reason, message: row.message,
      starts: toLocalInput(row.starts_at), ends: toLocalInput(row.ends_at), is_active: row.is_active,
    })
  }
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  function extendEnd(minutes: number) {
    const base = draft.starts ? new Date(draft.starts) : new Date()
    set({ ends: toLocalInput(new Date(base.getTime() + minutes * 60_000).toISOString()) })
  }

  function reportEdge(result: string) {
    if (result === 'failed') showError(L('저장했지만 Edge Config에 반영하지 못했습니다. 다시 저장해 주세요.', '保存しましたがEdge Configへの反映に失敗しました。', 'Saved, but Edge Config was not updated. Save again.'))
    else showSuccess(result === 'synced' ? L('저장했습니다. 바로 반영됩니다.', '保存しました。すぐに反映されます。', 'Saved. Applies right away.') : L('저장했습니다. 15초 안에 반영됩니다.', '保存しました。15秒以内に反映されます。', 'Saved. Applies within 15 seconds.'))
  }

  async function save() {
    if (!selected) return
    setBusy(true)
    try {
      const editing = selected !== 'new' ? selected : null
      const r = await fetch(editing ? `/api/admin/maintenance/${editing.id}` : '/api/admin/maintenance', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: draft.path, reason: draft.reason, message: draft.message, is_active: draft.is_active,
          starts_at: fromLocalInput(draft.starts), ends_at: fromLocalInput(draft.ends),
        }),
      })
      const row = await r.json()
      if (!r.ok) throw Error(row.error)
      reportEdge(row.edge)
      open(row)
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
      const r = await fetch(`/api/admin/maintenance/${deleteTarget.id}`, { method: 'DELETE' })
      const body = await r.json()
      if (!r.ok) throw Error(body.error)
      if (selected !== 'new' && selected?.id === deleteTarget.id) setSelected(null)
      setDeleteTarget(null)
      showSuccess(t('deleted'))
      await load()
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : failure)
    } finally {
      setBusy(false)
    }
  }

  const statusLabel: Record<MaintenanceStatus, string> = {
    live: L('진행 중', '実施中', 'Live'),
    scheduled: L('예약됨', '予約', 'Scheduled'),
    ended: L('종료', '終了', 'Ended'),
    off: L('꺼짐', 'オフ', 'Off'),
  }
  const tone: Record<MaintenanceStatus, string | undefined> = { live: 'danger', scheduled: 'warn', ended: undefined, off: undefined }
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : null)
  const range = (row: Pick<MaintenanceRow, 'starts_at' | 'ends_at'>) =>
    `${when(row.starts_at) ?? L('즉시', '即時', 'Now')} → ${when(row.ends_at) ?? L('직접 끌 때까지', '手動で終了', 'Until turned off')}`
  const draftStatus = maintenanceStatus({ is_active: draft.is_active, starts_at: fromLocalInput(draft.starts), ends_at: fromLocalInput(draft.ends) }, now)

  return (
    <section className="admin-page">
      <header className="admin-topbar">
        <div>
          <h1>{L('점검 관리', 'メンテナンス管理', 'Maintenance')}</h1>
          <p>
            {edge
              ? L('Edge Config로 저장 즉시 반영됩니다. 관리자는 점검 중에도 사이트를 볼 수 있습니다.', 'Edge Configで即時反映。管理者はメンテナンス中も閲覧できます。', 'Applied instantly through Edge Config. Admins can still browse.')
              : L('저장 후 15초 안에 반영됩니다. 관리자는 점검 중에도 사이트를 볼 수 있습니다.', '保存後15秒以内に反映。管理者はメンテナンス中も閲覧できます。', 'Applies within 15 seconds. Admins can still browse.')}
          </p>
        </div>
        <div className="admin-topbar-actions">
          <button className="admin-button primary" onClick={() => open('new')}>
            <Plus size={16} aria-hidden="true" />
            {L('새 점검', '新規', 'New')}
          </button>
        </div>
      </header>
      <div className="admin-body is-flush announcement-manager-grid">
        <aside className="admin-pane announcement-manager-list" aria-label={L('점검 목록', '一覧', 'Windows')}>
          {error ? (
            <div className="admin-state" role="alert">
              <p>{error}</p>
              <button className="admin-button" onClick={load}>{L('다시 시도', '再試行', 'Retry')}</button>
            </div>
          ) : items.length === 0 ? (
            <div className="admin-state"><p>{L('등록된 점검이 없습니다.', 'メンテナンスはありません。', 'No maintenance windows.')}</p></div>
          ) : (
            <ul className="admin-list">
              {items.map((row) => {
                const status = maintenanceStatus(row, now)
                return (
                  <li key={row.id}>
                    <button className="admin-list-row" aria-current={selected !== 'new' && selected?.id === row.id ? 'true' : undefined} onClick={() => open(row)}>
                      <strong>{row.reason || row.path}</strong>
                      <span className="admin-list-meta">
                        <span className="admin-chip" data-tone={tone[status]}>{statusLabel[status]}</span>
                        <code>{row.path}</code>
                      </span>
                      <span className="admin-list-meta">{range(row)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>
        {selected ? (
          <section className="admin-pane announcement-compose">
            <div className="announcement-compose-body maintenance-form">
              <label>
                <span>{L('대상 경로', '対象パス', 'Path')}</span>
                <input list="maintenance-paths" value={draft.path} maxLength={120} onChange={(e) => set({ path: e.target.value })} />
                <small>{L('/는 사이트 전체, /planner는 플래너와 그 아래 모든 페이지입니다.', '/ はサイト全体、/planner はプランナー以下すべてです。', '/ blocks the whole site; /planner blocks the planner and every page under it.')}</small>
                <datalist id="maintenance-paths">{PATHS.map((p) => <option key={p} value={p} />)}</datalist>
              </label>
              <label>
                <span>{L('사유', '理由', 'Reason')}</span>
                <input value={draft.reason} maxLength={120} placeholder={L('예: 게임 업데이트 데이터 반영', '例: ゲームアップデートの反映', 'e.g. Game update data')} onChange={(e) => set({ reason: e.target.value })} />
              </label>
              <label>
                <span>{L('안내 문구', '案内文', 'Message')}</span>
                <textarea rows={3} value={draft.message} maxLength={500} placeholder={L('비워 두면 기본 문구를 보여 줍니다.', '空欄の場合は既定の文を表示します。', 'Leave empty to show the default text.')} onChange={(e) => set({ message: e.target.value })} />
              </label>
              <div className="maintenance-times">
                <label>
                  <span>{L('시작', '開始', 'Starts')}</span>
                  <input type="datetime-local" value={draft.starts} onChange={(e) => set({ starts: e.target.value })} />
                  <small>{L('비우면 저장 즉시 시작', '空欄なら保存直後に開始', 'Empty starts on save')}</small>
                </label>
                <label>
                  <span>{L('종료', '終了', 'Ends')}</span>
                  <input type="datetime-local" value={draft.ends} onChange={(e) => set({ ends: e.target.value })} />
                  <span className="maintenance-quick">
                    {[30, 60, 120].map((m) => (
                      <button key={m} type="button" className="admin-button" onClick={() => extendEnd(m)}>
                        +{m < 60 ? L(`${m}분`, `${m}分`, `${m}m`) : L(`${m / 60}시간`, `${m / 60}時間`, `${m / 60}h`)}
                      </button>
                    ))}
                    {draft.ends && <button type="button" className="admin-button" onClick={() => set({ ends: '' })}>{L('지우기', 'クリア', 'Clear')}</button>}
                  </span>
                </label>
              </div>
              <div className="announcement-options">
                <label>
                  <Switch checked={draft.is_active} onChange={(active) => set({ is_active: active })} />
                  <span>{L('점검 켜기', 'メンテナンスを有効化', 'Enabled')}</span>
                </label>
                <span className="admin-chip" data-tone={tone[draftStatus]}>{statusLabel[draftStatus]}</span>
              </div>
            </div>
            <footer className="announcement-compose-actions">
              <div>
                {selected !== 'new' && (
                  <button className="admin-button danger" disabled={busy} onClick={() => setDeleteTarget(selected)}>
                    <Trash2 size={15} aria-hidden="true" />
                    {L('삭제', '削除', 'Delete')}
                  </button>
                )}
              </div>
              <div>
                <a className="admin-button" href={`/${locale}/maintenance?${new URLSearchParams({
                  from: draft.path,
                  ...(draft.reason && { reason: draft.reason }),
                  ...(draft.message && { message: draft.message }),
                  ...(draft.starts && { starts_at: fromLocalInput(draft.starts)! }),
                  ...(draft.ends && { ends_at: fromLocalInput(draft.ends)! }),
                })}`} target="_blank" rel="noreferrer">
                  {L('점검 화면 미리보기', 'プレビュー', 'Preview page')}
                </a>
                <button className="admin-button primary" disabled={busy || !draft.path.startsWith('/')} onClick={save}>
                  {busy ? '…' : L('저장', '保存', 'Save')}
                </button>
              </div>
            </footer>
          </section>
        ) : (
          <div className="admin-pane admin-state">
            <Construction size={28} aria-hidden="true" />
            <p>{L('새 점검을 만들거나 왼쪽 목록에서 선택하세요.', '新規作成または一覧から選択してください。', 'Create a window or select one from the list.')}</p>
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
        title={L('점검을 삭제할까요?', '削除しますか？', 'Delete this window?')}
        message={deleteTarget ? `${deleteTarget.reason || deleteTarget.path} · ${range(deleteTarget)}` : ''}
      />
    </section>
  )
}
