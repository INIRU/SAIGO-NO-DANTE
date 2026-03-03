'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, Trash2, Loader2 } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'

interface Deck {
  id: string
  title: string
  description: string | null
  vote_count: number
  view_count: number
  created_at: string
  profiles: { username: string } | null
}

export default function AdminDecksPage() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Deck | null>(null)

  const fetchDecks = async (q = '') => {
    setLoading(true)
    const params = q ? `?search=${encodeURIComponent(q)}` : ''
    const res = await fetch(`/api/admin/decks${params}`)
    const data = await res.json()
    setDecks(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchDecks() }, [])

  const handleSearch = (e: { preventDefault: () => void }) => {
    e.preventDefault()
    fetchDecks(search)
  }

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    setDeleting(id)
    await fetch(`/api/admin/decks/${id}`, { method: 'DELETE' })
    setDecks(prev => prev.filter(d => d.id !== id))
    setDeleting(null)
  }, [deleteTarget])

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--gold)' }}>덱 관리</h1>
        <p style={{ color: '#555566', fontSize: '0.8125rem' }}>전체 덱을 조회하고 관리합니다.</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#555566' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="제목으로 검색..."
            className="w-full"
            style={{
              padding: '8px 12px 8px 34px', background: '#0d0b08', border: '1px solid var(--border)',
              borderRadius: '4px', color: '#c8a450', fontSize: '0.8125rem', outline: 'none',
            }}
          />
        </div>
        <button type="submit" style={{
          padding: '8px 16px', background: 'rgba(200,144,10,0.1)', border: '1px solid var(--border)',
          borderRadius: '4px', color: 'var(--gold)', fontSize: '0.8125rem', cursor: 'pointer',
        }}>
          검색
        </button>
      </form>

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: '#555566', fontSize: '0.8125rem' }}>
          <Loader2 size={14} className="animate-spin" /> 로딩 중...
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['제목', '작성자', '날짜', '조회', '추천', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#555566', fontSize: '0.6875rem', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {decks.map(deck => (
                <tr key={deck.id} style={{ borderBottom: '1px solid rgba(58,42,21,0.3)' }}>
                  <td style={{ padding: '10px 14px', color: '#c8a450', fontSize: '0.8125rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {deck.title}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#7a6845', fontSize: '0.75rem' }}>
                    {deck.profiles?.username ?? '-'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#555566', fontSize: '0.75rem' }}>
                    {new Date(deck.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#555566', fontSize: '0.75rem' }}>{deck.view_count}</td>
                  <td style={{ padding: '10px 14px', color: '#555566', fontSize: '0.75rem' }}>{deck.vote_count}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => setDeleteTarget(deck)}
                      disabled={deleting === deck.id}
                      className="transition-opacity hover:opacity-70"
                      style={{ color: '#aa4444', cursor: 'pointer', opacity: deleting === deck.id ? 0.5 : 1 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {decks.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#555566', fontSize: '0.8125rem' }}>
                    덱이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="덱 삭제"
        message={`"${deleteTarget?.title}" 덱을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
