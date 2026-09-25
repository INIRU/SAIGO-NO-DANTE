'use client'

import { useEffect, useMemo, useState } from 'react'
import { LOGIN_CONSENT_KEY, consentMatches } from '@/lib/legal-consent'
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
    heading: '약관과 개인정보 처리방침이 바뀌었어요',
    description: '바뀐 내용을 확인한 뒤 계속 이용해 주세요.',
    terms: '이용약관',
    privacy: '개인정보 처리방침',
    saving: '저장 중...',
    confirm: '확인했어요',
    versionLabel: '버전',
    open: '열기',
  },
  en: {
    toastSuccess: 'Legal document acknowledgement was saved.',
    toastError: 'We could not save your acknowledgement.',
    modalTitle: 'Legal document update',
    closeLabel: 'Close legal document notice',
    heading: 'Terms and Privacy Policy have been updated',
    description: 'Please review what changed before you continue.',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    saving: 'Saving...',
    confirm: 'I’ve reviewed them',
    versionLabel: 'Version',
    open: 'Open',
  },
  ja: {
    toastSuccess: '法的文書の確認を記録しました。',
    toastError: '確認記録を保存できませんでした。',
    modalTitle: '法的文書の更新',
    closeLabel: '法的文書のお知らせを閉じる',
    heading: '利用規約とプライバシーポリシーが更新されました',
    description: '変更内容を確認してからご利用ください。',
    terms: '利用規約',
    privacy: 'プライバシーポリシー',
    saving: '保存中...',
    confirm: '確認しました',
    versionLabel: 'バージョン',
    open: '開く',
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
      .then(async payload => {
        const next = payload?.legal ?? null
        // Consent given on the login page (full text read, both boxes checked) is the acknowledgement: record it quietly.
        let agreed: unknown = null
        try { agreed = JSON.parse(sessionStorage.getItem(LOGIN_CONSENT_KEY) ?? 'null'); sessionStorage.removeItem(LOGIN_CONSENT_KEY) } catch { /* ask instead */ }
        if (next?.required && consentMatches(agreed, next)) {
          const saved = await fetch('/api/legal/acknowledgements', { method: 'POST' }).then(response => response.ok, () => false)
          if (!cancelled) setLegal(saved ? { ...next, required: false, stale: false } : next)
          return
        }
        if (!cancelled) setLegal(next)
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

  const documents = [{ href: `${legalPathPrefix}/terms`, label: copy.terms }, { href: `${legalPathPrefix}/privacy`, label: copy.privacy }]
  return (
    <BaseModal open onClose={() => {}} title={copy.modalTitle} maxWidth="26rem" blur={false}>
      <section className="relative rounded-xl border border-[rgba(200,144,10,0.22)] bg-[#17120c] p-6 shadow-[0_1.5rem_3rem_rgba(0,0,0,0.55)]">
        <button type="button" onClick={() => setHidden(true)} aria-label={copy.closeLabel}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-md text-[#8a7d69] transition-colors hover:bg-white/5 hover:text-[#e8dcc8] focus-visible:outline-2 focus-visible:outline-[var(--gold)]">
          <X size={16} aria-hidden="true" />
        </button>
        <h2 className="pr-8 text-[1.25rem] font-bold leading-snug text-[#f0e6d2]">{copy.heading}</h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-[#a89a84]">{copy.description}</p>
        {currentVersion && <p className="mt-1 text-[0.8125rem] text-[#7d7160]">{copy.versionLabel} {currentVersion}</p>}
        <ul className="mt-5 overflow-hidden rounded-lg border border-[#2e2417]">
          {documents.map(document => (
            <li key={document.href} className="border-t border-[#2e2417] first:border-t-0">
              <Link href={document.href} target="_blank"
                className="flex min-h-12 items-center gap-3 px-4 text-[0.9375rem] font-semibold text-[#e8dcc8] transition-colors hover:bg-[rgba(200,144,10,0.06)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--gold)]">
                <FileText size={16} aria-hidden="true" className="shrink-0 text-[var(--gold)]" />
                <span className="flex-1">{document.label}</span>
                <span className="text-[0.8125rem] font-medium text-[#8a7d69]">{copy.open}</span>
              </Link>
            </li>
          ))}
        </ul>
        <button type="button" onClick={acknowledge} disabled={submitting}
          className="mt-5 min-h-12 w-full rounded-lg bg-[var(--gold)] text-[1rem] font-bold text-[#0d0b08] transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-light)] disabled:cursor-not-allowed disabled:opacity-60">
          {submitting ? copy.saving : copy.confirm}
        </button>
      </section>
    </BaseModal>
  )
}
