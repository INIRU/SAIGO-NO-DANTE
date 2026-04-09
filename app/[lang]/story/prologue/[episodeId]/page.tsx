import { readFile } from 'fs/promises'
import path from 'path'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cacheLife } from 'next/cache'
import StoryReader from '@/components/story/StoryReader'
import type { EpisodeData } from '@/lib/story/types'

const EPISODE_ORDER = [
  'S001B',
  'S001A',
  'S002B',
  'S003B',
  'S003A',
  'S004B',
  'S004A',
]

interface Props {
  params: Promise<{ episodeId: string }>
}

export function generateStaticParams() {
  return EPISODE_ORDER.map((id) => ({ episodeId: id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { episodeId } = await params
  const idx = EPISODE_ORDER.indexOf(episodeId)
  return {
    title: `프롤로그 ${idx >= 0 ? idx + 1 : ''}절 — ${episodeId}`,
    description: `림버스 컴퍼니 프롤로그 스토리 ${episodeId}`,
  }
}

export default async function EpisodePage({ params }: Props) {
  'use cache'
  cacheLife('page-1h')
  const { episodeId } = await params

  if (!EPISODE_ORDER.includes(episodeId)) notFound()

  const filePath = path.join(
    process.cwd(),
    'public',
    'data',
    'story',
    'prologue',
    `${episodeId}.json`,
  )

  let data: EpisodeData
  try {
    data = JSON.parse(await readFile(filePath, 'utf-8'))
  } catch {
    notFound()
  }

  const idx = EPISODE_ORDER.indexOf(episodeId)
  const prevEpisode = idx > 0 ? EPISODE_ORDER[idx - 1] : null
  const nextEpisode =
    idx < EPISODE_ORDER.length - 1 ? EPISODE_ORDER[idx + 1] : null

  return (
    <StoryReader
      data={data}
      prevEpisode={prevEpisode}
      nextEpisode={nextEpisode}
    />
  )
}
