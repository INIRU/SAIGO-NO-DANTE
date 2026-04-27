'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  EyeOff,
  Globe2,
  Mail,
  Search,
  Shield,
  ShieldAlert,
  UserRound,
  X,
} from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
} from '@/components/admin'
import { showError, showSuccess } from '@/lib/toast'

interface User {
  id: string
  username: string | null
  email: string | null
  avatar_url: string | null
  role: string | null
  suspended: boolean | null
  suspension_reason?: string | null
  suspended_until?: string | null
  suspended_at?: string | null
  suspended_by?: string | null
  last_seen_at?: string | null
  last_ip_masked?: string | null
  last_country?: string | null
  auth_last_sign_in_at?: string | null
  created_at: string
  deck_count?: number | null
  same_ip_hash_count?: number | null
  same_user_agent_hash_count?: number | null
  duplicate_risk_count?: number | null
  duplicate_risk?: boolean | null
  duplicate_matches?: DuplicateMatch[] | null
  moderation_history?: ModerationHistoryEntry[] | null
  audit_history?: ModerationHistoryEntry[] | null
}

interface DuplicateMatch {
  id: string
  username?: string | null
  email?: string | null
  avatar_url?: string | null
  match_types?: DuplicateMatchType[] | null
  matchTypes?: DuplicateMatchType[] | null
  same_ip?: boolean | null
  same_user_agent?: boolean | null
  last_seen_at?: string | null
  last_country?: string | null
  created_at?: string | null
}

interface ModerationHistoryEntry {
  id?: string
  action?: string
  created_at?: string
  reason?: string | null
  actor_email?: string | null
  actor_name?: string | null
  severity?: string | null
  details?: Record<string, unknown> | null
}

type DuplicateMatchType = 'ip' | 'user_agent'

interface ModerationHistoryState {
  status: 'idle' | 'loading' | 'success' | 'error'
  entries: ModerationHistoryEntry[]
  error?: string
}

type ModerationHistoryPayload = ModerationHistoryEntry[] | {
  history?: ModerationHistoryEntry[]
  entries?: ModerationHistoryEntry[]
  data?: ModerationHistoryEntry[]
}

type PendingAction =
  | { type: 'role'; user: User; newRole: string }
  | { type: 'suspend'; user: User }
  | { type: 'unsuspend'; user: User }

type UsersPayload = User[] | {
  users?: User[]
  data?: User[]
  total?: number
  count?: number
  hasMore?: boolean
  nextOffset?: number | null
}

const PAGE_SIZE = 40

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

const STATUS_OPTIONS = [
  { value: 'all', label: '전체 상태' },
  { value: 'active', label: '정상' },
  { value: 'suspended', label: '정지' },
  { value: 'expired', label: '만료 정지' },
]

const DURATION_OPTIONS = [
  { value: '1d', label: '1일' },
  { value: '3d', label: '3일' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: 'indefinite', label: '무기한' },
  { value: 'custom', label: '직접 지정' },
]

function normalizeUser(user: User): User {
  return {
    ...user,
    role: user.role ?? 'user',
    suspended: user.suspended ?? false,
    deck_count: user.deck_count ?? 0,
  }
}

function maskEmail(email?: string | null) {
  if (!email) return 'email 없음'
  const [local, domain] = email.split('@')
  if (!domain) return `${email.slice(0, 2)}***`
  const localPrefix = local.slice(0, Math.min(2, local.length))
  const domainPrefix = domain.slice(0, 1)
  const domainSuffix = domain.includes('.') ? domain.slice(domain.lastIndexOf('.')) : ''
  return `${localPrefix}***@${domainPrefix}***${domainSuffix}`
}

function maskIdentifier(value?: string | null, fallback = 'ID 없음') {
  if (!value) return fallback
  if (value.length <= 6) return '***'
  return `${value.slice(0, 3)}***${value.slice(-2)}`
}

function sensitiveText(value: string | null | undefined, masked: boolean, fallback: string, maskedLabel: string) {
  if (!value) return fallback
  return masked ? maskedLabel : value
}

