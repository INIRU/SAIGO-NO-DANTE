import type { Metadata } from 'next'
import { getGuestCopy } from '@/features/account'
import GuestClient from './GuestClient'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  return { title: getGuestCopy(lang).title, robots: { index: false, follow: false } }
}

export default function GuestPage() {
  return <GuestClient />
}
