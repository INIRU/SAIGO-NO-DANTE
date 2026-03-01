'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { Loader2, Shield, ShieldOff, Ban, CheckCircle } from 'lucide-react'
import ConfirmModal from '@/components/ui/ConfirmModal'

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

const ROLE_CYCLE: Record<string, string> = {
  user: 'wanjang',
  wanjang: 'admin',
  admin: 'user',
}

const ROLE_LABELS: Record<string, string> = {
  user: '유저',
  wanjang: '완장',
  admin: '관리자',
}

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
    border: '1px solid #333344',
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)

  const fetchUsers = () => {
    setLoading(true)
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchUsers() }, [])

  const handleConfirm = useCallback(async () => {
    if (!pending) return
    const { user } = pending
    setPending(null)
    setUpdating(user.id)

    if (pending.type === 'role') {
      const newRole = pending.newRole
      await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u))
    } else {
      await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: !user.suspended }),
      })
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, suspended: !u.suspended } : u))
    }

    setUpdating(null)
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold mb-1" style={{ color: 'var(--gold)' }}>유저 관리</h1>
        <p style={{ color: '#555566', fontSize: '13px' }}>유저 목록 조회, 권한 변경, 계정 정지를 관리합니다.</p>
      </div>

      <div className="card p-4 mb-6" style={{ borderColor: '#2a2020' }}>
        <p style={{ color: '#555566', fontSize: '12px', lineHeight: 1.7 }}>
          <span style={{ color: '#c8a450' }}>역할 변경 시</span> 해당 유저가 다시 로그인해야 적용됩니다.
          환경변수 <code style={{ color: '#88cc88', fontSize: '11px' }}>ADMIN_EMAILS</code>에 등록된 이메일은 항상 관리자입니다.
          <br />
          <span style={{ color: '#7a6845' }}>역할 순환: 유저 → 완장 → 관리자 → 유저</span>
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2" style={{ color: '#555566', fontSize: '13px' }}>
          <Loader2 size={14} className="animate-spin" /> 로딩 중...
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['유저', '이메일', '역할', '상태', '가입일', '덱', '관리'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#555566', fontSize: '11px', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const badgeStyle = getRoleBadgeStyle(user.role)
                return (
                <tr key={user.id} style={{
                  borderBottom: '1px solid rgba(58,42,21,0.3)',
                  opacity: user.suspended ? 0.5 : 1,
                }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div className="flex items-center gap-3">
                      {user.avatar_url ? (
                        <Image src={user.avatar_url} alt="" width={28} height={28} unoptimized
                          style={{ borderRadius: '50%', border: '1px solid var(--border)' }} />
                      ) : (
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'rgba(200,144,10,0.1)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--gold)', fontSize: '11px', fontWeight: 'bold',
                        }}>
                          {(user.username ?? '?')[0]?.toUpperCase()}
                        </div>
                      )}
                      <span style={{ color: '#c8a450', fontSize: '13px' }}>{user.username ?? '(없음)'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#7a6845', fontSize: '12px' }}>
                    {user.email ?? '-'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: 600,
                      ...badgeStyle,
                    }}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {user.suspended ? (
                      <span style={{ color: '#aa4444', fontSize: '11px', fontWeight: 600 }}>정지됨</span>
                    ) : (
                      <span style={{ color: '#44aa44', fontSize: '11px' }}>정상</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#555566', fontSize: '12px' }}>
                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#7a6845', fontSize: '12px' }}>{user.deck_count}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const newRole = ROLE_CYCLE[user.role] ?? 'user'
                          setPending({ type: 'role', user, newRole })
                        }}
                        disabled={updating === user.id}
                        title={`역할 변경: ${ROLE_LABELS[user.role] ?? user.role} → ${ROLE_LABELS[ROLE_CYCLE[user.role] ?? 'user']}`}
                        className="transition-opacity hover:opacity-70"
                        style={{
                          padding: '4px', cursor: 'pointer', borderRadius: '3px',
                          color: user.role === 'admin' ? '#cc6666' : user.role === 'wanjang' ? 'var(--gold)' : '#555566',
                          opacity: updating === user.id ? 0.3 : 1,
                        }}
                      >
                        {user.role === 'admin' ? <ShieldOff size={14} /> : <Shield size={14} />}
                      </button>
                      <button
                        onClick={() => setPending({ type: 'suspend', user })}
                        disabled={updating === user.id}
                        title={user.suspended ? '정지 해제' : '계정 정지'}
                        className="transition-opacity hover:opacity-70"
                        style={{
                          padding: '4px', cursor: 'pointer', borderRadius: '3px',
                          color: user.suspended ? '#44aa44' : '#aa4444',
                          opacity: updating === user.id ? 0.3 : 1,
                        }}
                      >
                        {user.suspended ? <CheckCircle size={14} /> : <Ban size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#555566', fontSize: '13px' }}>
                    유저가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
    </div>
  )
}
