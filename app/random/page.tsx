import { getSinners, getIdentities, getEGOs } from '@/lib/db/queries'
import RandomClient from './RandomClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '랜덤 편성',
  description: '슬롯머신으로 랜덤 덱 편성',
}

export const revalidate = 300

export default async function RandomPage() {
  const [sinners, identities, egos] = await Promise.all([
    getSinners(),
    getIdentities(),
    getEGOs(),
  ])

  return <RandomClient sinners={sinners} identities={identities} egos={egos} />
}
