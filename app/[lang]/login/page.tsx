import { cacheLife, cacheTag } from 'next/cache'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { localeAlternates } from '@/lib/seo/metadata'
import { getLegalDoc, type LegalDoc } from '@/lib/data/legal'
import { getLatestIdentities } from '@/lib/db/queries'
import { getIdentityProfileUrl } from '@/lib/utils/images'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import LoginClient from './LoginClient'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const t = await getTranslations({ locale: lang, namespace: 'loginPage' })
  // Not indexed (robots.txt lets crawlers in, so the page says so itself); links on it may still be followed.
  return { title: t('title'), description: t('lead'), alternates: localeAlternates(lang, '/login'), robots: { index: false, follow: true } }
}

async function loginDocs(lang: string): Promise<LegalDoc[]> {
  'use cache'
  cacheLife('page-1h')
  const doc = async (type: LegalDoc['type']) => (await getLegalDoc(type, lang)) ?? (lang === 'ko' ? null : getLegalDoc(type, 'ko'))
  return (await Promise.all([doc('terms'), doc('privacy')])).filter((item): item is LegalDoc => item !== null)
}

/** Full illustrations of the newest identities for the moving wall behind the sign-in card. */
async function wallArt(): Promise<string[]> {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData, CACHE_TAGS.identities)
  return (await getLatestIdentities(18)).map(identity => getIdentityProfileUrl(identity)).filter(Boolean)
}

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [docs, art] = await Promise.all([loginDocs(lang), wallArt()])
  return <LoginClient docs={docs} art={art} />
}
