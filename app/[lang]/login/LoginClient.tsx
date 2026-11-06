'use client'

import DanteLogo from '@/components/brand/DanteLogo'
import HeroWordmark from '@/components/home/HeroWordmark'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import { safeLoginReturn } from '@/lib/auth-return'
import { signIn, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { getIdentityImageUrl } from '@/lib/utils/images'
import type { LegalDoc } from '@/lib/data/legal'
import { LOGIN_CONSENT_KEY } from '@/lib/legal-consent'
import LegalConsent, { type LegalConsentState } from '@/features/account/components/LegalConsent'
import { LEGAL_KEY_POINTS } from '@/lib/legal-summary'
import './login.css'

const FALLBACK_ART = getIdentityImageUrl('don-quixote', 'The Manager of La Manchaland', '10310_gacksung')
const WALL_ROWS = 6
type ErrorKey = 'errorConnect' | 'errorCallback' | 'errorDenied' | 'errorRequired'
// next-auth sends OAuth failures back to the sign-in page as ?error=<code>.
function errorKey(code: string | null): ErrorKey | null {
  if (!code) return null
  if (['OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount', 'Callback', 'OAuthAccountNotLinked'].includes(code)) return 'errorCallback'
  if (code === 'AccessDenied') return 'errorDenied'
  if (code === 'SessionRequired') return 'errorRequired'
  return 'errorConnect'
}

export default function LoginClient({ docs, art }: { docs: LegalDoc[]; art: string[] }) {
  useHtmlFlag('with-login-page')
  const { status } = useSession()
  const locale = useLocale()
  const t = useTranslations('loginPage')
  const siteName = useTranslations('site')('name')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ErrorKey | null>(null)
  const [agreed, setAgreed] = useState<LegalConsentState>({})
  const allAgreed = docs.length > 0 && docs.every(doc => agreed[doc.type])
  const returnUrl = () => safeLoginReturn(new URLSearchParams(window.location.search).get('callbackUrl'), locale)
  useEffect(() => { setError(errorKey(new URLSearchParams(window.location.search).get('error'))) }, [])
  useEffect(() => { if (status === 'authenticated') window.location.replace(safeLoginReturn(new URLSearchParams(window.location.search).get('callbackUrl'), locale)) }, [status, locale])
  async function login() {
    if (pending || !allAgreed) return
    // Carried across the OAuth redirect: the legal modal records it as the acknowledgement once signed in.
    try { sessionStorage.setItem(LOGIN_CONSENT_KEY, JSON.stringify(Object.fromEntries(docs.map(doc => [doc.type, doc.version ?? null])))) } catch { /* the legal modal asks instead */ }
    setPending(true); setError(null)
    try { await signIn('google', { callbackUrl: returnUrl() }) }
    catch { setError('errorConnect'); setPending(false) }
  }
  return (
    <div className="login-page">
      {/* Tilted wall of identity illustrations; rows drift left and right in turn. Each row repeats its tiles once so the loop is seamless. */}
      <div className="login-wall" aria-hidden="true">
        {Array.from({ length: WALL_ROWS }, (_, row) => {
          const pool = art.length ? art : [FALLBACK_ART]
          const tiles = Array.from({ length: 6 }, (_, i) => pool[(row * 5 + i * 3) % pool.length])
          return <div key={row} className="login-wall-row" data-reverse={row % 2 === 1 || undefined}>
            {[...tiles, ...tiles].map((src, i) => <div key={i} className="login-wall-tile">
              <Image src={src} alt="" fill sizes="22rem" priority={row < 2 && i < 4} />
            </div>)}
          </div>
        })}
      </div>
      <Link href="/" className="login-back"><ArrowLeft size={16} aria-hidden="true" />{t('back')}</Link>
      <main className="login-main">
        <div className="login-title">
          <DanteLogo size={72} />
          <HeroWordmark as="p" className="login-wordmark" />
          <p className="login-site">{siteName}</p>
        </div>
        <section className="login-panel" aria-labelledby="login-title">
          <h1 id="login-title" className="sr-only">{t('title')}</h1>
          <LegalConsent docs={docs} agreed={agreed} onChange={setAgreed}
            summary={LEGAL_KEY_POINTS[locale === 'en' || locale === 'ja' ? locale : 'ko']}
            labels={{ agreeAll: t('agreeAll'), agreeTerms: t('agreeTerms'), agreePrivacy: t('agreePrivacy'), readFull: t('readFull'), hideFull: t('hideFull') }} />
          <button type="button" className="login-google" onClick={login} disabled={pending || !allAgreed || status !== 'unauthenticated'} aria-busy={pending}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.174 0 7.548 0 9s.348 2.826.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            <span>{pending ? t('busy') : t('google')}</span>
          </button>
          {error && <p role="alert" className="login-error">{t(error)}</p>}
        </section>
      </main>
    </div>
  )
}
