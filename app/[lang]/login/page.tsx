'use client'

import DanteLogo from '@/components/brand/DanteLogo'
import { useHtmlFlag } from '@/hooks/useHtmlFlag'
import { safeLoginReturn } from '@/lib/auth-return'
import { signIn, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { getIdentityImageUrl } from '@/lib/utils/images'
import './login.css'

const art = getIdentityImageUrl('don-quixote', 'The Manager of La Manchaland', '10310_gacksung')
type ErrorKey = 'errorConnect' | 'errorCallback' | 'errorDenied' | 'errorRequired'
// next-auth sends OAuth failures back to the sign-in page as ?error=<code>.
function errorKey(code: string | null): ErrorKey | null {
  if (!code) return null
  if (['OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount', 'Callback', 'OAuthAccountNotLinked'].includes(code)) return 'errorCallback'
  if (code === 'AccessDenied') return 'errorDenied'
  if (code === 'SessionRequired') return 'errorRequired'
  return 'errorConnect'
}

export default function LoginPage() {
  useHtmlFlag('with-login-page')
  const { status } = useSession()
  const locale = useLocale()
  const t = useTranslations('loginPage')
  const siteName = useTranslations('site')('name')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ErrorKey | null>(null)
  const returnUrl = () => safeLoginReturn(new URLSearchParams(window.location.search).get('callbackUrl'), locale)
  useEffect(() => { setError(errorKey(new URLSearchParams(window.location.search).get('error'))) }, [])
  useEffect(() => { if (status === 'authenticated') window.location.replace(safeLoginReturn(new URLSearchParams(window.location.search).get('callbackUrl'), locale)) }, [status, locale])
  async function login() {
    if (pending) return
    setPending(true); setError(null)
    try { await signIn('google', { callbackUrl: returnUrl() }) }
    catch { setError('errorConnect'); setPending(false) }
  }
  const policy = (href: string) => (chunks: React.ReactNode) => <Link href={href} target="_blank" rel="noopener noreferrer">{chunks}</Link>
  return (
    <div className="login-page">
      <div className="login-art" aria-hidden="true"><Image src={art} alt="" fill priority sizes="(max-width: 760px) 100vw, 180vh" /></div>
      <main className="login-main">
        <Link href="/" className="login-back"><ArrowLeft size={16} aria-hidden="true" />{t('back')}</Link>
        <section className="login-card" aria-labelledby="login-title">
          <Link href="/" className="login-brand"><DanteLogo size={44} />{siteName}</Link>
          <h1 id="login-title">{t('title')}</h1>
          <p className="login-lead">{t('lead')}</p>
          <button type="button" className="login-google" onClick={login} disabled={pending || status !== 'unauthenticated'} aria-busy={pending}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.174 0 7.548 0 9s.348 2.826.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {pending ? t('busy') : t('google')}
          </button>
          {error && <p role="alert" className="login-error">{t(error)}</p>}
          <p className="login-consent">{t.rich('consent', { terms: policy('/terms'), privacy: policy('/privacy') })}</p>
        </section>
      </main>
    </div>
  )
}
