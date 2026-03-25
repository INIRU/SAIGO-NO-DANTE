import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import type { PrologueIndex } from '@/lib/story/types'
import EpisodeList from '@/components/story/EpisodeList'

const CHAPTER_META: Record<string, { number: string; title: string; desc: string }> = {
  prologue: { number: '0', title: '어두운 숲', desc: '나는 검은 숲의 한 가운데에 있었다.\n이유도, 과거도 전부 잊은 채로.' },
  'canto-1': { number: '1', title: '속하지 못하는', desc: '로보토미 본사 지하에 뭔가가 있다.' },
  'canto-2': { number: '2', title: '사랑할 수 없는', desc: '카지노에서 벌어지는 도박과 거래.' },
  'canto-3': { number: '3', title: '마주하지 않는', desc: '' },
  'canto-4': { number: '4', title: '변하지 않는', desc: '' },
}

interface Props {
  params: Promise<{ chapterId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { chapterId } = await params
  const meta = CHAPTER_META[chapterId]
  return {
    title: meta ? `${meta.number}장 - ${meta.title}` : chapterId,
    description: meta?.desc || `림버스 컴퍼니 스토리 ${chapterId}`,
  }
}

export default async function ChapterPage({ params }: Props) {
  const { chapterId } = await params
  const meta = CHAPTER_META[chapterId]
  if (!meta) notFound()

  const filePath = path.join(
    process.cwd(),
    'public',
    'data',
    'story',
    chapterId,
    'index.json',
  )

  if (!existsSync(filePath)) notFound()

  const { episodes } = JSON.parse(
    await readFile(filePath, 'utf-8'),
  ) as PrologueIndex

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg-deep)' }}
    >
      <div className="max-w-[36rem] mx-auto px-[1.5rem] pt-[6rem] pb-[6rem]">
        {/* Back */}
        <Link
          href="/story"
          className="inline-flex items-center gap-[0.5rem] mb-[2rem] transition-opacity hover:opacity-70"
          style={{ color: 'var(--gold-dim)', fontFamily: 'Paperlogy, sans-serif' }}
        >
          <ArrowLeft style={{ width: '0.85rem', height: '0.85rem' }} />
          <span className="text-[0.8rem]">챕터 목록</span>
        </Link>

        {/* Header */}
        <div className="text-center mb-[3.5rem]">
          <p
            className="text-[0.65rem] tracking-[0.4em] uppercase mb-[0.75rem]"
            style={{
              color: 'var(--gold-dim)',
              fontFamily: 'PerfectDOS, monospace',
              opacity: 0.5,
            }}
          >
            CHAPTER {meta.number}
          </p>
          <h1
            className="text-[2.25rem] mb-[0.5rem]"
            style={{ fontFamily: 'KotraBold, serif', color: 'var(--gold)' }}
          >
            {meta.title}
          </h1>
          {meta.desc && (
            <p
              className="text-[0.85rem] leading-[1.7] max-w-[24rem] mx-auto"
              style={{
                fontFamily: 'Paperlogy, sans-serif',
                fontWeight: 300,
                color: '#9a8a78',
                whiteSpace: 'pre-line',
              }}
            >
              {meta.desc}
            </p>
          )}
          {/* Ornamental divider */}
          <div className="flex items-center justify-center gap-[0.75rem] mt-[1.25rem]">
            <div
              className="w-[3rem] h-px"
              style={{
                background: 'linear-gradient(to right, transparent, var(--gold-dim))',
                opacity: 0.3,
              }}
            />
            <div
              className="w-[0.25rem] h-[0.25rem] rotate-45"
              style={{ background: 'var(--gold-dim)', opacity: 0.4 }}
            />
            <div
              className="w-[3rem] h-px"
              style={{
                background: 'linear-gradient(to left, transparent, var(--gold-dim))',
                opacity: 0.3,
              }}
            />
          </div>
        </div>

        <EpisodeList episodes={episodes} chapterSlug={chapterId} />
      </div>
    </div>
  )
}
