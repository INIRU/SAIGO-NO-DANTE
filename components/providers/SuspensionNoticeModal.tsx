'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { AlertTriangle, ExternalLink, X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'

type SuspensionPayload = {
  active?: boolean
  reason?: string | null
  suspended_until?: string | null
  suspendedUntil?: string | null
  appeal_url?: string | null
  appealUrl?: string | null
}

type StatusPayload = {
  suspension?: SuspensionPayload | null
}

const SUSPENSION_APPEAL_URL = 'https://discord.gg/efaGjQwsVB'

type SuspensionLocale = 'ko' | 'en' | 'ja'

const SUSPENSION_MODAL_COPY = {
  ko: {
    modalTitle: '계정 이용 제한 안내',
    closeLabel: '정지 안내 닫기',
    eyebrow: '계정 이용 제한',
    heading: '이용이 제한된 계정입니다',
    defaultReason: '운영 정책 위반으로 계정 이용이 제한되었습니다.',
    indefinite: '무기한',
    reason: '사유',
    until: '제한 종료',
    description: '이의 제기나 추가 확인은 Discord 서버에서 운영진에게 문의하세요.',
    appeal: '이의 제기',
    dateLocale: 'ko-KR',
  },
  en: {
    modalTitle: 'Account restriction notice',
    closeLabel: 'Close suspension notice',
    eyebrow: 'Account restricted',
    heading: 'This account has restricted access',
    defaultReason: 'Account access has been restricted for violating the operating policy.',
    indefinite: 'Indefinite',
    reason: 'Reason',
    until: 'Restriction ends',
    description: 'For an appeal or additional review, contact the moderation team on the Discord server.',
    appeal: 'Appeal',
    dateLocale: 'en-US',
  },
  ja: {
    modalTitle: 'アカウント利用制限のお知らせ',
    closeLabel: '停止案内を閉じる',
    eyebrow: 'アカウント利用制限',
    heading: 'このアカウントは利用が制限されています',
    defaultReason: '運営ポリシー違反によりアカウントの利用が制限されています。',
    indefinite: '無期限',
    reason: '理由',
    until: '制限終了',
    description: '異議申し立てや追加確認は、Discordサーバーで運営チームにお問い合わせください。',
    appeal: '異議申し立て',
    dateLocale: 'ja-JP',
  },
} as const

function getLocaleFromPathname(pathname: string | null): SuspensionLocale {
  const pathLocale = pathname?.split('/')[1]
  return pathLocale === 'ko' || pathLocale === 'ja' ? pathLocale : 'en'
}

function formatUntil(value: string | null, copy: typeof SUSPENSION_MODAL_COPY[SuspensionLocale]) {
  if (!value) return copy.indefinite
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return copy.indefinite
  return new Intl.DateTimeFormat(copy.dateLocale, { dateStyle: 'long', timeStyle: 'short' }).format(date)
}

export default function SuspensionNoticeModal() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [remote, setRemote] = useState<SuspensionPayload | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return

    let cancelled = false
    fetch('/api/legal/status', { cache: 'no-store' })
      .then(response => response.ok ? response.json() as Promise<StatusPayload> : null)
      .then(payload => {
        if (!cancelled) setRemote(payload?.suspension ?? null)
      })
      .catch(() => {
        if (!cancelled) setRemote(null)
      })

    return () => { cancelled = true }
  }, [status])

  const active = remote?.active === true || session?.user?.isSuspended === true
  const locale = useMemo(() => getLocaleFromPathname(pathname), [pathname])
  const copy = SUSPENSION_MODAL_COPY[locale]
  const until = remote?.suspended_until ?? remote?.suspendedUntil ?? null
  const reason = remote?.reason?.trim() || copy.defaultReason
  const appealUrl = SUSPENSION_APPEAL_URL

  if (!active || dismissed) return null
  if (!mounted) return null

  return (
    <BaseModal open onClose={() => setDismissed(true)} title={copy.modalTitle} maxWidth="30rem" blur={false}>
      <section
        className="rounded-md border"
        style={{
          background: '#1a1510',
          borderColor: 'rgba(200,144,10,0.24)',
          boxShadow: '0 1rem 2rem rgba(13,11,8,0.48)',
        }}
      >
        <header className="flex items-start justify-between gap-3 border-b" style={{ borderColor: 'rgba(200,144,10,0.14)', padding: '1rem' }}>
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex shrink-0 items-center justify-center rounded-sm border" style={{ width: '2rem', height: '2rem', borderColor: 'rgba(170,92,70,0.42)', color: '#c98272' }}>
              <AlertTriangle size="1rem" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-mono uppercase" style={{ color: '#8a7a5a', fontSize: '0.6875rem' }}>{copy.eyebrow}</p>
              <h2 className="mt-1 font-serif" style={{ color: '#d6be7a', fontSize: '1.125rem', fontWeight: 700 }}>{copy.heading}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-sm border transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
            style={{ borderColor: 'rgba(200,144,10,0.18)', color: '#8a7a5a', padding: '0.375rem' }}
            aria-label={copy.closeLabel}
          >
            <X size="1rem" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-3" style={{ padding: '1rem' }}>
          <dl className="grid gap-2">
            <div className="rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.12)', padding: '0.75rem' }}>
              <dt className="font-mono" style={{ color: '#7a6845', fontSize: '0.6875rem' }}>{copy.reason}</dt>
              <dd className="mt-1 break-words" style={{ color: '#d6be7a', fontSize: '0.8125rem', lineHeight: 1.6 }}>{reason}</dd>
            </div>
            <div className="rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.12)', padding: '0.75rem' }}>
              <dt className="font-mono" style={{ color: '#7a6845', fontSize: '0.6875rem' }}>{copy.until}</dt>
              <dd className="mt-1 font-mono" style={{ color: '#c8a450', fontSize: '0.8125rem' }}>{formatUntil(until, copy)}</dd>
            </div>
          </dl>
          <p style={{ color: '#9a8a6a', fontSize: '0.75rem', lineHeight: 1.65 }}>{copy.description}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <a href={appealUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-sm border transition-colors hover:bg-[rgba(200,144,10,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]" style={{ borderColor: 'rgba(200,144,10,0.36)', color: 'var(--gold)', padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>
              {copy.appeal}
              <ExternalLink size="0.875rem" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
    </BaseModal>
  )
}
