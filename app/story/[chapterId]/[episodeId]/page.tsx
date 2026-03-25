import { readFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import StoryReader from '@/components/story/StoryReader'
import type { EpisodeData, PrologueIndex } from '@/lib/story/types'

interface Props {
  params: Promise<{ chapterId: string; episodeId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chapterId, episodeId } = await params
  return {
    title: `${chapterId} - ${episodeId}`,
    description: `림버스 컴퍼니 스토리 ${episodeId}`,
  }
}

export default async function EpisodePage({ params }: Props) {
  const { chapterId, episodeId } = await params

  const dataDir = path.join(process.cwd(), 'public', 'data', 'story', chapterId)
  const filePath = path.join(dataDir, `${episodeId}.json`)
  const indexPath = path.join(dataDir, 'index.json')

  if (!existsSync(filePath)) notFound()

  const data: EpisodeData = JSON.parse(await readFile(filePath, 'utf-8'))

  // 에피소드 순서에서 이전/다음 찾기
  let prevEpisode: string | null = null
  let nextEpisode: string | null = null

  if (existsSync(indexPath)) {
    const { episodes } = JSON.parse(await readFile(indexPath, 'utf-8')) as PrologueIndex
    const order = episodes.map((e) => e.storyId)
    const idx = order.indexOf(episodeId)
    if (idx > 0) prevEpisode = order[idx - 1]
    if (idx < order.length - 1) nextEpisode = order[idx + 1]
  }

  return (
    <StoryReader
      data={data}
      prevEpisode={prevEpisode}
      nextEpisode={nextEpisode}
      chapterSlug={chapterId}
    />
  )
}
