'use client'

import { signIn, useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { Link, useRouter } from '@/lib/i18n/navigation'
import { useLocale } from 'next-intl'
import { getIdentityImageUrl, getSinnerProfileUrl } from '@/lib/utils/images'
import './login.css'

const copy = {
  ko: { title: '로그인', intro: '나만의 덱과 거울 던전 플랜을 저장하고 공유하세요.', start: 'Google 계정으로 간편하게 시작하세요.', google: 'Google로 계속하기', busy: '연결 중…', home: '홈으로 돌아가기', browse: '로그인 없이 둘러보기', consent: '계속하면 다음 정책에 동의합니다.', terms: '이용약관', privacy: '개인정보 처리방침', deck: '덱 편성', plan: '거울 던전 플랜', error: '로그인에 연결하지 못했습니다. 다시 시도해 주세요.' },
  en: { title: 'Sign in', intro: 'Save and share your decks and Mirror Dungeon plans.', start: 'Get started with your Google account.', google: 'Continue with Google', busy: 'Connecting…', home: 'Back to home', browse: 'Browse without signing in', consent: 'By continuing, you agree to these policies.', terms: 'Terms of service', privacy: 'Privacy policy', deck: 'Decks', plan: 'Mirror Dungeon plans', error: 'Unable to connect. Please try again.' },
  ja: { title: 'ログイン', intro: '自分のデッキと鏡ダンジョンのプランを保存・共有しましょう。', start: 'Googleアカウントで簡単に始められます。', google: 'Googleで続ける', busy: '接続中…', home: 'ホームに戻る', browse: 'ログインせずに閲覧', consent: '続行すると、次の規約に同意したものとみなされます。', terms: '利用規約', privacy: 'プライバシーポリシー', deck: 'デッキ編成', plan: '鏡ダンジョンプラン', error: '接続できませんでした。もう一度お試しください。' },
}
const portraits = ['yi-sang', 'ryoshu', 'hong-lu', 'faust', 'sinclair', 'heathcliff']
const planIllustration = getIdentityImageUrl('don-quixote', 'The Manager of La Manchaland', '10310_gacksung')

export default function LoginPage() {
  const { status } = useSession()
  const router = useRouter()
  const locale = useLocale()
  const t = copy[locale as keyof typeof copy] ?? copy.ko
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => { if (status === 'authenticated') router.replace('/') }, [status, router])
  async function login() {
    if (pending) return
    setPending(true); setFailed(false)
    try { await signIn('google', { callbackUrl: `/${locale}` }) }
    catch { setFailed(true); setPending(false) }
  }
  return (
    <div className="login-page">
      <header className="login-header">
        <Link href="/" className="login-brand"><Image src="/images/logo.webp" alt="" width={30} height={42} unoptimized />{locale === 'ko' ? '최애의 관리자' : 'SAIGO NO DANTE'}</Link>
        <Link href="/" className="login-home"><ArrowLeft size={16} />{t.home}</Link>
      </header>
      <div className="login-content">
        <section className="login-intro" aria-labelledby="login-title">
          <p className="login-eyebrow">ACCOUNT</p>
          <h1 id="login-title">{t.title}</h1>
          <p className="login-description">{t.intro}</p>
          <div className="login-previews" aria-hidden="true">
            <div className="login-preview"><div className="login-portraits">{portraits.map(id => <Image key={id} src={getSinnerProfileUrl(id)} alt="" width={90} height={110} unoptimized />)}</div><span>{t.deck}</span></div>
            <div className="login-preview"><div className="login-illustration"><Image src={planIllustration} alt="" fill sizes="260px" /></div><span>{t.plan}</span></div>
          </div>
        </section>
        <section className="login-panel" aria-labelledby="login-panel-title">
          <h2 id="login-panel-title">{t.title}</h2>
          <p>{t.start}</p>
          <button type="button" className="login-google-btn" onClick={login} disabled={pending || status !== 'unauthenticated'} aria-busy={pending}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.174 0 7.548 0 9s.348 2.826.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            {pending ? t.busy : t.google}
          </button>
          {failed && <p role="alert" className="login-error">{t.error}</p>}
          <div className="login-consent"><p>{t.consent}</p><Link href="/terms" target="_blank" rel="noopener noreferrer">{t.terms}</Link><span> · </span><Link href="/privacy" target="_blank" rel="noopener noreferrer">{t.privacy}</Link></div>
          <Link href="/" className="login-browse">{t.browse}</Link>
        </section>
      </div>
      <footer className="login-footer"><Link href="/terms">{t.terms}</Link><span>·</span><Link href="/privacy">{t.privacy}</Link></footer>
    </div>
  )
}