function displayNameForUser(user: User, maskSensitive: boolean) {
  if (user.username) return user.username
  if (user.email) return maskSensitive ? maskEmail(user.email) : user.email
  return maskSensitive ? maskIdentifier(user.id) : user.id.slice(0, 8)
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short' }).format(date)
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function resolveSuspendedUntil(duration: string, customDate: string) {
  if (duration === 'indefinite') return null
  if (duration === 'custom') {
    if (!customDate) return undefined
    const date = new Date(`${customDate}T23:59:59`)
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
  }
  const days = Number(duration.replace('d', ''))
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function getRoleTone(role: string | null) {
  if (role === 'admin') return { color: '#c98272', border: 'rgba(170,92,70,0.42)' }
  if (role === 'wanjang') return { color: 'var(--gold)', border: 'rgba(200,144,10,0.42)' }
  return { color: '#9a8a6a', border: 'rgba(122,104,69,0.3)' }
}

function duplicateSignalText(user: User) {
  const sameIp = user.same_ip_hash_count ?? 0
  const sameUa = user.same_user_agent_hash_count ?? 0
  if (sameIp <= 1 && sameUa <= 1) return '중복 신호 없음'
  return `IP ${sameIp || '-'} / UA ${sameUa || '-'}`
}

function getDuplicateMatches(user: User) {
  return user.duplicate_matches ?? []
}

function hasDuplicateSignal(user: User) {
  return Boolean(user.duplicate_risk) || getDuplicateMatches(user).length > 0
}

function getDuplicateMatchTypes(match: DuplicateMatch): DuplicateMatchType[] {
  const rawTypes = match.match_types ?? match.matchTypes
  if (Array.isArray(rawTypes) && rawTypes.length > 0) {
    return rawTypes.filter(type => type === 'ip' || type === 'user_agent')
  }

  const types: DuplicateMatchType[] = []
  if (match.same_ip) types.push('ip')
  if (match.same_user_agent) types.push('user_agent')
  return types
}

function duplicateMatchName(match: DuplicateMatch, maskSensitive: boolean) {
  if (match.username) return match.username
  if (match.email) return maskSensitive ? maskEmail(match.email) : match.email
  return maskSensitive ? maskIdentifier(match.id) : match.id.slice(0, 8)
}

function duplicateMatchTypeLabel(types: DuplicateMatchType[]) {
  if (types.includes('ip') && types.includes('user_agent')) return 'IP+UA'
  if (types.includes('ip')) return 'IP'
  if (types.includes('user_agent')) return 'UA'
  return '신호'
}

function DuplicateTypeBadge({ type }: { type: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-sm border font-mono"
      style={{
        borderColor: 'rgba(200,144,10,0.22)',
        color: '#c8a450',
        background: 'rgba(13,11,8,0.36)',
        padding: '0.0625rem 0.3125rem',
        fontSize: '0.625rem',
        lineHeight: 1.45,
      }}
    >
      {type}
    </span>
  )
}

function DuplicateSignalInline({ user, maskSensitive }: { user: User; maskSensitive: boolean }) {
  const matches = getDuplicateMatches(user)
  if (matches.length === 0) return <>{duplicateSignalText(user)}</>

  const visibleMatches = matches.slice(0, 2)
  const remaining = matches.length - visibleMatches.length

  return (
    <>
      <span className="shrink-0">중복:</span>
      <span className="min-w-0 truncate">
        {visibleMatches.map(match => duplicateMatchName(match, maskSensitive)).join(', ')}
        {remaining > 0 ? ` 외 ${remaining}` : ''}
      </span>
      {visibleMatches.slice(0, 1).map(match => (
        <DuplicateTypeBadge key={`${match.id}-inline-type`} type={duplicateMatchTypeLabel(getDuplicateMatchTypes(match))} />
      ))}
    </>
  )
}

function DuplicateMatchesDetail({ user, maskSensitive }: { user: User; maskSensitive: boolean }) {
  const matches = getDuplicateMatches(user)

  if (matches.length === 0) {
    return <DetailItem label="중복 신호" value={duplicateSignalText(user)} mono />
  }

  return (
    <div className="min-w-0 rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.1)', padding: '0.625rem 0.75rem' }}>
      <p className="font-mono" style={{ color: '#7a6845', fontSize: '0.6875rem' }}>중복 계정</p>
      <div className="mt-2 space-y-2">
        {matches.map(match => {
          const types = getDuplicateMatchTypes(match)
          const name = duplicateMatchName(match, maskSensitive)
          const email = match.email ? (maskSensitive ? maskEmail(match.email) : match.email) : null
          return (
            <div key={match.id} className="min-w-0 border-l" style={{ borderColor: 'rgba(200,144,10,0.22)', paddingLeft: '0.625rem' }}>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="min-w-0 truncate font-sans" style={{ color: '#d6be7a', fontSize: '0.75rem', fontWeight: 700 }}>
                  {name}
                </span>
                <DuplicateTypeBadge type={duplicateMatchTypeLabel(types)} />
              </div>
              <p className="mt-1 break-words font-sans" style={{ color: '#8a7a5a', fontSize: '0.6875rem', lineHeight: 1.55 }}>
                {email && email !== name ? `${email} / ` : ''}
                {formatDateTime(match.last_seen_at)} / {match.last_country ?? '국가 없음'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function parseModerationHistoryPayload(payload: ModerationHistoryPayload) {
  if (Array.isArray(payload)) return payload
  return payload.history ?? payload.entries ?? payload.data ?? []
}

function actionLabel(action?: string) {
  if (action === 'role_change') return '역할 변경'
  if (action === 'suspend') return '계정 정지'
  if (action === 'unsuspend') return '정지 해제'
  if (action === 'suspension_expired') return '정지 만료'
  return action ?? 'moderation'
}

function detailString(details: Record<string, unknown> | null | undefined, key: string) {
  const value = details?.[key]
  return typeof value === 'string' ? value : null
}

function nestedDetailString(details: Record<string, unknown> | null | undefined, group: string, key: string) {
  const value = details?.[group]
  if (!value || typeof value !== 'object') return null
  const nested = value as Record<string, unknown>
  return typeof nested[key] === 'string' ? nested[key] : null
}

function summarizeHistoryEntry(entry: ModerationHistoryEntry) {
  const reason = entry.reason
    ?? detailString(entry.details, 'reason')
    ?? nestedDetailString(entry.details, 'after', 'reason')
    ?? nestedDetailString(entry.details, 'before', 'reason')
  if (reason) return reason

  const from = detailString(entry.details, 'from')
  const to = detailString(entry.details, 'to')
  if (from || to) return `${from ?? '-'} -> ${to ?? '-'}`

  const until = nestedDetailString(entry.details, 'after', 'until')
    ?? nestedDetailString(entry.details, 'before', 'until')
  if (until) return `종료 ${formatDateTime(until)}`

  return '세부 사유 없음'
}

function Badge({ children, tone }: { children: React.ReactNode; tone: { color: string; border: string } }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border font-sans" style={{ color: tone.color, background: 'transparent', borderColor: tone.border, padding: '0.1875rem 0.5rem', fontSize: '0.6875rem', fontWeight: 700 }}>
      <span style={{ width: '0.3125rem', height: '0.3125rem', borderRadius: '999rem', background: tone.color }} />
      {children}
    </span>
  )
}

function parseUsersPayload(payload: UsersPayload, offset: number) {
  if (Array.isArray(payload)) {
    const sliced = payload.slice(offset, offset + PAGE_SIZE)
    return {
      users: sliced.map(normalizeUser),
      total: payload.length,
      hasMore: offset + PAGE_SIZE < payload.length,
    }
  }

  const rows = payload.users ?? payload.data ?? []
  const total = payload.total ?? payload.count ?? offset + rows.length
  return {
    users: rows.map(normalizeUser),
    total,
    hasMore: payload.hasMore ?? (payload.nextOffset != null || offset + rows.length < total),
  }
}

function UserAvatar({ user, maskSensitive }: { user: User; maskSensitive: boolean }) {
  const visibleName = displayNameForUser(user, maskSensitive)
  if (user.avatar_url) {
    return (
      <div className="relative shrink-0 overflow-hidden rounded-sm border" style={{ width: '2.25rem', height: '2.25rem', borderColor: 'rgba(200,144,10,0.18)' }}>
        <Image src={user.avatar_url} alt={`${visibleName} avatar`} fill sizes="2.25rem" style={{ objectFit: 'cover' }} />
      </div>
    )
  }

  return (
    <div className="flex shrink-0 items-center justify-center rounded-sm border font-mono" style={{ width: '2.25rem', height: '2.25rem', borderColor: 'rgba(200,144,10,0.18)', background: 'rgba(13,11,8,0.38)', color: 'var(--gold)', fontSize: '0.8125rem', fontWeight: 700 }}>
      {(visibleName[0] ?? '?').toUpperCase()}
    </div>
  )
}

function DetailItem({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.1)', padding: '0.625rem 0.75rem' }}>
      <p className="font-mono" style={{ color: '#7a6845', fontSize: '0.6875rem' }}>{label}</p>
      <div className={mono ? 'mt-1 break-words font-sans tabular-nums' : 'mt-1 break-words font-sans'} style={{ color: '#c8a450', fontSize: '0.75rem', lineHeight: 1.55 }}>
        {value}
      </div>
    </div>
  )
}

function AdminPortalSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  style,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
  style?: React.CSSProperties
}) {
  const selectedLabel = options.find(option => option.value === value)?.label

  return (
    <div style={style}>
      {label && <label style={{ color: '#888888', fontSize: '0.6875rem', marginBottom: '0.25rem', display: 'block' }}>{label}</label>}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild disabled={disabled}>
          <button
            type="button"
            aria-label={label ?? placeholder ?? '선택'}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              background: 'rgba(13,11,8,0.48)',
              border: '0.0625rem solid var(--border)',
              borderRadius: '0.25rem',
              color: selectedLabel ? '#c8a450' : '#888888',
              fontSize: '0.8125rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              textAlign: 'left',
              touchAction: 'manipulation',
            }}
          >
            <span className="min-w-0 flex-1 truncate">{selectedLabel ?? placeholder ?? '선택'}</span>
            <ChevronDown size="0.875rem" aria-hidden="true" style={{ flexShrink: 0, color: '#888888' }} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={2}
            className="overflow-y-auto rounded-sm border shadow-[0_1rem_2rem_rgba(0,0,0,0.38)]"
            style={{
              zIndex: 60,
              minWidth: 'var(--radix-dropdown-menu-trigger-width)',
              maxHeight: 'min(15rem, var(--radix-dropdown-menu-content-available-height))',
              background: '#1a1510',
              borderColor: 'var(--border)',
              padding: '0.25rem',
            }}
          >
            {placeholder && (
              <DropdownMenu.Item
                onSelect={() => onChange('')}
                className="cursor-pointer rounded-sm px-3 py-2 font-sans outline-none focus:bg-white/5"
                style={{ color: '#888888', fontSize: '0.8125rem' }}
              >
                {placeholder}
              </DropdownMenu.Item>
            )}
            {options.map(option => (
              <DropdownMenu.Item
                key={option.value}
                onSelect={() => onChange(option.value)}
                className="cursor-pointer rounded-sm px-3 py-2 font-sans outline-none focus:bg-white/5"
                style={{
                  color: option.value === value ? '#e8b030' : '#c8a450',
                  background: option.value === value ? 'rgba(200,144,10,0.12)' : 'transparent',
                  fontSize: '0.8125rem',
                  fontWeight: option.value === value ? 600 : 400,
                }}
              >
                {option.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}

function ModerationHistory({ state }: { state: ModerationHistoryState | undefined }) {
  let content: React.ReactNode
  let countLabel = '대기'

  if (!state || state.status === 'idle' || state.status === 'loading') {
    content = (
      <div className="space-y-2" aria-live="polite" aria-busy="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={`history-skeleton-${index}`} className="rounded-sm border" style={{ height: '2.5rem', borderColor: 'rgba(200,144,10,0.08)', background: 'rgba(8,7,5,0.44)' }} />
        ))}
      </div>
    )
  } else if (state.status === 'error') {
    countLabel = '오류'
    content = (
      <div role="alert" className="rounded-sm border" style={{ borderColor: 'rgba(170,92,70,0.35)', padding: '0.75rem', color: '#c98272', fontSize: '0.75rem' }}>
        {state.error ?? '모더레이션 기록을 불러오지 못했습니다.'}
      </div>
    )
  } else if (state.entries.length === 0) {
    countLabel = '0건'
    content = (
      <div className="rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.08)', padding: '0.75rem', color: '#7a6845', fontSize: '0.75rem', background: 'rgba(8,7,5,0.24)' }}>
        관련 모더레이션 기록이 없습니다.
      </div>
    )
  } else {
    const history = state.entries
    countLabel = `${history.length}건`
    content = (
      <div className="divide-y" style={{ borderColor: 'rgba(200,144,10,0.1)' }}>
        {history.slice(0, 5).map((entry, entryIndex) => (
          <div key={entry.id ?? `${entry.action ?? 'history'}-${entry.created_at ?? entryIndex}`} className="grid gap-2 py-2 md:grid-cols-[8rem_1fr_9rem]">
            <span className="font-sans" style={{ color: '#c8a450', fontSize: '0.75rem', fontWeight: 700 }}>{actionLabel(entry.action)}</span>
            <span className="break-words font-sans" style={{ color: '#9a8a6a', fontSize: '0.75rem' }}>
              {summarizeHistoryEntry(entry)}
              {(entry.actor_name || entry.actor_email) && (
                <span className="ml-2 font-mono" style={{ color: '#665a42', fontSize: '0.6875rem' }}>
                  by {entry.actor_name ?? entry.actor_email}
                </span>
              )}
            </span>
            <span className="font-sans tabular-nums" style={{ color: '#665a42', fontSize: '0.6875rem' }}>{formatDateTime(entry.created_at)}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <section
      className="rounded-sm border"
      aria-label="모더레이션 기록"
      style={{
        borderColor: 'rgba(200,144,10,0.14)',
        background: 'rgba(8,7,5,0.42)',
        padding: '0.75rem',
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-3 border-b" style={{ borderColor: 'rgba(200,144,10,0.12)', paddingBottom: '0.5rem' }}>
        <p className="font-mono" style={{ color: '#7a6845', fontSize: '0.6875rem' }}>MODERATION HISTORY</p>
        <span className="rounded-sm border font-sans tabular-nums" style={{ borderColor: 'rgba(200,144,10,0.14)', color: '#8a7a5a', padding: '0.125rem 0.375rem', fontSize: '0.6875rem' }}>
          {countLabel}
        </span>
      </div>
      {content}
    </section>
  )
}

function UserRow({
  user,
  expanded,
  updating,
  onToggle,
  onPending,
  maskSensitive,
  historyState,
}: {
  user: User
  expanded: boolean
  updating: boolean
  onToggle: () => void
  onPending: (action: PendingAction) => void
  maskSensitive: boolean
  historyState?: ModerationHistoryState
}) {
  const role = user.role ?? 'user'
  const suspended = Boolean(user.suspended)
  const moderationLabel = suspended ? '정지 해제' : '계정 정지'
  const visibleName = displayNameForUser(user, maskSensitive)
  const visibleEmail = maskSensitive ? maskEmail(user.email) : user.email ?? 'email 없음'
  const visibleIp = sensitiveText(user.last_ip_masked, maskSensitive, 'IP 없음', 'IP 숨김')
  const visibleAccessMeta = `${formatDateTime(user.last_seen_at ?? user.auth_last_sign_in_at)} / ${visibleIp} / ${user.last_country ?? '국가 없음'}`

  return (
    <article className="border-b" style={{ borderColor: 'rgba(200,144,10,0.1)' }}>
      <div className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(18rem,1.45fr)_7rem_13rem_14rem_8rem] lg:items-center">
        <button type="button" onClick={onToggle} className="flex min-w-0 items-center gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]" aria-expanded={expanded}>
          <UserAvatar user={user} maskSensitive={maskSensitive} />
          <div className="min-w-0">
            <p className="truncate font-sans" style={{ color: '#d6be7a', fontSize: '0.8125rem', fontWeight: 700 }}>{visibleName}</p>
            <p className="mt-1 flex min-w-0 items-center gap-1 truncate font-sans" style={{ color: '#9a8a6a', fontSize: '0.75rem' }}>
              <Mail size="0.75rem" aria-hidden="true" />
              {visibleEmail}
            </p>
          </div>
          <ChevronDown size="0.875rem" className={`ml-auto shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ color: '#7a6845' }} aria-hidden="true" />
        </button>

        <div>
          {suspended ? (
            <div className="space-y-1">
              <Badge tone={{ color: '#c98272', border: 'rgba(170,92,70,0.42)' }}>정지</Badge>
              <p className="font-sans tabular-nums" style={{ color: '#7a6845', fontSize: '0.6875rem' }}>{user.suspended_until ? formatDate(user.suspended_until) : '무기한'}</p>
            </div>
          ) : (
            <Badge tone={{ color: '#9aac7d', border: 'rgba(118,138,96,0.36)' }}>정상</Badge>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <Badge tone={getRoleTone(role)}>{ROLE_LABELS[role] ?? role}</Badge>
          <AdminPortalSelect
            value={role}
            onChange={newRole => {
              if (newRole !== role) onPending({ type: 'role', user, newRole })
            }}
            options={ROLE_OPTIONS}
            disabled={updating}
            style={{ minWidth: '6.25rem' }}
          />
        </div>

        <div className="space-y-1">
          <p className="flex items-center gap-1 whitespace-nowrap font-sans tabular-nums" style={{ color: '#c8a450', fontSize: '0.75rem' }}>
            <Clock3 size="0.75rem" aria-hidden="true" />
            {formatDateTime(user.last_seen_at ?? user.auth_last_sign_in_at)}
          </p>
          <p className="flex items-center gap-1 whitespace-nowrap font-sans" style={{ color: '#9a8a6a', fontSize: '0.75rem' }}>
            <Globe2 size="0.75rem" aria-hidden="true" />
            {user.last_country ?? '국가 없음'} / {visibleIp}
          </p>
          {hasDuplicateSignal(user) && (
            <p className="flex min-w-0 items-center gap-1 font-sans" style={{ color: '#c98272', fontSize: '0.6875rem', fontWeight: 700 }}>
              <ShieldAlert size="0.75rem" aria-hidden="true" />
              <DuplicateSignalInline user={user} maskSensitive={maskSensitive} />
            </p>
          )}
        </div>

        <div className="flex items-center justify-start gap-2 lg:justify-end">
          <AdminButton
            onClick={() => onPending({ type: suspended ? 'unsuspend' : 'suspend', user })}
            variant={suspended ? 'success' : 'danger'}
            size="sm"
            title={suspended ? '정지 해제' : '계정 정지'}
            disabled={updating}
          >
            {suspended ? <CheckCircle2 size="0.875rem" aria-hidden="true" /> : <Ban size="0.875rem" aria-hidden="true" />}
            {moderationLabel}
          </AdminButton>
        </div>
      </div>

      {expanded && (
        <div className="border-t px-3 py-3" style={{ borderColor: 'rgba(200,144,10,0.08)', background: 'rgba(13,11,8,0.24)' }}>
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr_0.8fr]">
            <DetailItem label="정지 사유" value={user.suspension_reason ?? '기록 없음'} />
            <DetailItem label="정지 기간" value={`${formatDateTime(user.suspended_at)} -> ${user.suspended_until ? formatDateTime(user.suspended_until) : '무기한'}`} mono />
            <DetailItem label="이메일" value={visibleEmail} mono />
            <DetailItem label="최근 접속" value={visibleAccessMeta} mono />
            <DuplicateMatchesDetail user={user} maskSensitive={maskSensitive} />
            <DetailItem label="활동" value={`${user.deck_count ?? 0} decks / join ${formatDate(user.created_at)}`} mono />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.1)', padding: '0.75rem' }}>
            <span className="font-sans" style={{ color: '#8a7a5a', fontSize: '0.75rem' }}>모더레이션</span>
            <AdminButton
              onClick={() => onPending({ type: suspended ? 'unsuspend' : 'suspend', user })}
              variant={suspended ? 'success' : 'danger'}
              size="sm"
              disabled={updating}
            >
              {suspended ? <CheckCircle2 size="0.875rem" aria-hidden="true" /> : <Ban size="0.875rem" aria-hidden="true" />}
              {moderationLabel}
            </AdminButton>
          </div>
          <div className="mt-3">
            <ModerationHistory state={historyState} />
          </div>
        </div>
      )}
    </article>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [updating, setUpdating] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [maskSensitive, setMaskSensitive] = useState(true)
  const [moderationHistory, setModerationHistory] = useState<Record<string, ModerationHistoryState>>({})
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState('7d')
  const [customDate, setCustomDate] = useState('')
  const [modalError, setModalError] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadErrorShownRef = useRef(false)
  const moderationHistoryRef = useRef<Record<string, ModerationHistoryState>>({})
  const historyAbortRef = useRef<Record<string, AbortController>>({})

  const fetchUsers = useCallback(async (offset: number, mode: 'reset' | 'append') => {
    if (mode === 'append') setLoadingMore(true)
    else setLoading(true)

    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })
    const trimmedSearch = search.trim()
    if (trimmedSearch) params.set('search', trimmedSearch)
    if (roleFilter !== 'all') params.set('role', roleFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)

    try {
      const response = await fetch(`/api/admin/users?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('users')
      const parsed = parseUsersPayload(await response.json() as UsersPayload, offset)
      loadErrorShownRef.current = false

      setUsers(prev => {
        if (mode === 'reset') return parsed.users
        const seen = new Set(prev.map(user => user.id))
        return [...prev, ...parsed.users.filter(user => !seen.has(user.id))]
      })
      setTotal(parsed.total)
      setHasMore(parsed.hasMore)
    } catch {
      if (!loadErrorShownRef.current) {
        loadErrorShownRef.current = true
        showError('유저 목록을 불러오지 못했습니다.')
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [roleFilter, search, statusFilter])

  useEffect(() => {
    setExpandedId(null)
    fetchUsers(0, 'reset')
  }, [fetchUsers])

  useEffect(() => {
    moderationHistoryRef.current = moderationHistory
  }, [moderationHistory])

  const fetchModerationHistory = useCallback(async (userId: string, force = false) => {
    const current = moderationHistoryRef.current[userId]
    if (!force && (current?.status === 'loading' || current?.status === 'success')) return

    historyAbortRef.current[userId]?.abort()
    const controller = new AbortController()
    historyAbortRef.current[userId] = controller

    setModerationHistory(prev => ({
      ...prev,
      [userId]: { status: 'loading', entries: [] },
    }))

    try {
      const response = await fetch(`/api/admin/users/${userId}/moderation-history`, { cache: 'no-store', signal: controller.signal })
      if (!response.ok) throw new Error('history')
      const entries = parseModerationHistoryPayload(await response.json() as ModerationHistoryPayload)
      setModerationHistory(prev => ({
        ...prev,
        [userId]: { status: 'success', entries },
      }))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setModerationHistory(prev => ({
        ...prev,
        [userId]: {
          status: 'error',
          entries: [],
          error: '모더레이션 기록을 불러오지 못했습니다.',
        },
      }))
    } finally {
      if (historyAbortRef.current[userId] === controller) {
        delete historyAbortRef.current[userId]
      }
    }
  }, [])

  useEffect(() => {
    if (!expandedId) return
    void fetchModerationHistory(expandedId)
    return () => {
      historyAbortRef.current[expandedId]?.abort()
    }
  }, [expandedId, fetchModerationHistory])

  useEffect(() => () => {
    Object.values(historyAbortRef.current).forEach(controller => controller.abort())
  }, [])

  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasMore || loading || loadingMore) return

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        fetchUsers(users.length, 'append')
      }
    }, { rootMargin: '0% 0% 25% 0%' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [fetchUsers, hasMore, loading, loadingMore, users.length])

  useEffect(() => {
    if (pending?.type === 'suspend') {
      setReason(pending.user.suspension_reason ?? '')
      setDuration('7d')
      setCustomDate('')
      setModalError(null)
    } else if (pending) {
      setModalError(null)
    }
  }, [pending])

  const counts = useMemo(() => {
    const suspended = users.filter(user => user.suspended).length
    const admins = users.filter(user => user.role === 'admin').length
    const withAccess = users.filter(user => user.last_seen_at || user.auth_last_sign_in_at).length
    const duplicateRisk = users.filter(hasDuplicateSignal).length
    return { loaded: users.length, total: total || users.length, suspended, admins, withAccess, duplicateRisk }
  }, [total, users])

  const updateUser = useCallback((userId: string, patch: Partial<User>) => {
    setUsers(prev => prev.map(item => item.id === userId ? { ...item, ...patch } : item))
  }, [])

  const handleRoleConfirm = useCallback(async (user: User, newRole: string) => {
    setUpdating(user.id)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!response.ok) throw new Error('role')
      updateUser(user.id, { role: newRole })
      void fetchModerationHistory(user.id, true)
      showSuccess(`역할이 ${ROLE_LABELS[newRole] ?? newRole}(으)로 변경되었습니다.`)
      setPending(null)
    } catch {
      showError('역할을 변경하지 못했습니다.')
    } finally {
      setUpdating(null)
    }
  }, [fetchModerationHistory, updateUser])

  const handleSuspend = useCallback(async (user: User) => {
    const trimmedReason = reason.trim()
    const suspendedUntil = resolveSuspendedUntil(duration, customDate)
    if (!trimmedReason) {
      setModalError('사유를 입력해야 합니다.')
      return
    }
    if (suspendedUntil === undefined) {
      setModalError('정지 종료일을 지정해야 합니다.')
      return
    }

    setUpdating(user.id)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: true, reason: trimmedReason, suspendedUntil }),
      })
      if (!response.ok) throw new Error('suspend')
      updateUser(user.id, {
        suspended: true,
        suspension_reason: trimmedReason,
        suspended_until: suspendedUntil,
        suspended_at: new Date().toISOString(),
      })
      void fetchModerationHistory(user.id, true)
      showSuccess('계정 정지가 적용되었습니다.')
      setPending(null)
    } catch {
      showError('계정을 정지하지 못했습니다.')
    } finally {
      setUpdating(null)
    }
  }, [customDate, duration, fetchModerationHistory, reason, updateUser])

  const handleUnsuspend = useCallback(async (user: User) => {
    setUpdating(user.id)
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: false }),
      })
      if (!response.ok) throw new Error('unsuspend')
      updateUser(user.id, {
        suspended: false,
        suspension_reason: null,
        suspended_until: null,
        suspended_at: null,
        suspended_by: null,
      })
      void fetchModerationHistory(user.id, true)
      showSuccess('계정 정지가 해제되었습니다.')
      setPending(null)
    } catch {
      showError('정지를 해제하지 못했습니다.')
    } finally {
      setUpdating(null)
    }
  }, [fetchModerationHistory, updateUser])

  return (
    <div className="mx-auto w-full max-w-[78rem]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono" style={{ color: '#8a7a5a', fontSize: '0.6875rem' }}>USER MODERATION</p>
          <h1 className="mt-1 font-serif text-2xl font-bold" style={{ color: 'var(--gold)' }}>유저 관리</h1>
        </div>
        <div className="flex flex-wrap items-end justify-end gap-3">
          <button
            type="button"
            onClick={() => setMaskSensitive(value => !value)}
            className="inline-flex items-center gap-2 rounded-sm border font-sans transition-[background-color,border-color,color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-white/5 active:translate-y-[0.0625rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
            style={{
              borderColor: maskSensitive ? 'rgba(200,144,10,0.36)' : 'rgba(170,92,70,0.36)',
              color: maskSensitive ? '#c8a450' : '#c98272',
              padding: '0.5rem 0.75rem',
              fontSize: '0.75rem',
              touchAction: 'manipulation',
            }}
            aria-pressed={!maskSensitive}
          >
            {maskSensitive ? <EyeOff size="0.875rem" aria-hidden="true" /> : <Eye size="0.875rem" aria-hidden="true" />}
            {maskSensitive ? '민감 정보 숨김' : '민감 정보 표시'}
          </button>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {[
            { label: '로드', value: `${counts.loaded}/${counts.total}`, icon: UserRound },
            { label: '관리자', value: counts.admins, icon: Shield },
            { label: '정지', value: counts.suspended, icon: ShieldAlert },
            { label: '접속 기록', value: counts.withAccess, icon: Globe2 },
            { label: '중복 신호', value: counts.duplicateRisk, icon: CheckCircle2 },
          ].map(item => {
            const Icon = item.icon
            return (
              <div key={item.label} className="border-l" style={{ borderColor: 'rgba(200,144,10,0.22)', padding: '0.375rem 0.75rem', background: 'transparent' }}>
                <p className="mb-1 flex items-center gap-1" style={{ color: '#7a6845', fontSize: '0.6875rem' }}><Icon size="0.75rem" aria-hidden="true" />{item.label}</p>
                <p className="font-sans text-lg tabular-nums" style={{ color: 'var(--gold)', fontWeight: 700 }}>{item.value}</p>
              </div>
            )
          })}
          </div>
        </div>
      </div>

      <section className="mb-4 grid gap-2 lg:grid-cols-[1fr_10rem_10rem]">
        <div className="relative">
          <Search size="0.875rem" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#7a6845' }} aria-hidden="true" />
          <AdminInput value={search} onChange={setSearch} placeholder="이름, 이메일, ID 검색" style={{ paddingLeft: '2.25rem' }} />
        </div>
        <AdminPortalSelect value={roleFilter} onChange={setRoleFilter} options={[{ value: 'all', label: '전체 역할' }, ...ROLE_OPTIONS]} />
        <AdminPortalSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
      </section>

      <section className="overflow-hidden rounded-md border" style={{ borderColor: 'rgba(200,144,10,0.14)', background: 'rgba(26,21,16,0.5)' }}>
        <div className="hidden grid-cols-[minmax(18rem,1.45fr)_7rem_13rem_14rem_8rem] gap-3 border-b px-3 py-2 font-mono lg:grid" style={{ borderColor: 'rgba(200,144,10,0.12)', color: '#7a6845', fontSize: '0.6875rem' }}>
          <span>유저</span>
          <span>상태</span>
          <span>역할</span>
          <span>최근 접속</span>
          <span className="text-right">관리</span>
        </div>

        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={`user-skeleton-${index}`} className="rounded-sm border" style={{ height: '3.5rem', borderColor: 'rgba(200,144,10,0.08)', background: 'rgba(13,11,8,0.28)' }} />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#888888', fontSize: '0.8125rem' }}>조건에 맞는 유저가 없습니다.</div>
        ) : (
          users.map(user => (
            <UserRow
              key={user.id}
              user={user}
              expanded={expandedId === user.id}
              updating={updating === user.id}
              onToggle={() => setExpandedId(prev => prev === user.id ? null : user.id)}
              onPending={setPending}
              maskSensitive={maskSensitive}
              historyState={moderationHistory[user.id]}
            />
          ))
        )}
      </section>

      <div ref={sentinelRef} className="h-1" />
      {!loading && (
        <div className="mt-4 flex justify-center">
          {hasMore ? (
            <AdminButton onClick={() => fetchUsers(users.length, 'append')} loading={loadingMore} disabled={loadingMore} variant="ghost">
              {loadingMore ? '더 불러오는 중…' : '더 불러오기'}
            </AdminButton>
          ) : (
            <p className="font-mono" style={{ color: '#665a42', fontSize: '0.6875rem' }}>END OF USER LIST</p>
          )}
        </div>
      )}

      <BaseModal open={!!pending} onClose={() => setPending(null)} title="유저 관리" maxWidth="34rem">
        {pending && (
          <div className="rounded-md border" style={{ borderColor: 'rgba(200,144,10,0.22)', background: '#1a1510', padding: '1.25rem' }}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono" style={{ color: '#8a7a5a', fontSize: '0.6875rem' }}>{displayNameForUser(pending.user, maskSensitive)}</p>
                <h2 className="mt-1 font-serif text-xl font-bold" style={{ color: pending.type === 'suspend' ? '#c98272' : 'var(--gold)' }}>
                  {pending.type === 'role' ? '역할 변경' : pending.type === 'unsuspend' ? '정지 해제' : '계정 정지'}
                </h2>
              </div>
              <button type="button" onClick={() => setPending(null)} className="rounded-sm border transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]" style={{ borderColor: 'var(--border)', color: '#8a7a5a', padding: '0.375rem' }} aria-label="닫기">
                <X size="1rem" aria-hidden="true" />
              </button>
            </div>

            {pending.type === 'role' && (
              <div className="space-y-4">
                <div className="rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.14)', padding: '0.875rem', color: '#c8a450', fontSize: '0.8125rem' }}>
                  {ROLE_LABELS[pending.user.role ?? 'user'] ?? pending.user.role} -&gt; {ROLE_LABELS[pending.newRole] ?? pending.newRole}
                </div>
                <div className="flex justify-end gap-2">
                  <AdminButton variant="ghost" onClick={() => setPending(null)}>취소</AdminButton>
                  <AdminButton loading={updating === pending.user.id} onClick={() => handleRoleConfirm(pending.user, pending.newRole)}>변경</AdminButton>
                </div>
              </div>
            )}

            {pending.type === 'suspend' && (
              <div className="space-y-4">
                <AdminTextarea label="정지 사유" value={reason} onChange={value => { setReason(value); setModalError(null) }} rows={4} required placeholder="사유를 입력하세요" />
                <div className="grid gap-3 md:grid-cols-[1fr_11rem]">
                  <AdminSelect label="기간" value={duration} onChange={value => { setDuration(value); setModalError(null) }} options={DURATION_OPTIONS} />
                  <AdminInput label="종료일" type="date" value={customDate} onChange={value => { setCustomDate(value); setModalError(null) }} disabled={duration !== 'custom'} />
                </div>
                {modalError && <p role="alert" style={{ color: '#ee6666', fontSize: '0.75rem' }}>{modalError}</p>}
                <div className="flex justify-end gap-2">
                  <AdminButton variant="ghost" onClick={() => setPending(null)}>취소</AdminButton>
                  <AdminButton variant="danger" loading={updating === pending.user.id} onClick={() => handleSuspend(pending.user)}>정지 적용</AdminButton>
                </div>
              </div>
            )}

            {pending.type === 'unsuspend' && (
              <div className="space-y-4">
                <div className="rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.14)', background: 'transparent', padding: '0.875rem' }}>
                  <p style={{ color: '#9aac7d', fontSize: '0.8125rem', fontWeight: 700 }}>현재 정지 정보</p>
                  <p style={{ color: '#9a8a6a', fontSize: '0.75rem', marginTop: '0.375rem', lineHeight: 1.6 }}>
                    {pending.user.suspension_reason ?? '사유 없음'} · {pending.user.suspended_until ? formatDateTime(pending.user.suspended_until) : '무기한'}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <AdminButton variant="ghost" onClick={() => setPending(null)}>취소</AdminButton>
                  <AdminButton variant="success" loading={updating === pending.user.id} onClick={() => handleUnsuspend(pending.user)}>정지 해제</AdminButton>
                </div>
              </div>
            )}
          </div>
        )}
      </BaseModal>
    </div>
  )
}
