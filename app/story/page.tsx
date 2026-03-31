import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { STORAGE_BASE } from '@/lib/constants/game'

export const metadata: Metadata = {
  title: '스토리',
  description: '림버스 컴퍼니 메인 스토리 다시보기',
}

const CHAPTERS = [
  {
    id: 'prologue',
    number: '0',
    title: '어두운 숲',
    desc: '나는 검은 숲의 한 가운데에 있었다.\n이유도, 과거도 전부 잊은 채로.',
    episodes: 7,
    available: true,
    thumbnail: `${STORAGE_BASE}/story/prologue/bg/Dark_Forest.webp`,
  },
  {
    id: 'canto-1',
    number: '1',
    title: '속하지 못하는',
    desc: '로보토미 본사 지하에 뭔가가 있다.',
    episodes: 30,
    available: true,
    thumbnail: `${STORAGE_BASE}/story/canto-1/bg/thumbnail.webp`,
  },
  {
    id: 'canto-2',
    number: '2',
    title: '사랑할 수 없는',
    desc: '카지노에서 벌어지는 도박과 거래.',
    episodes: 29,
    available: true,
    thumbnail: `${STORAGE_BASE}/story/canto-2/bg/thumbnail.webp`,
  },
  {
    id: 'chapter-3',
    number: '3',
    title: '마주하지 않는',
    episodes: 0,
    available: false,
  },
  {
    id: 'chapter-4',
    number: '4',
    title: '변하지 않는',
    episodes: 0,
    available: false,
  },
  {
    id: 'chapter-5',
    number: '5',
    title: '악으로 규정되는',
    episodes: 0,
    available: false,
  },
]

export default function StoryPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg-deep)' }}
    >
      <div className="max-w-[42rem] mx-auto px-[1.5rem] pt-[6rem] pb-[6rem]">
        {/* Header */}
        <div className="text-center mb-[3.5rem]">
          <h1
            className="text-[2.5rem] mb-[0.5rem]"
            style={{ fontFamily: 'var(--font-kotra-bold), serif', color: 'var(--gold)' }}
          >
            스토리
          </h1>
          <p
            className="text-[0.75rem] tracking-[0.3em] uppercase"
            style={{
              fontFamily: 'var(--font-perfect-dos), monospace',
              color: 'var(--gold-dim)',
              opacity: 0.4,
            }}
          >
            LIMBUS COMPANY - MAIN STORY
          </p>
        </div>

        {/* Chapter Grid */}
        <div className="flex flex-col gap-[2rem]">
          {CHAPTERS.map((ch, idx) => {
            const prevAvailable = idx > 0 && CHAPTERS[idx - 1].available
            const showDivider = !ch.available && prevAvailable
            const inner = (
              <div
                className={`rounded-[0.5rem] p-[2rem] transition-all duration-300 overflow-hidden relative ${
                  ch.available
                    ? 'episode-card cursor-pointer'
                    : 'opacity-35 cursor-not-allowed'
                }`}
                style={{
                  background: 'var(--bg-card)',
                  border: 'none',
                  boxShadow: ch.available
                    ? '0 0 0 1px color-mix(in srgb, var(--gold-dim) 12%, transparent)'
                    : '0 0 0 1px var(--border)',
                }}
              >
                {/* Thumbnail background */}
                {ch.thumbnail && (
                  <>
                    <Image
                      src={ch.thumbnail}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 42rem"
                      style={{ opacity: 0.15, zIndex: 0 }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(to right, var(--bg-card) 30%, transparent 70%)',
                        zIndex: 1,
                      }}
                    />
                  </>
                )}
                <div className="flex items-start gap-[1.25rem] relative" style={{ zIndex: 2 }}>
                  {/* Chapter number */}
                  <div
                    className="shrink-0 w-[3rem] h-[3rem] rounded-[0.25rem] flex items-center justify-center"
                    style={{
                      background:
                        'color-mix(in srgb, var(--gold-dim) 10%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--gold-dim) 20%, transparent)',
                    }}
                  >
                    <span
                      className="text-[1.25rem]"
                      style={{
                        fontFamily: 'var(--font-perfect-dos), monospace',
                        color: 'var(--gold)',
                      }}
                    >
                      {ch.number}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2
                      className="text-[1.1rem] mb-[0.25rem]"
                      style={{
                        fontFamily: 'var(--font-paperlogy), sans-serif',
                        fontWeight: 700,
                        color: ch.available ? '#ddd5c8' : '#666',
                      }}
                    >
                      {ch.title}
                    </h2>
                    {ch.desc && (
                      <p
                        className="text-[0.8rem] leading-[1.6]"
                        style={{
                          fontFamily: 'var(--font-paperlogy), sans-serif',
                          fontWeight: 300,
                          color: '#9a8a78',
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {ch.desc}
                      </p>
                    )}
                    {!ch.available && (
                      <p
                        className="text-[0.7rem] mt-[0.25rem]"
                        style={{
                          fontFamily: 'var(--font-perfect-dos), monospace',
                          color: 'var(--gold-dim)',
                          opacity: 0.5,
                        }}
                      >
                        COMING SOON
                      </p>
                    )}
                  </div>

                  {/* Episode count */}
                  {ch.available && (
                    <span
                      className="text-[0.6rem] mt-[0.25rem] shrink-0"
                      style={{
                        fontFamily: 'var(--font-perfect-dos), monospace',
                        color: 'var(--gold-dim)',
                        opacity: 0.4,
                      }}
                    >
                      {ch.episodes} EP
                    </span>
                  )}
                </div>
              </div>
            )

            return ch.available ? (
              <Link key={ch.id} href={`/story/${ch.id}`}>
                {inner}
              </Link>
            ) : (
              <div key={ch.id}>
                {showDivider && (
                  <div className="flex items-center gap-[1rem] mb-[1.5rem] mt-[0.5rem]">
                    <div className="flex-1 h-px" style={{ background: 'var(--border)', opacity: 0.4 }} />
                    <span
                      className="text-[0.6rem] tracking-[0.2em]"
                      style={{ fontFamily: 'var(--font-perfect-dos), monospace', color: 'var(--gold-dim)', opacity: 0.3 }}
                    >
                      UPCOMING
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border)', opacity: 0.4 }} />
                  </div>
                )}
                {inner}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
