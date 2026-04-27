'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, X } from 'lucide-react'
import BaseModal from '@/components/ui/BaseModal'
import { showError, showSuccess } from '@/lib/toast'

type LegalPayload = {
  required?: boolean
  stale?: boolean
  currentVersion?: string | null
  acknowledgedVersion?: string | null
  termsVersion?: string | null
  privacyVersion?: string | null
}

type StatusPayload = {
  legal?: LegalPayload | null
}

const SUPPORTED_LEGAL_LOCALES = new Set(['ko', 'en', 'ja'])

type LegalLocale = 'ko' | 'en' | 'ja'

const LEGAL_MODAL_COPY = {
  ko: {
    toastSuccess: '법률 문서 확인이 기록되었습니다.',
    toastError: '확인 기록을 저장하지 못했습니다.',
    modalTitle: '법률 문서 업데이트',
    closeLabel: '법률 문서 안내 닫기',
    eyebrow: '법률 문서',
    heading: '약관 및 개인정보 처리방침이 갱신되었습니다',
    description: '계속 이용하기 전에 최신 문서를 확인해 주세요. 비로그인 공개 탐색은 차단하지 않습니다.',
    currentVersion: '현재 버전',
    acknowledgedVersion: '확인한 버전',
    noAcknowledgement: '없음',
    latest: '최신',
    terms: '이용약관',
    privacy: '개인정보 처리방침',
    saving: '저장 중...',
    confirm: '확인했습니다',
  },
  en: {
    toastSuccess: 'Legal document acknowledgement was saved.',
    toastError: 'We could not save your acknowledgement.',
    modalTitle: 'Legal document update',
    closeLabel: 'Close legal document notice',
    eyebrow: 'Legal update',
    heading: 'Terms and Privacy Policy have been updated',
    description: 'Please review the latest documents before continuing. Public browsing while signed out is not blocked.',
    currentVersion: 'Current version',
    acknowledgedVersion: 'Acknowledged version',
    noAcknowledgement: 'None',
    latest: 'Latest',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    saving: 'Saving...',
    confirm: 'I have reviewed them',
  },
  ja: {
    toastSuccess: '法的文書の確認を記録しました。',
    toastError: '確認記録を保存できませんでした。',
    modalTitle: '法的文書の更新',
    closeLabel: '法的文書のお知らせを閉じる',
    eyebrow: '法的文書',
    heading: '利用規約とプライバシーポリシーが更新されました',
    description: '続行する前に最新の文書を確認してください。ログアウト中の公開閲覧はブロックされません。',
    currentVersion: '現在のバージョン',
    acknowledgedVersion: '確認済みバージョン',
    noAcknowledgement: 'なし',
    latest: '最新',
    terms: '利用規約',
    privacy: 'プライバシーポリシー',
    saving: '保存中...',
    confirm: '確認しました',
  },
} as const

function getCurrentVersion(legal: LegalPayload | null) {
  return legal?.currentVersion ?? legal?.termsVersion ?? legal?.privacyVersion ?? null
}

function getLocaleFromPathname(pathname: string | null): LegalLocale {
  const pathLocale = pathname?.split('/')[1]
  return pathLocale === 'ko' || pathLocale === 'ja' ? pathLocale : 'en'
}

export default function LegalVersionModal() {
  const { status } = useSession()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [legal, setLegal] = useState<LegalPayload | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [hidden, setHidden] = useState(false)

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
        if (!cancelled) setLegal(payload?.legal ?? null)
      })
      .catch(() => {
        if (!cancelled) setLegal(null)
      })

    return () => { cancelled = true }
  }, [status])

  const currentVersion = useMemo(() => getCurrentVersion(legal), [legal])
  const shouldShow = !hidden && status === 'authenticated' && (legal?.required === true || legal?.stale === true)
  const locale = useMemo(() => getLocaleFromPathname(pathname), [pathname])
  const copy = LEGAL_MODAL_COPY[locale]
  const legalPathPrefix = useMemo(() => {
    const pathLocale = pathname?.split('/')[1]
    return pathLocale && SUPPORTED_LEGAL_LOCALES.has(pathLocale) ? `/${pathLocale}` : ''
  }, [pathname])

  async function acknowledge() {
    setSubmitting(true)
    try {
      const response = await fetch('/api/legal/acknowledgements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: currentVersion }),
      })
      if (!response.ok) throw new Error('acknowledgement')
      showSuccess(copy.toastSuccess)
      setHidden(true)
    } catch {
      showError(copy.toastError)
    } finally {
      setSubmitting(false)
    }
  }

  if (!shouldShow) return null
  if (!mounted) return null

  return (
    <BaseModal open onClose={() => {}} title={copy.modalTitle} maxWidth="31rem" blur={false}>
      <section className="rounded-md border" style={{ background: '#1a1510', borderColor: 'rgba(200,144,10,0.24)', boxShadow: '0 1rem 2rem rgba(13,11,8,0.48)' }}>
        <header className="flex items-start justify-between gap-3 border-b" style={{ borderColor: 'rgba(200,144,10,0.14)', padding: '1rem' }}>
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex shrink-0 items-center justify-center rounded-sm border" style={{ width: '2rem', height: '2rem', borderColor: 'rgba(200,144,10,0.28)', color: 'var(--gold)' }}>
              <FileText size="1rem" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-mono uppercase" style={{ color: '#8a7a5a', fontSize: '0.6875rem' }}>{copy.eyebrow}</p>
              <h2 className="mt-1 font-serif" style={{ color: '#d6be7a', fontSize: '1.125rem', fontWeight: 700 }}>{copy.heading}</h2>
            </div>
          </div>
          <button type="button" onClick={() => setHidden(true)} className="rounded-sm border transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]" style={{ borderColor: 'rgba(200,144,10,0.18)', color: '#8a7a5a', padding: '0.375rem' }} aria-label={copy.closeLabel}>
            <X size="1rem" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-4" style={{ padding: '1rem' }}>
          <p style={{ color: '#9a8a6a', fontSize: '0.8125rem', lineHeight: 1.65 }}>{copy.description}</p>
          <dl className="grid gap-2 md:grid-cols-2">
            <div className="rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.12)', padding: '0.75rem' }}>
              <dt className="font-mono" style={{ color: '#7a6845', fontSize: '0.6875rem' }}>{copy.currentVersion}</dt>
              <dd className="mt-1 font-mono" style={{ color: '#c8a450', fontSize: '0.8125rem' }}>{currentVersion ?? copy.latest}</dd>
            </div>
            <div className="rounded-sm border" style={{ borderColor: 'rgba(200,144,10,0.12)', padding: '0.75rem' }}>
              <dt className="font-mono" style={{ color: '#7a6845', fontSize: '0.6875rem' }}>{copy.acknowledgedVersion}</dt>
              <dd className="mt-1 font-mono" style={{ color: '#9a8a6a', fontSize: '0.8125rem' }}>{legal?.acknowledgedVersion ?? copy.noAcknowledgement}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              <Link href={`${legalPathPrefix}/terms`} className="text-sm text-[var(--gold)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]">{copy.terms}</Link>
              <Link href={`${legalPathPrefix}/privacy`} className="text-sm text-[var(--gold)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]">{copy.privacy}</Link>
            </div>
            <button
              type="button"
              onClick={acknowledge}
              disabled={submitting}
              className="rounded-sm border transition-colors hover:bg-[rgba(200,144,10,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: 'rgba(200,144,10,0.36)', color: 'var(--gold)', padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}
            >
              {submitting ? copy.saving : copy.confirm}
            </button>
          </div>
        </div>
      </section>
    </BaseModal>
  )
}
