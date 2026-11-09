import type { Metadata } from 'next'
import { cacheLife, cacheTag } from 'next/cache'
import { pageMetadata } from '@/lib/seo/metadata'
import { CACHE_TAGS } from '@/lib/constants/cache-tags'
import { STORY_MAP_PAGE_BASE, getStoryIndex } from '@/lib/story-map'
import StorySelect from './_components/StorySelect'

type Lang = 'ko' | 'en' | 'ja'
const langOf = (l: string): Lang => l === 'en' || l === 'ja' ? l : 'ko'

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const lang = langOf((await params).lang)
  const copy = {
    ko: { title: '림버스 스토리 맵 — 장별 스테이지와 등장 적', description: '림버스 컴퍼니 본편·막간 스토리의 스테이지 지도와 스테이지마다 등장하는 적.' },
    en: { title: 'Limbus Company Story Map — Stages and Enemies by Chapter', description: 'The stage maps of every Limbus Company chapter and intervallo, with the enemies of each stage.' },
    ja: { title: 'リンバス ストーリーマップ — 章ごとのステージと敵', description: 'リンバスカンパニー本編・幕間のステージマップと、ステージごとに登場する敵。' },
  }[lang]
  return pageMetadata({ lang, path: '/story', ...copy })
}

export default async function StoryIndexPage({ params }: { params: Promise<{ lang: string }> }) {
  'use cache'
  cacheLife('max')
  cacheTag(CACHE_TAGS.gameData)
  const { lang } = await params
  return <StorySelect lang={langOf(lang)} index={await getStoryIndex()} base={STORY_MAP_PAGE_BASE} />
}
