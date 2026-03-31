'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import {
  AdminInput, AdminIconButton,
  AdminTable,
} from '@/components/admin'
import { showSuccess, showError } from '@/lib/toast'

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
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : ''
      const res = await fetch(`/api/admin/decks${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDecks(Array.isArray(data) ? data : [])
    } catch {
      showError('덱 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDecks() }, [])

  const handleSearch = (e: { preventDefault: () => void }) => {
    e.preventDefault()
    fetchDecks(search)
  }

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    const id = deleteTarget.id
    const title = deleteTarget.title
    setDeleteTarget(null)
    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/decks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setDecks(prev => prev.filter(d => d.id !== id))
      showSuccess(`"${title}" 덱이 삭제되었습니다.`)
    } catch {
      showError('덱 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleting(null)
    }
  }, [deleteTarget])

  const columns = [
    {
      key: 'title' as const,
      header: '제목',
      render: (deck: Deck) => (
        <Link
          href={`/decks/${deck.id}`}
          style={{ color: '#c8a450', fontSize: '0.8125rem', textDecoration: 'none' }}
          className="hover:underline"
        >
          {deck.title}
        </Link>
      ),
    },
    {
      key: 'author' as const,
      header: '작성자',
      render: (deck: Deck) => (
        <span style={{ color: '#7a6845', fontSize: '0.75rem' }}>{deck.profiles?.username ?? '-'}</span>
      ),
    },
    {
      key: 'created_at' as const,
      header: '날짜',
      render: (deck: Deck) => (
        <span style={{ color: '#888888', fontSize: '0.75rem' }}>
          {new Date(deck.created_at).toLocaleDateString('ko-KR')}
        </span>
      ),
    },
    {
      key: 'view_count' as const,
      header: '조회',
      render: (deck: Deck) => (
        <span style={{ color: '#888888', fontSize: '0.75rem' }}>{deck.view_count}</span>
      ),
    },
    {
      key: 'vote_count' as const,
      header: '추천',
      render: (deck: Deck) => (
        <span style={{ color: '#888888', fontSize: '0.75rem' }}>{deck.vote_count}</span>
      ),
    },
    {
      key: 'actions' as const,
      header: '',
      render: (deck: Deck) => (
        <AdminIconButton
          onClick={() => setDeleteTarget(deck)}
          variant="danger"
          title="삭제"
        >
          <Trash2 size={14} />
        </AdminIconButton>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--gold)' }}>덱 관리</h1>
        <p style={{ color: '#888888', fontSize: '0.8125rem' }}>전체 덱을 조회하고 관리합니다.</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="flex-1">
          <AdminInput
            value={search}
            onChange={setSearch}
            placeholder="제목으로 검색..."
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
        <div style={{ color: '#888888', fontSize: '0.8125rem' }}>로딩 중...</div>
      ) : (
        <AdminTable
          columns={columns}
          data={decks}
          keyExtractor={d => d.id}
          emptyMessage="덱이 없습니다."
        />
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
