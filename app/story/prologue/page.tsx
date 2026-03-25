import { readFile } from 'fs/promises'
import path from 'path'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft } from 'lucide-react'
import type { PrologueIndex } from '@/lib/story/types'
import EpisodeList from '@/components/story/EpisodeList'

export const metadata: Metadata = {
  title: '프롤로그 — 어두운 숲',
  description: '림버스 컴퍼니 프롤로그 — 검은 숲에서 시작되는 단테의 여정',
}

export default async function ProloguePage() {
  const filePath = path.join(
    process.cwd(),
    'public',
    'data',
    'story',
    'prologue',
    'index.json',
  )
  const { episodes } = JSON.parse(
    await readFile(filePath, 'utf-8'),
  ) as PrologueIndex

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg-deep)' }}
    >
      <div className="max-w-[36rem] mx-auto px-[1.5rem] pt-[6rem] pb-[6rem]">
        {/* Back to chapters */}
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
            CHAPTER 0
          </p>
          <h1
            className="text-[2.25rem] mb-[0.5rem]"
            style={{ fontFamily: 'KotraBold, serif', color: 'var(--gold)' }}
          >
            어두운 숲
          </h1>
          <p
            className="text-[0.85rem] leading-[1.7] max-w-[24rem] mx-auto"
            style={{
              fontFamily: 'Paperlogy, sans-serif',
              fontWeight: 300,
              color: '#9a8a78',
            }}
          >
            나는 검은 숲의 한 가운데에 있었다.
            <br />
            이유도, 과거도 전부 잊은 채로.
          </p>
          {/* Ornamental divider */}
          <div className="flex items-center justify-center gap-[0.75rem] mt-[1.25rem]">
            <div
              className="w-[3rem] h-px"
              style={{
                background:
                  'linear-gradient(to right, transparent, var(--gold-dim))',
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
                background:
                  'linear-gradient(to left, transparent, var(--gold-dim))',
                opacity: 0.3,
              }}
            />
          </div>
        </div>

        <EpisodeList episodes={episodes} />
      </div>
    </div>
  )
}
