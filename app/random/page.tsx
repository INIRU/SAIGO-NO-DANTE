import { Suspense } from 'react'
import { cacheLife } from 'next/cache'
import { getSinners, getIdentities, getEGOs } from '@/lib/db/queries'
import RandomStatic from './RandomStatic'
import RandomInteractive from './RandomInteractive'
import type { Metadata } from 'next'
import { getServerLang, serverT } from '@/lib/i18n/server'
import type { TranslationKey } from '@/lib/i18n/translations'

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getServerLang()
  const title = serverT('random.title' as TranslationKey, lang)
  const description = serverT('random.description' as TranslationKey, lang)
  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  }
}

export default async function RandomPage() {
  'use cache'
  cacheLife('page-5m')
  const [sinners, identities, egos] = await Promise.all([
    getSinners(),
    getIdentities(),
    getEGOs(),
  ])

  return (
    <div style={{ paddingTop: '64px' }}>
      <div className="mx-auto max-w-[80rem] px-[1rem] py-[2rem] pb-[6rem] md:pb-[2rem]">
        {/*
          RandomStatic is a pure Server Component.
          The header <h1> and ghost card grid are painted in the initial HTML —
          the browser renders them before any JS executes, making them the LCP element.
        */}
        {/* SSR skeleton — hidden once interactive client mounts */}
        <div id="random-static-skeleton">
          <RandomStatic sinners={sinners} />
        </div>

        {/*
          RandomInteractive uses useSearchParams which requires a Suspense boundary.
          Suspense fallback is null: the static skeleton above is already visible,
          so there is no layout shift or blank flash during hydration.
          Once hydrated, RandomClient hides the skeleton and renders the interactive UI.
        */}
        <Suspense fallback={null}>
          <RandomInteractive sinners={sinners} identities={identities} egos={egos} />
        </Suspense>
      </div>
    </div>
  )
}
