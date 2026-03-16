'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { Ban, CheckCircle } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'
import {
  AdminInput, AdminSelect, AdminIconButton,
  AdminTable, useToast, AdminToastContainer,
} from '@/components/admin'

interface User {
  id: string
  username: string | null
  email: string | null
  avatar_url: string | null
  role: string
  suspended: boolean
  created_at: string
  deck_count: number
}

type PendingAction = { type: 'role'; user: User; newRole: string } | { type: 'suspend'; user: User }

const ROLE_LABELS: Record<string, string> = {
  user: '유저',
  wanjang: '완장',
  admin: '관리자',
}

const ROLE_OPTIONS = [
  { value: 'user', label: '일반' },
  { value: 'wanjang', label: '완장' },
  { value: 'admin', label: '관리자' },
]

function getRoleBadgeStyle(role: string) {
  if (role === 'admin') {
    return {
      background: 'rgba(180,60,60,0.15)',
      color: '#cc6666',
      border: '1px solid rgba(180,60,60,0.4)',
    }
  }
  if (role === 'wanjang') {
    return {
      background: 'rgba(200,144,10,0.15)',
      color: 'var(--gold)',
      border: '1px solid var(--gold-dim)',
    }
  }
  return {
    background: 'rgba(100,100,120,0.1)',
    color: '#666677',
    border: '1px solid #555570',
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const [updating, setUpdating] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [search, setSearch] = useState('')
  const { toasts, showToast, dismissToast } = useToast()

  const fetchUsers = () => {
    setLoading(true)
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => showToast('유저 목록을 불러오지 못했습니다.', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [])

  const handleConfirm = useCallback(async () => {
    if (!pending) return
    const { user } = pending
    setPending(null)
    setUpdating(user.id)

    try {
      if (pending.type === 'role') {
        const newRole = pending.newRole
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        })
        if (!res.ok) throw new Error()
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u))
        showToast(`역할이 "${ROLE_LABELS[newRole] ?? newRole}"(으)로 변경되었습니다.`, 'success')
      } else {
        const res = await fetch(`/api/admin/users/${user.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suspended: !user.suspended }),
        })
        if (!res.ok) throw new Error()
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, suspended: !u.suspended } : u))
        showToast(user.suspended ? '계정 정지가 해제되었습니다.' : '계정이 정지되었습니다.', 'success')
      }
    } catch {
      showToast('작업 중 오류가 발생했습니다.', 'error')
    } finally {
      setUpdating(null)
    }
  }, [pending])

  const getModalProps = () => {
    if (!pending) return { title: '', message: '', variant: 'default' as const }
    const { user } = pending
    const name = user.username ?? user.email ?? '유저'
    if (pending.type === 'role') {
      const newLabel = ROLE_LABELS[pending.newRole] ?? pending.newRole
      return {
        title: '역할 변경',
        message: `${name}의 역할을 "${newLabel}"(으)로 변경하시겠습니까?`,
        variant: 'warning' as const,
      }
    }
    return {
      title: user.suspended ? '정지 해제' : '계정 정지',
      message: user.suspended
        ? `${name}의 계정 정지를 해제하시겠습니까?`
        : `${name}의 계정을 정지하시겠습니까? 해당 유저는 서비스를 이용할 수 없게 됩니다.`,
      variant: (user.suspended ? 'default' : 'danger') as 'default' | 'danger',
    }
  }

  const modalProps = getModalProps()

  const filteredUsers = search
    ? users.filter(u =>
        (u.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : users

  const columns = [
    {
      key: 'user' as const,
      header: '유저',
      render: (user: User) => (
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', position: 'relative', border: '1px solid var(--border)' }}>
              <Image src={user.avatar_url} alt="" fill sizes="28px" style={{ objectFit: 'cover' }} />
            </div>
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(200,144,10,0.1)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--gold)', fontSize: '0.6875rem', fontWeight: 'bold',
            }}>
              {(user.username ?? '?')[0]?.toUpperCase()}
            </div>
          )}
          <span style={{ color: '#c8a450', fontSize: '0.8125rem' }}>{user.username ?? '(없음)'}</span>
        </div>
      ),
    },
    {
      key: 'email' as const,
      header: '이메일',
      render: (user: User) => (
        <span style={{ color: '#7a6845', fontSize: '0.75rem' }}>{user.email ?? '-'}</span>
      ),
    },
    {
      key: 'role' as const,
      header: '역할',
      render: (user: User) => {
        const badgeStyle = getRoleBadgeStyle(user.role)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '2px 8px', borderRadius: '3px', fontSize: '0.6875rem', fontWeight: 600,
              ...badgeStyle,
            }}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <AdminSelect
              value={user.role}
              onChange={newRole => {
                if (newRole !== user.role) setPending({ type: 'role', user, newRole })
              }}
              options={ROLE_OPTIONS}
            />
          </div>
        )
      },
    },
    {
      key: 'status' as const,
      header: '상태',
      render: (user: User) => user.suspended ? (
        <span style={{ color: '#aa4444', fontSize: '0.6875rem', fontWeight: 600 }}>정지됨</span>
      ) : (
        <span style={{ color: '#44aa44', fontSize: '0.6875rem' }}>정상</span>
      ),
    },
    {
      key: 'created_at' as const,
      header: '가입일',
      render: (user: User) => (
        <span style={{ color: '#888888', fontSize: '0.75rem' }}>
          {new Date(user.created_at).toLocaleDateString('ko-KR')}
        </span>
      ),
    },
    {
      key: 'deck_count' as const,
      header: '덱',
      render: (user: User) => (
        <span style={{ color: '#7a6845', fontSize: '0.75rem' }}>{user.deck_count}</span>
      ),
    },
    {
      key: 'actions' as const,
      header: '관리',
      render: (user: User) => (
        <div className="flex items-center gap-1">
          <AdminIconButton
            onClick={() => setPending({ type: 'suspend', user })}
            variant={user.suspended ? 'default' : 'danger'}
            title={user.suspended ? '정지 해제' : '계정 정지'}
          >
            {user.suspended ? <CheckCircle size={14} /> : <Ban size={14} />}
          </AdminIconButton>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--gold)' }}>유저 관리</h1>
        <p style={{ color: '#888888', fontSize: '0.8125rem' }}>유저 목록 조회, 권한 변경, 계정 정지를 관리합니다.</p>
      </div>

      <div className="card p-4 mb-6" style={{ borderColor: '#2a2020' }}>
        <p style={{ color: '#888888', fontSize: '0.75rem', lineHeight: 1.7 }}>
          <span style={{ color: '#c8a450' }}>역할 변경 시</span> 해당 유저가 다시 로그인해야 적용됩니다.
          환경변수 <code style={{ color: '#88cc88', fontSize: '0.6875rem' }}>ADMIN_EMAILS</code>에 등록된 이메일은 항상 관리자입니다.
        </p>
      </div>

      <div className="mb-4">
        <AdminInput
          value={search}
          onChange={setSearch}
          placeholder="이름 또는 이메일로 검색..."
        />
      </div>

      {loading ? (
        <div style={{ color: '#888888', fontSize: '0.8125rem' }}>로딩 중...</div>
      ) : (
        <AdminTable
          columns={columns}
          data={filteredUsers.map(u => ({ ...u, suspended: u.suspended ?? false }))}
          keyExtractor={u => u.id}
          emptyMessage="유저가 없습니다."
        />
      )}

      <ConfirmModal
        open={!!pending}
        title={modalProps.title}
        message={modalProps.message}
        confirmLabel="확인"
        variant={modalProps.variant}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />

      <AdminToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
