'use client'

import { useEffect, useMemo, useState } from 'react'
import { LOGIN_CONSENT_KEY, consentMatches } from '@/lib/legal-consent'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import BaseModal from '@/components/ui/BaseModal'
import LegalConsent, { type LegalConsentState } from '@/components/legal/LegalConsent'
import type { LegalDoc } from '@/lib/data/legal'
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
  texts?: LegalDoc[]
}

type LegalLocale = 'ko' | 'en' | 'ja'

// Pages where the modal would get in the way: reading the documents themselves, withdrawing, or signing in.
const QUIET_PAGES = new Set(['terms', 'privacy', 'mypage', 'login'])

const LEGAL_MODAL_COPY = {
  ko: {
    toastSuccess: '동의가 기록되었습니다.',
    toastError: '동의 기록을 저장하지 못했습니다.',
    modalTitle: '법률 문서 업데이트',
    heading: '약관과 개인정보 처리방침이 바뀌었어요',
    description: '바뀐 전문을 끝까지 읽고 동의하면 계속 이용할 수 있어요.',
    versionLabel: '버전',
    saving: '저장 중...',
    confirm: '동의하고 계속하기',
    withdraw: '동의하지 않고 탈퇴하기',
    terms: '이용약관',
    privacy: '개인정보 처리방침',
    consent: { agreeTerms: '[필수] 이용약관 동의', agreePrivacy: '[필수] 개인정보 수집·이용 동의', readFull: '전문 보기', hideFull: '접기', readToAgree: '전문을 끝까지 읽으면 동의할 수 있습니다.' },
  },
  en: {
    toastSuccess: 'Your agreement was saved.',
    toastError: 'We could not save your agreement.',
    modalTitle: 'Legal document update',
    heading: 'Terms and Privacy Policy have been updated',
    description: 'Read each updated document to the end and agree to keep using the site.',
    versionLabel: 'Version',
    saving: 'Saving...',
    confirm: 'Agree and continue',
    withdraw: 'Decline and delete my account',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    consent: { agreeTerms: '[Required] I agree to the Terms of Service', agreePrivacy: '[Required] I agree to the Privacy Policy', readFull: 'Read full text', hideFull: 'Close', readToAgree: 'Scroll to the end of the text to agree.' },
  },
  ja: {
    toastSuccess: '同意を記録しました。',
    toastError: '同意を保存できませんでした。',
    modalTitle: '法的文書の更新',
    heading: '利用規約とプライバシーポリシーが更新されました',
    description: '更新された全文を最後まで読んで同意すると、引き続きご利用いただけます。',
    versionLabel: 'バージョン',
    saving: '保存中...',
    confirm: '同意して続ける',
    withdraw: '同意せずに退会する',
    terms: '利用規約',
    privacy: 'プライバシーポリシー',
    consent: { agreeTerms: '[必須] 利用規約に同意', agreePrivacy: '[必須] 個人情報の収集・利用に同意', readFull: '全文を読む', hideFull: '閉じる', readToAgree: '全文を最後まで読むと同意できます。' },
  },
} as const

function getCurrentVersion(legal: LegalPayload | null) {
  return legal?.currentVersion ?? legal?.termsVersion ?? legal?.privacyVersion ?? null
}

function localeOf(pathname: string | null): LegalLocale {
  const pathLocale = pathname?.split('/')[1]
  return pathLocale === 'ko' || pathLocale === 'ja' ? pathLocale : pathLocale === 'en' ? 'en' : 'ko'
}

export default function LegalVersionModal() {
  const { status } = useSession()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [legal, setLegal] = useState<LegalPayload | null>(null)
  const [texts, setTexts] = useState<LegalDoc[]>([])
  const [agreed, setAgreed] = useState<LegalConsentState>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return

    let cancelled = false
    fetch(`/api/legal/status?lang=${localeOf(window.location.pathname)}`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() as Promise<StatusPayload> : null)
      .then(async payload => {
        const next = payload?.legal ?? null
        // Consent given on the login page (full text read, both boxes checked) is the acknowledgement: record it quietly.
        let loginConsent: unknown = null
        try { loginConsent = JSON.parse(sessionStorage.getItem(LOGIN_CONSENT_KEY) ?? 'null'); sessionStorage.removeItem(LOGIN_CONSENT_KEY) } catch { /* ask instead */ }
        if (next?.required && consentMatches(loginConsent, next)) {
          const saved = await fetch('/api/legal/acknowledgements', { method: 'POST' }).then(response => response.ok, () => false)
          if (!cancelled) setLegal(saved ? { ...next, required: false, stale: false } : next)
          return
        }
        if (!cancelled) { setLegal(next); setTexts(payload?.texts ?? []) }
      })
      .catch(() => {
        if (!cancelled) setLegal(null)
      })

    return () => { cancelled = true }
  }, [status])

  const currentVersion = useMemo(() => getCurrentVersion(legal), [legal])
  const locale = localeOf(pathname)
  const copy = LEGAL_MODAL_COPY[locale]
  const quiet = QUIET_PAGES.has(pathname?.split('/')[2] ?? '')
  const shouldShow = !done && !quiet && status === 'authenticated' && (legal?.required === true || legal?.stale === true)
  // Without the full text (it failed to load), fall back to links so nobody is locked out.
  const allAgreed = texts.length === 0 || texts.every(doc => agreed[doc.type])

  async function acknowledge() {
    if (!allAgreed) return
    setSubmitting(true)
    try {
      const response = await fetch('/api/legal/acknowledgements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: currentVersion }),
      })
      if (!response.ok) throw new Error('acknowledgement')
      showSuccess(copy.toastSuccess)
      setDone(true)
    } catch {
      showError(copy.toastError)
    } finally {
      setSubmitting(false)
    }
  }

  if (!shouldShow || !mounted) return null

  return (
    <BaseModal open onClose={() => {}} title={copy.modalTitle} maxWidth="28rem" blur={false} initialFocus="dialog">
      <section className="rounded-xl border border-[rgba(200,144,10,0.22)] bg-[#17120c] p-6 shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)]">
        <h2 className="text-[1.25rem] font-bold leading-snug text-[#f0e6d2]">{copy.heading}</h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-[#a89a84]">{copy.description}</p>
        {currentVersion && <p className="mt-1 text-[0.8125rem] text-[#7d7160]">{copy.versionLabel} {currentVersion}</p>}
        {texts.length > 0
          ? <LegalConsent docs={texts} agreed={agreed} onChange={setAgreed} labels={copy.consent} />
          : <p className="mt-4 flex gap-4 text-[0.9375rem] font-semibold">
              <Link href={`/${locale}/terms`} target="_blank" className="text-[var(--gold-light)] underline underline-offset-4">{copy.terms}</Link>
              <Link href={`/${locale}/privacy`} target="_blank" className="text-[var(--gold-light)] underline underline-offset-4">{copy.privacy}</Link>
            </p>}
        <button type="button" onClick={acknowledge} disabled={submitting || !allAgreed}
          className="mt-5 min-h-12 w-full rounded-lg bg-[var(--gold)] text-[1rem] font-bold text-[#0d0b08] transition-[filter,opacity] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100">
          {submitting ? copy.saving : copy.confirm}
        </button>
        <Link href={`/${locale}/mypage?tab=profile&withdraw=1`}
          className="mt-3 flex min-h-10 items-center justify-center rounded-lg text-[0.8125rem] font-medium text-[#8a7d69] transition-colors hover:text-[#e8a08a] focus-visible:outline-2 focus-visible:outline-[var(--gold)]">
          {copy.withdraw}
        </Link>
      </section>
    </BaseModal>
  )
}
