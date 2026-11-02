'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowUpRight, Layers3 } from 'lucide-react'
import { Link } from '@/lib/i18n/navigation'
import ForYou, { OwnedLink } from './ForYou'
import { PeriodTabs, RecentHistory } from './shelf-parts'
import BoardCard, { RankPlate } from '@/components/board/BoardCard'
import { RankNumeral } from '@/components/board/FormationRow'
import { RiseValue, RisingCount, useRising } from '@/components/board/rise'
import { IdentityCards, Rail, SectionHead, TextAction, UpdatedRows, baseOf, useBoardData, type BoardData, type Period } from '@/components/board/shared'
import { BoardShelfSkeleton, RisingShelfSkeleton } from '@/components/board/BoardShelfSkeleton'
import type { RowPost } from '@/components/board/parts'

export type InitialShelf = BoardData

/**
 * The board's first screen. Every shelf is a swipe rail of equal-height cards on a phone and a grid on a wide screen:
 * new posts, the frequently visited ones (with the period tabs), what is rising, the personal shelf, the identities,
 * and the recently edited rows.
 */
export default function DiscoveryShelf({ kind, onBrowse, initialData }: {
  kind: 'deck' | 'planner'
  onBrowse: () => void
  /** The server-rendered "this week" shelves: shown at once (and in the HTML) until SWR revalidates. */
  initialData?: InitialShelf
}) {
  const t = useTranslations('discoveryShelf')
  const lang = useLocale()
  const label = (ko: string, ja: string, en: string) => (lang === 'ko' ? ko : lang === 'ja' ? ja : en)
  const plural = kind === 'deck' ? 'Decks' : 'Plans'
  const [days, setDays] = useState<Period>('week')
  // A period tab changes the key: the shelves stay as they are until the new period arrives.
  const { data, error, mutate } = useBoardData(kind, days, initialData)
  const { feed: rising, loading: risingLoading } = useRising(kind)
  const base = baseOf(kind)

  if (error && !data) {
    return (
      <div data-discovery-shelf className="px-4 pb-16 md:px-6">
        <button onClick={() => mutate()} role="alert" className="mx-auto flex min-h-11 items-center px-1 text-[1rem] font-semibold text-[var(--gold-light)]">
          {label('목록을 불러오지 못했습니다. 다시 시도', '再試行', 'Could not load. Retry')}
        </button>
      </div>
    )
  }
  if (!data) return <div data-discovery-shelf><BoardShelfSkeleton /></div>

  const hasPosts = [data.recent, data.updated, data.popular].some(posts => posts.length > 0)
  if (!hasPosts && data.identities.length === 0) {
    const noun = kind === 'deck' ? label('덱', 'デッキ', 'decks') : label('플랜', 'プラン', 'plans')
    return (
      <div data-discovery-shelf className="px-4 pb-16 md:px-6">
        <section data-discovery-empty className="relative mx-auto flex min-h-[38dvh] max-w-7xl flex-col items-center justify-center gap-4 px-5 py-12 text-center">
          <Layers3 size={44} strokeWidth={1} className="mb-2 text-[var(--gold-dim)] opacity-60" />
          <h2 className="font-[family-name:var(--font-body)] text-xl font-semibold text-[var(--text-primary)]">
            {label(`첫 ${noun}을 남겨주세요`, `最初の${noun}を投稿しましょう`, `Share the first ${kind === 'deck' ? 'deck' : 'plan'}`)}
          </h2>
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            {label('나만의 편성과 공략을 다른 관리자들과 나눠보세요.', '編成と攻略を他の管理人と共有しましょう。', 'Share your lineup and strategy with other managers.')}
          </p>
          <Link href={kind === 'deck' ? '/decks/new' : '/planner'} className="mt-2 inline-flex min-h-11 items-center gap-3 rounded-md bg-[var(--gold)]/10 px-5 text-sm font-medium text-[var(--gold)] transition-colors hover:bg-[var(--gold)]/20">
            {label(`${noun} 만들기`, `${noun}を作成`, `Create ${kind === 'deck' ? 'deck' : 'plan'}`)}
            <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
    )
  }

  const risers = (rising?.posts ?? []).slice(0, 3)
  const risingIdentities = rising?.identities ?? []
  const showRising = risers.length + risingIdentities.length >= 2

  return (
    <div data-discovery-shelf className="pb-16">
      <div className="mx-auto max-w-7xl space-y-8 px-4 md:space-y-10 md:px-6">
        <div className="[&_a]:mt-0"><OwnedLink kind={kind} base={base} /></div>

        {data.recent.length > 0 && (
          <section data-shelf="recent" aria-labelledby="shelf-recent">
            <SectionHead id="shelf-recent" title={t(`recent${plural}`)} action={<TextAction onClick={onBrowse}>{t('viewAll')}</TextAction>} />
            <Rail>{data.recent.slice(0, 3).map(post => <BoardCard key={post.id} kind={kind} post={post as RowPost} />)}</Rail>
          </section>
        )}

        {/* The head and its period tabs stay even when this period has no posts. */}
        <section data-shelf="popular" aria-labelledby="shelf-popular">
          <SectionHead id="shelf-popular" title={t(`popular${plural}`)}>
            <div className="order-last w-full md:order-none md:w-auto"><PeriodTabs days={days} onChange={setDays} /></div>
          </SectionHead>
          {data.popular.length > 0 && (
            <Rail>{data.popular.slice(0, 6).map((post, index) => <BoardCard key={post.id} kind={kind} post={post as RowPost} lead={<RankPlate rank={index + 1} />} />)}</Rail>
          )}
        </section>

        {risingLoading && <RisingShelfSkeleton />}

        {showRising && (
          <section data-shelf="rising" aria-labelledby="shelf-rising" className="space-y-5">
            <SectionHead id="shelf-rising" title={t('rising')} />
            {risers.length > 0 && <Rail>{risers.map(({ post, rise }) => <BoardCard key={post.id} kind={kind} post={post as RowPost} lead={<RiseValue rise={rise} />} />)}</Rail>}
            {risingIdentities.length > 0 && <IdentityCards kind={kind} items={risingIdentities.slice(0, 9).map(item => ({ identity: item.identity, trailing: <RisingCount count={item.count} /> }))} />}
          </section>
        )}

        <ForYou kind={kind} personal />

        {data.identities.length > 0 && (
          <section data-shelf="identities" aria-labelledby="shelf-identities">
            <SectionHead id="shelf-identities" title={t('popularIdentities')} />
            <IdentityCards kind={kind} items={data.identities.slice(0, 9).map((identity, index) => ({ identity, trailing: <RankNumeral rank={index + 1} /> }))} />
          </section>
        )}

        {data.updated.length > 0 && (
          <section data-shelf="updated" aria-labelledby="shelf-updated">
            <SectionHead id="shelf-updated" title={t(`updated${plural}`)} />
            <UpdatedRows kind={kind} posts={data.updated as RowPost[]} />
          </section>
        )}

        <RecentHistory kind={kind} base={base} />
      </div>
    </div>
  )
}
