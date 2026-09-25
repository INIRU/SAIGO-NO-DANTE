import { cacheLife } from 'next/cache'
import { getLegalDoc, type LegalDoc } from '@/lib/data/legal'
import LoginClient from './LoginClient'

async function loginDocs(lang: string): Promise<LegalDoc[]> {
  'use cache'
  cacheLife('page-1h')
  const doc = async (type: LegalDoc['type']) => (await getLegalDoc(type, lang)) ?? (lang === 'ko' ? null : getLegalDoc(type, 'ko'))
  return (await Promise.all([doc('terms'), doc('privacy')])).filter((item): item is LegalDoc => item !== null)
}

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return <LoginClient docs={await loginDocs(lang)} />
}
