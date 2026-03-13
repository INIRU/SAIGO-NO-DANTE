import { Suspense } from 'react'
import { getSinners, getIdentities, getEGOs } from '@/lib/db/queries'
import RandomClient from './RandomClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '랜덤 편성',
  description: '랜덤으로 덱을 편성해보세요',
}

export const revalidate = 300

export default async function RandomPage() {
  const [sinners, identities, egos] = await Promise.all([
    getSinners(),
    getIdentities(),
    getEGOs(),
  ])

  return (
    <Suspense>
      <RandomClient sinners={sinners} identities={identities} egos={egos} />
    </Suspense>
  )
}
