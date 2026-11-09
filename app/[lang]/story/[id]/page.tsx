import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cacheLife, cacheTag } from 'next/cache'
import { pageMetadata } from '@/lib/seo/metadata'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { STORY_MAP_PAGE_BASE, getStoryIndex, getStorySubchapter, pickText } from '@/lib/story-map'
import { Suspense } from 'react'
import StoryClient, { StoryShell } from '../_components/StoryClient'
import { chapterParts, isExtraPart, storyOrder } from '../_components/story-order'

type Lang = 'ko' | 'en' | 'ja'
const langOf = (l: string): Lang => l === 'en' || l === 'ja' ? l : 'ko'

export async function generateStaticParams() {
  return (await getStoryIndex()).map(e => ({ id: String(e.id) }))
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang: raw, id } = await params
  const lang = langOf(raw)
  const sub = await getStorySubchapter(Number(id))
  if (!sub) return { robots: { index: false } }
  const name = `${pickText(sub.title, lang)}`
  const copy = {
    ko: { title: `림버스 ${sub.number}장 ${name} 스토리 맵 — 스테이지별 등장 적`, description: `림버스 컴퍼니 ${sub.number}장 「${name}」의 스테이지 지도와 스테이지마다 등장하는 적, 웨이브, 레벨.` },
    en: { title: `Limbus Company Chapter ${sub.number} ${name} Story Map — Enemies by Stage`, description: `The stage map of Limbus Company Chapter ${sub.number} "${name}" with each stage's enemies, waves and levels.` },
    ja: { title: `リンバス ${sub.number}章 ${name} ストーリーマップ — ステージ別の敵`, description: `リンバスカンパニー ${sub.number}章「${name}」のステージマップと、ステージごとの敵・ウェーブ・レベル。` },
  }[lang]
  return pageMetadata({ lang, path: `/story/${id}`, ...copy })
}

export default async function StoryPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData)
  const { lang, id } = await params
  const [sub, index] = await Promise.all([getStorySubchapter(Number(id)), getStoryIndex()])
  if (!sub) notFound()
  // StoryClient reads the address (?stage=, nuqs): on this cached page it is drawn in the browser, behind StoryShell
  return (
    <Suspense fallback={<StoryShell lang={langOf(lang)} base={STORY_MAP_PAGE_BASE} />}>
      <StoryClient lang={langOf(lang)} sub={sub} base={STORY_MAP_PAGE_BASE} order={storyOrder(index).filter(e => !isExtraPart(index, e)).map(e => e.id)}
        parts={chapterParts(index, sub.id).map(e => e.id)} difficulty={chapterParts(index, sub.id).length > 1} />
    </Suspense>
  )
}
