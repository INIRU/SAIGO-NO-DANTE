'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'

type SuspensionPayload = {
  active?: boolean
  reason?: string | null
  suspended_until?: string | null
  suspendedUntil?: string | null
}

type StatusPayload = {
  suspension?: SuspensionPayload | null
}

const SUSPENSION_DISCORD_URL = 'https://discord.gg/efaGjQwsVB'

type SuspensionLocale = 'ko' | 'en' | 'ja'

const SUSPENSION_MODAL_COPY = {
  ko: {
    modalTitle: '계정 이용 제한 안내',
    closeLabel: '닫기',
    heading: '이용이 제한된 계정입니다',
    description: '글 작성과 수정은 제한 기간이 끝나면 다시 할 수 있어요. 제한에 이의가 있으면 문의로 알려주세요.',
    defaultReason: '운영 정책 위반',
    indefinite: '무기한',
    reason: '사유',
    until: '제한 종료',
    support: '문의하기',
    discord: 'Discord로 문의',
    dateLocale: 'ko-KR',
  },
  en: {
    modalTitle: 'Account restriction notice',
    closeLabel: 'Close',
    heading: 'This account is restricted',
    description: 'You can post and edit again once the restriction ends. If you disagree, let us know through support.',
    defaultReason: 'Violation of the site policy',
    indefinite: 'Indefinite',
    reason: 'Reason',
    until: 'Ends',
    support: 'Contact support',
    discord: 'Ask on Discord',
    dateLocale: 'en-US',
  },
  ja: {
    modalTitle: 'アカウント利用制限のお知らせ',
    closeLabel: '閉じる',
    heading: 'このアカウントは利用が制限されています',
    description: '制限期間が終わると投稿と編集ができるようになります。異議がある場合はお問い合わせください。',
    defaultReason: '運営ポリシー違反',
    indefinite: '無期限',
    reason: '理由',
    until: '制限終了',
    support: 'お問い合わせ',
    discord: 'Discordで問い合わせ',
    dateLocale: 'ja-JP',
  },
} as const

function localeOf(pathname: string | null): SuspensionLocale {
  const pathLocale = pathname?.split('/')[1]
  return pathLocale === 'en' || pathLocale === 'ja' ? pathLocale : 'ko'
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
      .then(payload => { if (!cancelled) setRemote(payload?.suspension ?? null) })
      .catch(() => { if (!cancelled) setRemote(null) })
    return () => { cancelled = true }
  }, [status])

  const locale = localeOf(pathname)
  const copy = SUSPENSION_MODAL_COPY[locale]
  const active = remote?.active === true || session?.user?.isSuspended === true
  // The support page is where the appeal is written; don't cover it.
  const onSupport = pathname?.split('/')[2] === 'support'
  if (!active || dismissed || onSupport || !mounted) return null

  const until = remote?.suspended_until ?? remote?.suspendedUntil ?? null
  const reason = remote?.reason?.trim() || copy.defaultReason
  return (
    <BaseModal open onClose={() => setDismissed(true)} title={copy.modalTitle} maxWidth="26rem" blur={false} initialFocus="dialog">
      <section className="relative overflow-hidden rounded-xl border border-[#3a2a15] bg-[#17120c] p-6 shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)]">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-[#9b2c23]" />
        <button type="button" onClick={() => setDismissed(true)} aria-label={copy.closeLabel}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-md text-[#8a7d69] transition-colors hover:bg-white/5 hover:text-[#e8dcc8] focus-visible:outline-2 focus-visible:outline-[var(--gold)]">
          <X size={16} aria-hidden="true" />
        </button>
        <h2 className="pr-8 text-[1.25rem] font-bold leading-snug text-[#f0e6d2]">{copy.heading}</h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-[#a89a84]">{copy.description}</p>
        <dl className="mt-5 divide-y divide-[#2e2417] rounded-lg border border-[#2e2417] bg-[#120e09]">
          <div className="flex gap-4 px-4 py-3">
            <dt className="w-16 shrink-0 text-[0.8125rem] text-[#8a7d69]">{copy.reason}</dt>
            <dd className="min-w-0 break-words text-[0.9375rem] leading-relaxed text-[#e8dcc8]">{reason}</dd>
          </div>
          <div className="flex gap-4 px-4 py-3">
            <dt className="w-16 shrink-0 text-[0.8125rem] text-[#8a7d69]">{copy.until}</dt>
            <dd className="text-[0.9375rem] font-semibold text-[#e8a08a]">{formatUntil(until, copy)}</dd>
          </div>
        </dl>
        <Link href={`/${locale}/support`} onClick={() => setDismissed(true)}
          className="mt-5 flex min-h-12 w-full items-center justify-center rounded-lg bg-[var(--gold)] text-[1rem] font-bold text-[#0d0b08] transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)]">
          {copy.support}
        </Link>
        <a href={SUSPENSION_DISCORD_URL} target="_blank" rel="noreferrer"
          className="mt-2 flex min-h-10 items-center justify-center rounded-lg text-[0.875rem] font-medium text-[#a89a84] transition-colors hover:text-[#e8dcc8] focus-visible:outline-2 focus-visible:outline-[var(--gold)]">
          {copy.discord}
        </a>
      </section>
    </BaseModal>
  )
}
